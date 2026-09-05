import { describe,expect,it } from 'vitest';
import { openDatabase,now } from '../src/db.js';
import { BusinessEvents } from '../src/events.js';
import { autonomyEligibility,decideAutonomyPromotion,PRIORITY,promoteAutonomy,requestAutonomyPromotion,WorkQueue } from '../src/work-queue.js';

describe('durable business work queue',()=>{
  it('claims the highest priority unblocked item and protects the lease',()=>{
    const db=openDatabase(':memory:'),queue=new WorkQueue(db);
    const low=queue.enqueue({taskKind:'RESEARCH',title:'Research',owner:'SCOUT-UGC',priorityClass:PRIORITY.MARKET_RESEARCH,completionCriteria:'Sources recorded',idempotencyKey:'low'});
    const high=queue.enqueue({taskKind:'REVISION',title:'Revision',owner:'VANTAGE',priorityClass:PRIORITY.REVISION,completionCriteria:'New version passes QA',idempotencyKey:'high'});
    const first=queue.claim('worker-a',60)!;expect(first.id).toBe(high);expect(queue.claim('worker-b',60)?.id).toBe(low);
    expect(()=>queue.complete(high,'wrong-token',{})).toThrow(/stale/i);queue.complete(high,String(first.lease_token),{verified:true});
    expect((db.prepare('SELECT status FROM work_queue WHERE id=?').get(high) as {status:string}).status).toBe('COMPLETED');db.close();
  });

  it('skips a task waiting on approval without freezing other work',()=>{
    const db=openDatabase(':memory:'),queue=new WorkQueue(db);
    const approval=Number(db.prepare(`INSERT INTO approvals(approval_type,status,subject_type,subject_id,action_summary,recommendation,evidence_json,risks_json,requesting_agent,requested_at) VALUES('PROSPECT_OUTREACH','PENDING','LEAD',1,'Review pitch','Approve only after review','{}','[]','SCOUT',?)`).run(now()).lastInsertRowid);
    queue.enqueue({taskKind:'SEND',title:'Dependent send',owner:'CHRIS',priorityClass:1,requiredApprovalId:approval,completionCriteria:'Receipt exists',idempotencyKey:'needs-approval'});
    const free=queue.enqueue({taskKind:'PORTFOLIO',title:'Independent proof',owner:'VANTAGE',priorityClass:9,completionCriteria:'Sample complete',idempotencyKey:'free'});
    expect(queue.claim('worker')?.id).toBe(free);db.close();
  });

  it('turns a final-delivery event into eight idempotent follow-on tasks',()=>{
    const db=openDatabase(':memory:'),events=new BusinessEvents(db);
    events.record({eventType:'FINAL_DELIVERED',subjectType:'PROJECT',subjectId:7,idempotencyKey:'delivery:7'});
    events.record({eventType:'FINAL_DELIVERED',subjectType:'PROJECT',subjectId:7,idempotencyKey:'delivery:7'});
    expect((db.prepare('SELECT COUNT(*) count FROM business_events').get() as {count:number}).count).toBe(1);
    expect((db.prepare('SELECT COUNT(*) count FROM work_queue').get() as {count:number}).count).toBe(8);db.close();
  });

  it('blocks level-three promotion until every evidence and human gate passes',()=>{
    const db=openDatabase(':memory:');expect(autonomyEligibility(db,'RESEARCH',3).eligible).toBe(false);
    const request=requestAutonomyPromotion(db,'RESEARCH',3,'Supervised evidence complete',{runs:20},{risk:'bounded'},'VANTAGE');
    decideAutonomyPromotion(db,request,'APPROVED','CHRIS');expect(()=>promoteAutonomy(db,'RESEARCH',3,request)).toThrow(/maximum|Twenty/i);
    db.prepare(`UPDATE autonomy_policies SET maximum_level=3,successful_runs=20,audit_complete=1,emergency_stop_tested=1 WHERE capability='RESEARCH'`).run();
    promoteAutonomy(db,'RESEARCH',3,request);expect((db.prepare("SELECT current_level FROM autonomy_policies WHERE capability='RESEARCH'").get() as {current_level:number}).current_level).toBe(3);db.close();
  });
});

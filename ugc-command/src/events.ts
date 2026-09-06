import type { DatabaseSync } from 'node:sqlite';
import { json,now } from './db.js';
import { PRIORITY,WorkQueue } from './work-queue.js';

type EventInput={eventType:string;subjectType:string;subjectId?:number;idempotencyKey:string;payload?:Record<string,unknown>};
export class BusinessEvents{
  private queue:WorkQueue;
  constructor(private db:DatabaseSync){this.queue=new WorkQueue(db);}
  record(input:EventInput):number{
    const result=this.db.prepare(`INSERT INTO business_events(event_type,subject_type,subject_id,idempotency_key,payload_json,occurred_at) VALUES(?,?,?,?,?,?) ON CONFLICT(idempotency_key) DO NOTHING`).run(input.eventType,input.subjectType,input.subjectId||null,input.idempotencyKey,json(input.payload||{}),now());
    const id=Number(result.changes?result.lastInsertRowid:(this.db.prepare('SELECT id FROM business_events WHERE idempotency_key=?').get(input.idempotencyKey) as {id:number}).id);
    if(result.changes)this.fanOut(id,input);return id;
  }
  private task(eventId:number,input:EventInput,taskKind:string,title:string,owner:string,priority:number,criteria:string,nextAction:string):void{this.queue.enqueue({taskKind,title,owner,priorityClass:priority,completionCriteria:criteria,nextAction,sourceEventId:eventId,idempotencyKey:`event:${eventId}:${taskKind}`,evidence:{eventType:input.eventType,subjectType:input.subjectType,subjectId:input.subjectId}});}
  private fanOut(id:number,input:EventInput):void{
    const label=`${input.subjectType.toLowerCase()} #${input.subjectId||'n/a'}`;
    if(input.eventType==='LEAD_QUALIFIED')this.task(id,input,'DRAFT_PERSONALIZED_PITCH',`Prepare pitch for ${label}`,'SCOUT-UGC',PRIORITY.APPROVED_OUTREACH_PREP,'Evidence-backed personalized pitch draft exists; no external send.','Request owner outreach approval.');
    if(input.eventType==='PAYMENT_RECEIVED')this.task(id,input,'RECHECK_DELIVERY_GATES',`Recheck delivery gates for ${label}`,'VANTAGE',PRIORITY.PAYMENT_DELIVERY_BLOCKER,'Payment, agreement, QA, and final approval gates are documented.','Release only after every gate passes.');
    if(input.eventType==='INTAKE_COMPLETE')this.task(id,input,'CREATE_PRODUCTION_BRIEF',`Create production brief for ${label}`,'VANTAGE',PRIORITY.PAID_DEADLINE,'Brief resolves claims, visuals, CTA, rights, deadline, and contradictions.','Move the approved brief into production.');
    if(input.eventType==='QA_FAILED')this.task(id,input,'REMEDIATE_QA_FAILURE',`Fix QA failure for ${label}`,'VANTAGE',PRIORITY.REVISION,'Failed checks are corrected and rerun with evidence.','Return to internal QA.');
    if(input.eventType==='REVISION_REQUESTED')this.task(id,input,'COMPLETE_CLIENT_REVISION',`Complete revision for ${label}`,'VANTAGE',PRIORITY.REVISION,'Requested change is addressed in a new tracked version.','Run QA before client review.');
    if(input.eventType==='REVISION_SCOPE_WARNING')this.task(id,input,'APPROVE_REVISION_SCOPE',`Decide extra revision scope for ${label}`,'CHRIS',PRIORITY.PAYMENT_DELIVERY_BLOCKER,'Owner records whether the extra round is declined or separately quoted.','Approve, reject, request changes, or defer before more production.');
    if(input.eventType==='FINAL_DELIVERED'){
      const tasks:[string,string,number,string][]=[
        ['REQUEST_PERFORMANCE_DATA','Prepare performance-data request',PRIORITY.QUALIFIED_FOLLOW_UP,'A send-ready request and follow-up date exist.'],
        ['REQUEST_TESTIMONIAL','Prepare testimonial request',PRIORITY.QUALIFIED_FOLLOW_UP,'A permission-safe testimonial request exists.'],
        ['REQUEST_PORTFOLIO_PERMISSION','Prepare portfolio-permission request',PRIORITY.PORTFOLIO,'Usage scope and permission question are explicit.'],
        ['REQUEST_REFERRAL','Prepare referral request',PRIORITY.QUALIFIED_FOLLOW_UP,'A low-friction referral request exists.'],
        ['BUILD_CASE_STUDY','Prepare case study',PRIORITY.PORTFOLIO,'Case study uses verified outcomes only.'],
        ['DRAFT_TWO_FOLLOW_ON_CONCEPTS','Draft two follow-on concepts',PRIORITY.RETAINER_RENEWAL,'Two distinct evidence-led concepts are ready.'],
        ['RECOMMEND_RETAINER','Prepare retainer recommendation',PRIORITY.RETAINER_RENEWAL,'Recommendation explains value, scope, price, and evidence.'],
        ['SET_FOLLOW_UP_DATE','Set follow-up date',PRIORITY.RETAINER_RENEWAL,'A dated next action is recorded.']
      ];
      for(const [kind,title,priority,criteria] of tasks)this.task(id,input,kind,`${title} for ${label}`,'VANTAGE',priority,criteria,'Prepare for owner review; do not send externally.');
    }
  }
}

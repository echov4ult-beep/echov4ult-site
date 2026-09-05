import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { json,now } from './db.js';

export const PRIORITY = {
  PAID_DEADLINE:1, REVISION:2, PAYMENT_DELIVERY_BLOCKER:3, RETAINER_RENEWAL:4, WARM_RESPONSE:5,
  QUALIFIED_FOLLOW_UP:6, APPROVED_OUTREACH_PREP:7, NEW_PROSPECT_RESEARCH:8, PORTFOLIO:9,
  AUTHORITY_CONTENT:10, AFFILIATE_EXPERIMENT:11, PROCESS_IMPROVEMENT:12, MARKET_RESEARCH:13
} as const;

export type QueueStatus='READY'|'CLAIMED'|'WAITING_APPROVAL'|'BLOCKED'|'COMPLETED'|'FAILED'|'CANCELLED';
export type WorkInput={taskKind:string;title:string;owner:string;priorityClass:number;businessValueCents?:number;deadline?:string;dependencies?:number[];requiredApprovalId?:number;evidence?:unknown;completionCriteria:string;nextAction?:string;sourceEventId?:number;idempotencyKey:string};

export class WorkQueue{
  constructor(private db:DatabaseSync){}
  enqueue(input:WorkInput):number{
    if(input.priorityClass<1||input.priorityClass>13)throw new Error('Priority class must be between 1 and 13.');
    const status=input.requiredApprovalId?'WAITING_APPROVAL':'READY';
    const result=this.db.prepare(`INSERT INTO work_queue(task_kind,title,owner,priority_class,business_value_cents,deadline,dependencies_json,required_approval_id,status,evidence_json,completion_criteria,next_action,source_event_id,idempotency_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(idempotency_key) DO NOTHING`).run(input.taskKind,input.title,input.owner,input.priorityClass,input.businessValueCents||0,input.deadline||null,json(input.dependencies||[]),input.requiredApprovalId||null,status,json(input.evidence||{}),input.completionCriteria,input.nextAction||null,input.sourceEventId||null,input.idempotencyKey,now(),now());
    if(Number(result.changes)===0){const existing=this.db.prepare('SELECT id FROM work_queue WHERE idempotency_key=?').get(input.idempotencyKey) as {id:number};return existing.id;}
    return Number(result.lastInsertRowid);
  }
  refreshApprovals():number{
    return Number(this.db.prepare(`UPDATE work_queue SET status='READY',updated_at=? WHERE status='WAITING_APPROVAL' AND required_approval_id IN (SELECT id FROM approvals WHERE status='APPROVED')`).run(now()).changes);
  }
  claim(worker:string,leaseSeconds=300):Record<string,unknown>|undefined{
    if(!worker.trim())throw new Error('Worker identity is required.');this.refreshApprovals();
    this.db.exec('BEGIN IMMEDIATE');
    try{
      const instant=now();
      const candidates=this.db.prepare(`SELECT q.* FROM work_queue q LEFT JOIN approvals a ON a.id=q.required_approval_id WHERE (q.status='READY' OR (q.status='CLAIMED' AND q.lease_until<=?)) AND (q.required_approval_id IS NULL OR a.status='APPROVED') ORDER BY q.priority_class ASC,CASE WHEN q.deadline IS NULL THEN 1 ELSE 0 END,q.deadline ASC,q.business_value_cents DESC,q.created_at ASC`).all(instant) as Record<string,unknown>[];
      const row=candidates.find(candidate=>{const deps=JSON.parse(String(candidate.dependencies_json||'[]')) as number[];if(!deps.length)return true;const marks=deps.map(()=>'?').join(',');const count=(this.db.prepare(`SELECT COUNT(*) count FROM work_queue WHERE id IN (${marks}) AND status='COMPLETED'`).get(...deps) as {count:number}).count;return count===deps.length;});
      if(!row){this.db.exec('COMMIT');return undefined;}
      const token=randomUUID(),until=new Date(Date.now()+leaseSeconds*1000).toISOString();
      this.db.prepare(`UPDATE work_queue SET status='CLAIMED',lease_owner=?,lease_token=?,lease_until=?,attempt_count=attempt_count+1,updated_at=? WHERE id=?`).run(worker,token,until,instant,Number(row.id));
      this.db.exec('COMMIT');return{...row,status:'CLAIMED',lease_owner:worker,lease_token:token,lease_until:until};
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  complete(id:number,leaseToken:string,result:unknown,nextAction?:string):void{
    const changed=this.db.prepare(`UPDATE work_queue SET status='COMPLETED',result_json=?,next_action=?,completed_at=?,updated_at=?,lease_owner=NULL,lease_token=NULL,lease_until=NULL WHERE id=? AND status='CLAIMED' AND lease_token=?`).run(json(result),nextAction||null,now(),now(),id,leaseToken).changes;
    if(!changed)throw new Error('Work item completion rejected: claim is missing or lease token is stale.');
  }
  fail(id:number,leaseToken:string,result:unknown,retry=true):void{
    const changed=this.db.prepare(`UPDATE work_queue SET status=?,result_json=?,updated_at=?,lease_owner=NULL,lease_token=NULL,lease_until=NULL WHERE id=? AND status='CLAIMED' AND lease_token=?`).run(retry?'READY':'FAILED',json(result),now(),id,leaseToken).changes;
    if(!changed)throw new Error('Work item failure rejected: claim is missing or lease token is stale.');
  }
  founderAttention(limit=20):Record<string,unknown>[] {return this.db.prepare(`SELECT q.*,a.status approval_status FROM work_queue q LEFT JOIN approvals a ON a.id=q.required_approval_id WHERE q.status IN ('WAITING_APPROVAL','BLOCKED','FAILED') OR (q.status IN ('READY','CLAIMED') AND q.priority_class<=3) ORDER BY q.priority_class,q.deadline,q.created_at LIMIT ?`).all(limit) as Record<string,unknown>[];}
}

export function autonomyEligibility(db:DatabaseSync,capability:string,targetLevel:number):{eligible:boolean;reasons:string[]}{
  const row=db.prepare('SELECT * FROM autonomy_policies WHERE capability=?').get(capability) as Record<string,unknown>|undefined;if(!row)return{eligible:false,reasons:['Unknown autonomy capability.']};
  const reasons:string[]=[];if(targetLevel>Number(row.maximum_level))reasons.push('Target exceeds the governed maximum level.');if(targetLevel>=3){if(Number(row.successful_runs)<20)reasons.push('Twenty successful runs are required.');if(Number(row.material_incidents)>0)reasons.push('Material incidents must be zero.');if(Number(row.duplicate_actions)>0)reasons.push('Duplicate actions must be zero.');if(Number(row.error_rate)>Number(row.error_tolerance))reasons.push('Observed error rate exceeds tolerance.');if(!Number(row.audit_complete))reasons.push('Audit completeness has not been verified.');if(!Number(row.emergency_stop_tested))reasons.push('Emergency stop has not been tested.');}
  return{eligible:reasons.length===0,reasons};
}

export function requestAutonomyPromotion(db:DatabaseSync,capability:string,targetLevel:number,reason:string,evidence:unknown,risks:unknown,requestedBy:string):number{
  if(!reason.trim())throw new Error('Promotion reason is required.');return Number(db.prepare(`INSERT INTO autonomy_promotion_requests(capability,target_level,reason,evidence_json,risks_json,requested_by,requested_at) VALUES(?,?,?,?,?,?,?)`).run(capability,targetLevel,reason,json(evidence),json(risks),requestedBy,now()).lastInsertRowid);
}
export function decideAutonomyPromotion(db:DatabaseSync,id:number,status:'APPROVED'|'REJECTED'|'CHANGES_REQUESTED',decidedBy:string,note=''):void{
  if(!decidedBy.trim())throw new Error('Human decision identity is required.');const changed=db.prepare(`UPDATE autonomy_promotion_requests SET status=?,decided_by=?,decided_at=?,decision_note=? WHERE id=? AND status='PENDING'`).run(status,decidedBy,now(),note||null,id).changes;if(!changed)throw new Error('Promotion request is missing or already decided.');
}
export function promoteAutonomy(db:DatabaseSync,capability:string,targetLevel:number,promotionRequestId:number):void{
  const approval=db.prepare(`SELECT * FROM autonomy_promotion_requests WHERE id=? AND capability=? AND target_level=? AND status='APPROVED' AND decided_by IS NOT NULL`).get(promotionRequestId,capability,targetLevel) as Record<string,unknown>|undefined;if(!approval)throw new Error('A matching approved human promotion request is required.');const gate=autonomyEligibility(db,capability,targetLevel);if(!gate.eligible)throw new Error(gate.reasons.join(' '));
  db.prepare('UPDATE autonomy_policies SET current_level=?,promoted_by=?,promoted_at=?,updated_at=? WHERE capability=?').run(targetLevel,String(approval.decided_by),now(),now(),capability);
}

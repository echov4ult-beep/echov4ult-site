import { afterEach,describe,expect,it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { deferAttention,founderAttention } from '../src/attention.js';
import { openDatabase,now } from '../src/db.js';
import { seedDatabase } from '../src/seed-data.js';

let db:DatabaseSync|undefined;
afterEach(()=>{db?.close();db=undefined;});

describe('Founder Attention',()=>{
  it('consolidates pending decisions and supports an audited defer',()=>{
    db=openDatabase(':memory:');seedDatabase(db);
    const approval=Number(db.prepare(`INSERT INTO approvals(approval_type,status,subject_type,subject_id,action_summary,recommendation,evidence_json,risks_json,requesting_agent,requested_at) VALUES('PRODUCT_CLAIM','PENDING','PROJECT',99,'Decide the test claim','Reject unsupported language','{}','["claim risk"]','VANTAGE',?)`).run(now()).lastInsertRowid);
    const item=founderAttention(db).find(row=>row.source_type==='APPROVAL'&&row.source_id===approval);
    expect(item).toMatchObject({category:'DECISION',required_action:'Decide the test claim',approval_id:approval});
    deferAttention(db,'APPROVAL',approval,'Review tomorrow');
    expect(founderAttention(db).some(row=>row.source_type==='APPROVAL'&&row.source_id===approval)).toBe(false);
    expect((db.prepare("SELECT COUNT(*) count FROM audit_events WHERE event_type='ATTENTION_DEFERRED'").get() as {count:number}).count).toBe(1);
  });
});

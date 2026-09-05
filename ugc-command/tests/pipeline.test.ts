import { afterEach,describe,expect,it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { openDatabase,setSetting } from '../src/db.js';
import { seedDatabase } from '../src/seed-data.js';
import { MockHiggsfieldClient,MockTikTokAnalytics,MockTikTokPublisher } from '../src/integrations.js';
import { UgcPipeline } from '../src/pipeline.js';

let db:DatabaseSync|undefined;
afterEach(()=>{db?.close();db=undefined;});
function setup(){db=openDatabase(':memory:');seedDatabase(db);setSetting(db,'lifecycle','LEARNING');setSetting(db,'generation_paused',false);setSetting(db,'global_automation_paused',false);return new UgcPipeline(db,new MockHiggsfieldClient(),new MockTikTokPublisher(),new MockTikTokAnalytics());}

describe('mock pipeline',()=>{
  it('runs idea through generation, gates, approval, publish, and unavailable analytics',async()=>{
    const pipeline=setup();const product=db!.prepare('SELECT id FROM products LIMIT 1').get() as {id:number};const ideas=pipeline.scoutConcepts(product.id);expect(ideas).toHaveLength(5);
    const candidate=await pipeline.generateCandidate(ideas[0]!);const row=db!.prepare('SELECT * FROM creative_candidates WHERE id=?').get(candidate) as any;expect(row.status).toBe('READY');expect((db!.prepare('SELECT COUNT(*) count FROM compliance_checks WHERE candidate_id=? AND passed=1').get(candidate) as any).count).toBe(2);
    pipeline.approve(candidate);const job=pipeline.schedule(candidate);const result=await pipeline.runJob(job);expect(result.published).toBe(true);await pipeline.captureSnapshot(result.postId!,'1h');const snapshot=db!.prepare('SELECT * FROM performance_snapshots').get() as any;expect(JSON.parse(snapshot.unavailable_json)).toContain('watch_time');expect(snapshot.source).toBe('MOCK_NO_DATA');
  });
  it('emergency stop blocks queued publishing without deleting it',async()=>{
    const pipeline=setup();const idea=(db!.prepare('SELECT id FROM content_ideas LIMIT 1').get() as {id:number}).id;const candidate=await pipeline.generateCandidate(idea);pipeline.approve(candidate);const job=pipeline.schedule(candidate);setSetting(db!,'emergency_stop',true);expect((await pipeline.runJob(job)).published).toBe(false);expect((db!.prepare('SELECT status FROM publishing_jobs WHERE id=?').get(job) as any).status).toBe('BLOCKED');expect((db!.prepare('SELECT COUNT(*) count FROM creative_candidates WHERE id=?').get(candidate) as any).count).toBe(1);
  });
  it('Hermes generation pause blocks the adapter before it is called',async()=>{
    const pipeline=setup();setSetting(db!,'generation_paused',true);const idea=(db!.prepare('SELECT id FROM content_ideas LIMIT 1').get() as {id:number}).id;await expect(pipeline.generateCandidate(idea)).rejects.toThrow(/paused/i);
  });
});

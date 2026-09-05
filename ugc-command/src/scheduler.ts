import type { DatabaseSync } from 'node:sqlite';
import type { UgcPipeline } from './pipeline.js';
export function startScheduler(db:DatabaseSync,pipeline:UgcPipeline,intervalMs:number):NodeJS.Timeout {
  let running=false;
  const tick=async()=>{ if(running)return; running=true; try { const jobs=db.prepare("SELECT id FROM publishing_jobs WHERE status='PENDING' AND scheduled_for<=? ORDER BY scheduled_for LIMIT 5").all(new Date().toISOString()) as {id:number}[]; for(const job of jobs) await pipeline.runJob(job.id); } finally { running=false; } };
  void tick(); return setInterval(()=>void tick(),intervalMs);
}

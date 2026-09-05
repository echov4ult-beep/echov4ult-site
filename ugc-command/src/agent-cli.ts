import { loadConfig } from './config.js';
import { openDatabase, setting } from './db.js';

const db = openDatabase(loadConfig().databasePath);
const command = process.argv[2] || 'status';
const queries: Record<string, () => unknown> = {
  status: () => ({ publishingMode: setting(db,'publishing_mode','MANUAL_APPROVAL'), lifecycle: setting(db,'lifecycle','COLD_START'), emergencyStop: setting(db,'emergency_stop',false), thesis: setting(db,'channel_thesis',null), niche: setting(db,'niche',null), counts: Object.fromEntries(['products','content_ideas','creative_candidates','published_posts','experiments','agent_findings','publishing_jobs'].map(table=>[table,(db.prepare(`SELECT COUNT(*) count FROM ${table}`).get() as {count:number}).count])) }),
  mission: () => db.prepare(`SELECT ci.id,ci.concept,ci.hook,ci.angle,ci.format,ci.cta,ci.information_value,ci.status,p.name product,p.evidence_state FROM content_ideas ci JOIN products p ON p.id=ci.product_id ORDER BY ci.id DESC LIMIT 10`).all(),
  products: () => db.prepare(`SELECT id,name,niche,evidence_state,status,opportunity_score,opportunity_dimensions_json,opportunity_reasoning_json FROM products ORDER BY opportunity_score DESC`).all(),
  candidates: () => db.prepare(`SELECT c.id,c.status,c.score,c.score_dimensions_json,c.slop_flags_json,c.rejection_reason,ci.hook,ci.angle,ci.format,p.name product FROM creative_candidates c JOIN content_ideas ci ON ci.id=c.content_idea_id JOIN products p ON p.id=ci.product_id ORDER BY c.id DESC LIMIT 20`).all(),
  evidence: () => db.prepare(`SELECT pe.id,p.name product,pe.claim,pe.source_url,pe.source_title,pe.verified_at FROM product_evidence pe JOIN products p ON p.id=pe.product_id ORDER BY pe.id DESC LIMIT 50`).all(),
  experiments: () => db.prepare(`SELECT id,name,hypothesis,dimension,variants_json,status,created_at,updated_at FROM experiments ORDER BY id DESC`).all(),
  findings: () => db.prepare(`SELECT id,finding,confidence,sample_size,date_start,date_end,observed_lift,evidence_json,disposition FROM agent_findings ORDER BY id DESC LIMIT 50`).all(),
  activity: () => db.prepare(`SELECT id,agent,action,summary,evidence_json,created_at FROM agent_activity ORDER BY id DESC LIMIT 50`).all(),
  money: () => db.prepare(`SELECT ap.id,p.name product,ap.name program,ap.program_type,ap.commission_percent,ap.expected_commission,ap.clicks,ap.orders,ap.revenue,ap.commission,ap.money_status,ap.terms_reviewed FROM affiliate_programs ap LEFT JOIN products p ON p.id=ap.product_id ORDER BY ap.id DESC`).all()
};
try { const query=queries[command]; if(!query) throw new Error(`Unknown read-only command '${command}'. Allowed: ${Object.keys(queries).join(', ')}`); console.log(JSON.stringify({command,observedAt:new Date().toISOString(),data:query()},null,2)); }
catch(error){ console.error(JSON.stringify({error:error instanceof Error?error.message:String(error)})); process.exitCode=1; }
finally{ db.close(); }

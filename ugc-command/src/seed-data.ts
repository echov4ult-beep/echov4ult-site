import type { DatabaseSync } from 'node:sqlite';
import { json, now, setSetting, activity } from './db.js';
import { scoreOpportunity } from './scoring.js';
import type { OpportunityDimensions } from './types.js';

export function seedDatabase(db: DatabaseSync): void {
  const timestamp = now();
  const defaults: Record<string,unknown> = {
    channel_thesis: 'Gaming tech and accessories that make devices you already own better — and whether they’re actually worth buying.',
    niche: 'mobile/handheld gaming accessories', publishing_mode: 'MANUAL_APPROVAL', lifecycle: 'COLD_START',
    emergency_stop: false, autonomous_explicitly_enabled: false, account_started_at: timestamp,
    candidates_per_slot: 5, generation_rate_limit: 10, target_mix: { problem_solution_testing_curiosity: 70, educational_comparison: 20, direct_sales: 10 },
    lifecycle_caps: { COLD_START: { days_1_3: 0, days_4_14: 1 }, LEARNING: 1, GROWTH: 1, SCALE: 2 }
  };
  for (const [key,value] of Object.entries(defaults)) {
    if (!db.prepare('SELECT 1 FROM settings WHERE key=?').get(key)) setSetting(db,key,value);
  }
  let product = db.prepare('SELECT id FROM products WHERE name=?').get('GameSir G8+') as {id:number}|undefined;
  if (!product) {
    const dimensions: OpportunityDimensions = { visualTransformation:8,tiktokDemoPotential:9,problemClarity:8,price:6,impulsePotential:6,commissionPercent:4,expectedCommission:5,brandRecognition:7,competition:7,saturation:6,audienceSize:8,creativeAssets:7,realFootage:2,claimComplianceRisk:6,angleCount:8,adjacentExpansion:9,conversionFriction:5 };
    const scored = scoreOpportunity(dimensions);
    product = { id: Number(db.prepare(`INSERT INTO products(name,niche,evidence_state,status,opportunity_score,opportunity_dimensions_json,opportunity_reasoning_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`).run('GameSir G8+','mobile/handheld gaming accessories','UNVERIFIED','HYPOTHESIS',scored.total,json(scored.dimensions),json({summary:'Strong visual phone-to-handheld demonstration, but real-footage and claim evidence are currently limited.',contributions:scored.contributions}),timestamp,timestamp).lastInsertRowid) };
  }
  const evidence = db.prepare('SELECT id FROM product_evidence WHERE product_id=? AND claim=?').get(product.id,'The product is designed to turn a compatible phone into a handheld-style gaming setup.') as {id:number}|undefined;
  if (!evidence) db.prepare('INSERT INTO product_evidence(product_id,claim,source_url,source_title,created_at) VALUES(?,?,?,?,?)').run(product.id,'The product is designed to turn a compatible phone into a handheld-style gaming setup.','https://www.gamesir.hk/products/gamesir-g8-plus','GameSir G8+ product page',timestamp);
  for (const experiment of [
    {name:'Hook: question vs statement',hypothesis:'A question opening creates more qualified curiosity than a statement.',dimension:'HOOK',variants:['QUESTION','STATEMENT']},
    {name:'Angle: performance vs save money',hypothesis:'A save-money angle produces more valuable engagement than a performance angle.',dimension:'ANGLE',variants:['PERFORMANCE','SAVE_MONEY']}
  ]) if (!db.prepare('SELECT 1 FROM experiments WHERE name=?').get(experiment.name)) db.prepare('INSERT INTO experiments(name,hypothesis,dimension,variants_json,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(experiment.name,experiment.hypothesis,experiment.dimension,json(experiment.variants),timestamp,timestamp);
  if (!db.prepare('SELECT 1 FROM content_ideas WHERE product_id=?').get(product.id)) {
    const experiment = db.prepare('SELECT id FROM experiments ORDER BY id LIMIT 1').get() as {id:number};
    db.prepare(`INSERT INTO content_ideas(product_id,experiment_id,hook,angle,format,cta,concept,information_value,experiment_tag,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(product.id,experiment.id,'Do you actually need another handheld?','SAVE_MONEY','PROBLEM_SOLUTION','Compare the setup before deciding','Do you actually need another handheld, or does a controller turn the phone you already own into one?',0.92,'EXPERIMENT',timestamp,timestamp);
  }
  if (!db.prepare("SELECT 1 FROM agent_activity WHERE action='SEED_CREATED'").get()) activity(db,'SYSTEM','SEED_CREATED','Initial niche, thesis, product hypothesis, and two experiments were seeded.',{productId:product.id});
}

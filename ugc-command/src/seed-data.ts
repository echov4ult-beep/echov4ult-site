import type { DatabaseSync } from 'node:sqlite';
import { json, now, setSetting, activity } from './db.js';
import { scoreOpportunity } from './scoring.js';
import type { OpportunityDimensions } from './types.js';
import { PRIORITY,WorkQueue } from './work-queue.js';

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
  for(const pkg of [
    {code:'UGC_TEST',name:'UGC Test',price:14900,videos:1,hooks:1,min:20,max:40,revisions:1,description:'One edited vertical video, one primary hook, basic editing and captions, one revision, organic usage only.'},
    {code:'UGC_GROWTH',name:'UGC Growth',price:39900,videos:3,hooks:3,min:20,max:40,revisions:1,description:'Three videos or materially different concepts, multiple hooks, editing and captions, one revision round, organic usage only.'},
    {code:'MONTHLY_PARTNER',name:'Monthly Creative Partner',price:99900,videos:8,hooks:3,min:20,max:60,revisions:1,description:'Eight monthly videos, multiple angles, performance review, iterative recommendations, defined revisions, organic usage only.'}
  ]) db.prepare(`INSERT INTO service_packages(code,name,price_cents,video_count,primary_hook_count,duration_min_seconds,duration_max_seconds,revision_rounds,description,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(code) DO UPDATE SET name=excluded.name,price_cents=excluded.price_cents,video_count=excluded.video_count,primary_hook_count=excluded.primary_hook_count,duration_min_seconds=excluded.duration_min_seconds,duration_max_seconds=excluded.duration_max_seconds,revision_rounds=excluded.revision_rounds,description=excluded.description,updated_at=excluded.updated_at`).run(pkg.code,pkg.name,pkg.price,pkg.videos,pkg.hooks,pkg.min,pkg.max,pkg.revisions,pkg.description,timestamp,timestamp);
  const addons: Array<[string,string,string]> = [
    ['PAID_AD_USAGE','Paid-ad usage rights','TERM_QUOTE'],['USAGE_DURATION','Extended usage duration','TERM_QUOTE'],['PERPETUAL_USAGE','Perpetual usage','CUSTOM_QUOTE'],['RAW_FOOTAGE','Raw footage','PER_PROJECT'],['ADDITIONAL_REVISIONS','Additional revisions','PER_ROUND'],['RUSH_DELIVERY','Rush delivery','PER_PROJECT'],['CATEGORY_EXCLUSIVITY','Category exclusivity','TERM_QUOTE'],['COMPETITOR_EXCLUSIVITY','Competitor exclusivity','TERM_QUOTE'],['ADDITIONAL_HOOKS','Additional hooks','PER_HOOK'],['ADDITIONAL_ASPECT_RATIOS','Additional aspect ratios','PER_RATIO']
  ];
  for(const addon of addons) db.prepare(`INSERT INTO package_addons(code,name,pricing_unit,requires_human_quote,created_at,updated_at) VALUES(?,?,?,1,?,?) ON CONFLICT(code) DO UPDATE SET name=excluded.name,pricing_unit=excluded.pricing_unit,requires_human_quote=1,updated_at=excluded.updated_at`).run(addon[0],addon[1],addon[2],timestamp,timestamp);
  for(const [key,value] of Object.entries({outreach_paused:true,generation_paused:true,production_paused:true,agents_paused:false,global_automation_paused:true,delivery_paused:false,publishing_paused:false})) if(!db.prepare('SELECT 1 FROM settings WHERE key=?').get(key))setSetting(db,key,value);
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
  const queue=new WorkQueue(db);
  for(const sample of [
    ['GAMING_DEMO','Gaming-accessory demonstration'],['HOME_OFFICE_PROBLEM_SOLUTION','Home-office problem/solution video'],['CREATOR_EQUIPMENT_DEMO','Creator-equipment testimonial or demonstration'],['TECH_UNBOXING','Technology-product unboxing'],['AI_TOOL_DEMO','AI tool or website demonstration']
  ])queue.enqueue({taskKind:`PORTFOLIO_${sample[0]}`,title:`Complete portfolio sample: ${sample[1]}`,owner:'VANTAGE',priorityClass:PRIORITY.PORTFOLIO,evidence:{requiredBy:'Milestone 1'},completionCriteria:'A finished, QA-reviewed sample exists and is truthfully labeled as self-initiated or permissioned; its production method is recorded.',nextAction:'Add the verified sample to the portfolio manager and public UGC page.',idempotencyKey:`milestone1:portfolio:${sample[0]}`});
  queue.enqueue({taskKind:'RESEARCH_FIRST_10_PROSPECTS',title:'Research the first 10 qualified UGC prospects',owner:'SCOUT-UGC',priorityClass:PRIORITY.NEW_PROSPECT_RESEARCH,businessValueCents:14900,evidence:{targetNiches:['gaming accessories','technology','creator equipment','home office','AI tools/software']},completionCriteria:'Ten non-duplicate prospects each have official source links, a verified contact route, evidence of fit, a specific creative opportunity, package recommendation, estimated value, confidence, and a draft pitch; nothing is sent.',nextAction:'Submit qualified records and pitch drafts to VANTAGE for owner review.',idempotencyKey:'milestone1:prospects:first-10'});
}

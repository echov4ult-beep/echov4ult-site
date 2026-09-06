import type { DatabaseSync } from 'node:sqlite';
import { activity, json, now, setting } from './db.js';
import { claimFirewall, complianceGate, decideSkip, publishingGate } from './policies.js';
import { detectSlop, scoreCreative, selectConcepts, type ConceptFactor } from './scoring.js';
import type { CandidateDraft, CreativeDimensions, EvidenceState, Lifecycle, PublishingMode, SkipReason } from './types.js';
import { PublishNotDispatchedError, type HiggsfieldClient, type TikTokAnalytics, type TikTokPublisher } from './integrations.js';

type Row = Record<string, unknown>;
export class UgcPipeline {
  constructor(private db: DatabaseSync, private video: HiggsfieldClient, private publisher: TikTokPublisher, private analytics: TikTokAnalytics) {}

  scoutConcepts(productId: number): number[] {
    const product = this.db.prepare('SELECT * FROM products WHERE id=?').get(productId) as Row|undefined;
    if (!product) throw new Error('Product not found.');
    const requested = setting(this.db,'candidates_per_slot',5);
    const limit = setting(this.db,'generation_rate_limit',10);
    const factors: ConceptFactor[] = [
      {productId,hook:'Do you actually need another handheld?',angle:'SAVE_MONEY',format:'PROBLEM_SOLUTION',cta:'Compare before deciding',priorSamples:0,uncertainty:9,qualityPrior:8},
      {productId,hook:'What changes when your phone gets real controls?',angle:'PERFORMANCE',format:'DEMO',cta:'Check compatibility first',priorSamples:0,uncertainty:8,qualityPrior:8},
      {productId,hook:'A controller or a whole new handheld?',angle:'COMPARISON',format:'SIDE_BY_SIDE',cta:'Pick the setup that fits',priorSamples:0,uncertainty:8,qualityPrior:7},
      {productId,hook:'Three compatibility checks before buying',angle:'EDUCATION',format:'CHECKLIST',cta:'Verify your device',priorSamples:1,uncertainty:6,qualityPrior:9},
      {productId,hook:'The cheaper handheld setup has a catch',angle:'SAVE_MONEY',format:'CURIOSITY',cta:'Compare the tradeoffs',priorSamples:0,uncertainty:9,qualityPrior:7},
      {productId,hook:'Phone gaming without touchscreen controls',angle:'PROBLEM',format:'BEFORE_AFTER',cta:'See whether it solves your issue',priorSamples:2,uncertainty:5,qualityPrior:8}
    ];
    const selected = selectConcepts(factors,requested,limit);
    const created: number[] = [];
    for (const item of selected) {
      const concept = `${item.hook} ${item.angle === 'SAVE_MONEY' ? 'Compare the cost with buying another device.' : 'Show the setup and its sourced capabilities.'}`;
      const result = this.db.prepare(`INSERT INTO content_ideas(product_id,hook,angle,format,cta,concept,information_value,experiment_tag,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)`).run(productId,item.hook,item.angle,item.format,item.cta,concept,item.uncertainty/10,'EXPERIMENT',now(),now());
      created.push(Number(result.lastInsertRowid));
    }
    activity(this.db,'SCOUT','CONCEPTS_CREATED',`SCOUT selected ${created.length} concepts by expected information value.`,{productId,requested,rateLimit:limit,ideaIds:created});
    return created;
  }

  async generateCandidate(ideaId: number): Promise<number> {
    if(setting(this.db,'emergency_stop',false)||setting(this.db,'agents_paused',false)||setting(this.db,'generation_paused',true)||setting(this.db,'global_automation_paused',true))throw new Error('Generation is paused by Hermes controls.');
    const idea = this.db.prepare(`SELECT ci.*,p.evidence_state,p.name product_name FROM content_ideas ci JOIN products p ON p.id=ci.product_id WHERE ci.id=?`).get(ideaId) as Row|undefined;
    if (!idea) throw new Error('Content idea not found.');
    const evidence = this.db.prepare('SELECT id,claim FROM product_evidence WHERE product_id=? ORDER BY id LIMIT 1').get(Number(idea.product_id)) as {id:number;claim:string}|undefined;
    if (!evidence) throw new Error('No sourced product evidence is available.');
    const draft: CandidateDraft = {
      caption:'#ad Compare the controller setup with another handheld before you buy. Compatibility varies by device.',
      overlayText:['#advertisement','Do you actually need another handheld?'],
      script:`${idea.hook} GameSir lists the G8+ as a controller designed to turn a compatible phone into a handheld-style gaming setup. Check your device compatibility and compare the tradeoffs before buying.`,
      factualClaims:[{text:evidence.claim,evidenceId:evidence.id}],monetized:true,requiresBurnedInDisclosure:true,
      affiliateUrl:'https://www.amazon.com/dp/example?tag=echov4ult-20',programType:'AMAZON'
    };
    const validIds = new Set((this.db.prepare('SELECT id FROM product_evidence WHERE product_id=?').all(Number(idea.product_id)) as {id:number}[]).map(row=>row.id));
    const claim = claimFirewall(draft,idea.evidence_state as EvidenceState,validIds);
    const compliance = complianceGate(draft);
    const slop = detectSlop(draft);
    const dimensions: CreativeDimensions = {firstFrame:8,hook:8,clarity:9,curiosity:8,movement:7,productVisibility:8,nativeFeel:7,retentionPotential:8,payoff:7,credibility:9,cta:7,novelty:7,adLikePenalty:3,repetitionPenalty:1,claimRisk:claim.passed?1:10,compliance:compliance.passed?10:0,similarityPenalty:1};
    const score = Math.max(0,scoreCreative(dimensions)-slop.length*4);
    const skip = decideSkip({claimPassed:claim.passed,compliancePassed:compliance.passed,score,duplicate:false});
    const generated = skip ? null : await this.video.generate(draft);
    const result = this.db.prepare(`INSERT INTO creative_candidates(content_idea_id,script,caption,overlay_json,claims_json,monetized,disclosure_required,video_uri,score,score_dimensions_json,slop_flags_json,status,rejection_reason,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(ideaId,draft.script,draft.caption,json(draft.overlayText),json(draft.factualClaims),1,1,generated?.uri||null,score,json(dimensions),json(slop),skip?'SKIPPED':'READY',skip,now(),now());
    const id = Number(result.lastInsertRowid);
    for (const [type,gate] of [['CLAIM_FIREWALL',claim],['AFFILIATE_DISCLOSURE',compliance]] as const) this.db.prepare('INSERT INTO compliance_checks(candidate_id,check_type,passed,reasons_json,evidence_json,created_at) VALUES(?,?,?,?,?,?)').run(id,type,gate.passed?1:0,json(gate.reasons),json(gate.evidence),now());
    activity(this.db,'VANTAGE','CANDIDATE_EVALUATED',skip?`Candidate ${id} was skipped: ${skip}.`:`Candidate ${id} passed hard gates with score ${score}.`,{candidateId:id,score,slop,claimPassed:claim.passed,compliancePassed:compliance.passed});
    return id;
  }

  approve(candidateId: number): void { this.db.prepare("UPDATE creative_candidates SET status='APPROVED',approved_at=?,updated_at=? WHERE id=? AND status='READY'").run(now(),now(),candidateId); activity(this.db,'VANTAGE','CANDIDATE_APPROVED',`Candidate ${candidateId} was approved by a human.`,{candidateId}); }
  reject(candidateId: number, reason='Rejected by human'): void { this.db.prepare("UPDATE creative_candidates SET status='REJECTED',rejection_reason=?,updated_at=? WHERE id=?").run(reason,now(),candidateId); activity(this.db,'VANTAGE','CANDIDATE_REJECTED',`Candidate ${candidateId} was rejected.`,{candidateId,reason}); }
  hold(candidateId: number): void { this.db.prepare("UPDATE creative_candidates SET status='HELD',rejection_reason='MANUAL_HOLD',updated_at=? WHERE id=?").run(now(),candidateId); activity(this.db,'VANTAGE','CANDIDATE_HELD',`Candidate ${candidateId} is on manual hold.`,{candidateId}); }
  schedule(candidateId: number, scheduledFor = now()): number {
    const key=`tiktok:candidate:${candidateId}`, timestamp=now();
    this.db.prepare(`INSERT INTO publishing_jobs(candidate_id,scheduled_for,idempotency_key,created_at,updated_at)
      SELECT id,?,?,?,? FROM creative_candidates WHERE id=? AND status='APPROVED'
      ON CONFLICT(idempotency_key) DO NOTHING`).run(scheduledFor,key,timestamp,timestamp,candidateId);
    const job=this.db.prepare('SELECT id FROM publishing_jobs WHERE idempotency_key=?').get(key) as {id:number}|undefined;
    if(!job)throw new Error('Only an approved candidate may be scheduled.');
    return job.id;
  }

  async runJob(jobId: number): Promise<{published:boolean;reason?:string;postId?:number}> {
    const row = this.db.prepare(`SELECT j.*,c.status candidate_status,c.caption,c.video_uri,c.score,c.content_idea_id,ci.product_id,ci.hook,ci.angle,ci.format,ci.cta,ci.experiment_tag FROM publishing_jobs j JOIN creative_candidates c ON c.id=j.candidate_id JOIN content_ideas ci ON ci.id=c.content_idea_id WHERE j.id=?`).get(jobId) as Row|undefined;
    if (!row || row.status !== 'PENDING') return {published:false,reason:'Job is missing or no longer pending.'};
    const mode=setting<PublishingMode>(this.db,'publishing_mode','MANUAL_APPROVAL'), lifecycle=setting<Lifecycle>(this.db,'lifecycle','COLD_START');
    const pauseReasons:string[]=[];
    if(setting(this.db,'agents_paused',false))pauseReasons.push('Agents are paused.');
    if(setting(this.db,'publishing_paused',false))pauseReasons.push('Publishing is paused.');
    if(setting(this.db,'global_automation_paused',true))pauseReasons.push('Global automation is paused.');
    if(pauseReasons.length){const reason=pauseReasons.join(' ');this.db.prepare("UPDATE publishing_jobs SET status='BLOCKED',skip_reason='MANUAL_HOLD',last_error=?,updated_at=? WHERE id=?").run(reason,now(),jobId);activity(this.db,'VANTAGE','PUBLISH_BLOCKED',`Publishing job ${jobId} was blocked by Hermes controls.`,{jobId,reasons:pauseReasons});return{published:false,reason};}
    const start=new Date(setting(this.db,'account_started_at',now())).getTime();
    const recent=(this.db.prepare("SELECT COUNT(*) count FROM published_posts WHERE published_at >= datetime('now','-24 hours')").get() as {count:number}).count;
    const gate=publishingGate({mode,emergencyStop:setting(this.db,'emergency_stop',false),approved:row.candidate_status==='APPROVED',due:new Date(String(row.scheduled_for)).getTime()<=Date.now(),lifecycle,postsInLast24Hours:recent,accountAgeDays:Math.max(0,Math.floor((Date.now()-start)/86400000)),autonomousExplicitlyEnabled:setting(this.db,'autonomous_explicitly_enabled',false)});
    if (!gate.passed) { const reason = gate.reasons.join(' '); this.db.prepare("UPDATE publishing_jobs SET status='BLOCKED',skip_reason=?,last_error=?,updated_at=? WHERE id=?").run('MANUAL_HOLD',reason,now(),jobId); activity(this.db,'VANTAGE','PUBLISH_BLOCKED',`Publishing job ${jobId} was blocked.`,{jobId,reasons:gate.reasons}); return {published:false,reason}; }
    const claimed=this.db.prepare("UPDATE publishing_jobs SET status='RUNNING',attempt_count=attempt_count+1,updated_at=? WHERE id=? AND status='PENDING'").run(now(),jobId);
    if(!claimed.changes)return {published:false,reason:'Job was already claimed.'};
    try {
      const result=await this.publisher.publish({videoUri:String(row.video_uri),caption:String(row.caption),idempotencyKey:String(row.idempotency_key)});
      const timestamp=now();
      this.db.exec('BEGIN IMMEDIATE');
      let post;
      try {
        post=this.db.prepare(`INSERT INTO published_posts(candidate_id,platform,platform_post_id,published_at,product_id,hook,angle,format,cta,publish_time,hashtags_json,prompt_summary,candidate_score,experiment_tag,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(Number(row.candidate_id),'TIKTOK',result.platformPostId,timestamp,Number(row.product_id),String(row.hook),String(row.angle),String(row.format),String(row.cta),timestamp,json(['#ad']),`Deterministic factual-only candidate for idea ${row.content_idea_id}.`,Number(row.score),String(row.experiment_tag),timestamp);
        this.db.prepare("UPDATE publishing_jobs SET status='PUBLISHED',updated_at=? WHERE id=? AND status='RUNNING'").run(timestamp,jobId);
        this.db.exec('COMMIT');
      } catch(error) { this.db.exec('ROLLBACK'); throw error; }
      const postId=Number(post.lastInsertRowid); activity(this.db,'VANTAGE','POST_PUBLISHED',`Publishing job ${jobId} completed via ${result.mock?'mock':'real'} transport.`,{jobId,postId,platformPostId:result.platformPostId}); return {published:true,postId};
    } catch(error) { const message=error instanceof Error?error.message:String(error), definitive=error instanceof PublishNotDispatchedError, status=definitive?'FAILED':'UNKNOWN', reason=definitive?'NOT_DISPATCHED':'RECONCILIATION_REQUIRED'; this.db.prepare('UPDATE publishing_jobs SET status=?,skip_reason=?,last_error=?,updated_at=? WHERE id=?').run(status,reason,message,now(),jobId); activity(this.db,'VANTAGE',definitive?'PUBLISH_NOT_DISPATCHED':'PUBLISH_RECONCILIATION_REQUIRED',definitive?`Publishing job ${jobId} was not dispatched.`:`Publishing job ${jobId} may have reached the platform and requires manual reconciliation.`,{jobId,error:message}); return {published:false,reason:definitive?message:'Platform result needs manual reconciliation before any retry.'}; }
  }

  async captureSnapshot(postId:number,window:string): Promise<void> { const post=this.db.prepare('SELECT platform_post_id FROM published_posts WHERE id=?').get(postId) as {platform_post_id:string}|undefined; if(!post) throw new Error('Post not found.'); const result=await this.analytics.snapshot(post.platform_post_id); this.db.prepare(`INSERT INTO performance_snapshots(published_post_id,window,observed_at,metrics_json,unavailable_json,source) VALUES(?,?,?,?,?,?) ON CONFLICT(published_post_id,window) DO UPDATE SET observed_at=excluded.observed_at,metrics_json=excluded.metrics_json,unavailable_json=excluded.unavailable_json,source=excluded.source`).run(postId,window,now(),json(result.metrics),json(result.unavailable),result.source); }
}

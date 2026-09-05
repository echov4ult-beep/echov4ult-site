import { createServer,type IncomingMessage,type ServerResponse } from 'node:http';
import { randomBytes,timingSafeEqual } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { dashboard,css } from './dashboard.js';
import { activity,json,now,setSetting,setting } from './db.js';
import { sanitizeUserFacingOutput } from './policies.js';
import type { UgcPipeline } from './pipeline.js';
import type { RevenueOps } from './revenue.js';
import type { LeadStage } from './types.js';
import { autonomyEligibility,decideAutonomyPromotion,promoteAutonomy } from './work-queue.js';
import { deferAttention } from './attention.js';

async function body(req:IncomingMessage):Promise<URLSearchParams>{
  if(!String(req.headers['content-type']||'').startsWith('application/x-www-form-urlencoded'))throw new Error('Unsupported form encoding.');
  const chunks:Buffer[]=[];let size=0;
  for await(const chunk of req){const part=Buffer.from(chunk);size+=part.length;if(size>256_000)throw new Error('Request body is too large.');chunks.push(part);}
  return new URLSearchParams(Buffer.concat(chunks).toString());
}
const redirect=(res:ServerResponse)=>{res.writeHead(303,{Location:'/'});res.end();};
const number=(form:URLSearchParams,key:string)=>{const value=Number(form.get(key));if(!Number.isFinite(value))throw new Error(`Invalid ${key}.`);return value;};
const dollars=(form:URLSearchParams,key:string)=>Math.round(number(form,key)*100);
const audit=(db:DatabaseSync,eventType:string,subjectType:string,subjectId:number|null,summary:string,detail:unknown={})=>db.prepare("INSERT INTO audit_events(actor_type,actor_id,event_type,subject_type,subject_id,summary,detail_json,created_at) VALUES('HUMAN','CHRIS',?,?,?,?,?,?)").run(eventType,subjectType,subjectId,summary,json(detail),now());

export function createApp(db:DatabaseSync,pipeline:UgcPipeline,revenue:RevenueOps){
  const csrfToken=randomBytes(32).toString('hex');
  return createServer(async(req,res)=>{
    try{
      const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
      res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self'; script-src 'self' 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
      if(req.method==='GET'&&url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(dashboard(db,csrfToken));return;}
      if(req.method==='GET'&&url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
      if(req.method==='GET'&&url.pathname==='/app.css'){res.setHeader('Content-Type','text/css');res.end(css);return;}
      if(req.method==='GET'&&url.pathname==='/api/health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,mode:setting(db,'publishing_mode','MANUAL_APPROVAL'),lifecycle:setting(db,'lifecycle','COLD_START'),emergencyStop:setting(db,'emergency_stop',false),externalActions:'MANUAL_CONFIRMATION_ONLY'}));return;}
      if(req.method==='GET'&&url.pathname==='/api/state'){
        const tables=['products','content_ideas','creative_candidates','published_posts','performance_snapshots','experiments','agent_findings','compliance_checks','publishing_jobs','agent_activity','affiliate_programs','leads','approvals','projects','production_items','invoices','payments','deliveries','portfolio_items','financial_entries','audit_events'];
        const counts=Object.fromEntries(tables.map(table=>[table,(db.prepare(`SELECT COUNT(*) count FROM ${table}`).get() as {count:number}).count]));
        res.setHeader('Content-Type','application/json');res.end(JSON.stringify({counts}));return;
      }
      if(req.method==='POST'&&url.pathname.startsWith('/actions/')){
        const origin=String(req.headers.origin||'');const expected=`http://${req.headers.host}`;if(origin&&origin!==expected)throw new Error('Cross-origin action blocked.');
        const form=await body(req);const supplied=Buffer.from(String(form.get('_csrf')||''));const expectedToken=Buffer.from(csrfToken);if(supplied.length!==expectedToken.length||!timingSafeEqual(supplied,expectedToken))throw new Error('Invalid or missing action token.');
        const id=Number(form.get('id'));
        if(url.pathname==='/actions/mode'){const mode=String(form.get('mode'));if(!['OFF','MANUAL_APPROVAL','SCHEDULED','AUTONOMOUS'].includes(mode))throw new Error('Invalid publishing mode.');if(mode==='AUTONOMOUS'&&!setting(db,'autonomous_explicitly_enabled',false))throw new Error('Autonomous mode requires a separate governed promotion after its evidence gates pass.');setSetting(db,'publishing_mode',mode);activity(db,'SYSTEM','MODE_CHANGED',`Publishing mode changed to ${mode} by a human dashboard action.`,{mode});audit(db,'PUBLISHING_MODE_CHANGED','SYSTEM',null,`Publishing mode changed to ${mode}.`);}
        else if(url.pathname==='/actions/pause'){const key=String(form.get('key'));const allowed=['outreach_paused','generation_paused','production_paused','agents_paused','global_automation_paused','publishing_paused','delivery_paused'];if(!allowed.includes(key))throw new Error('Unknown pause control.');const active=form.get('active')==='true';setSetting(db,key,active);audit(db,'PAUSE_CHANGED','SYSTEM',null,`${key} ${active?'paused':'resumed'} by owner.`,{key,active});}
        else if(url.pathname==='/actions/emergency-stop'){const active=form.get('active')==='true';setSetting(db,'emergency_stop',active);if(active)db.prepare("UPDATE publishing_jobs SET status='BLOCKED',skip_reason='MANUAL_HOLD',last_error='Emergency stop activated',updated_at=? WHERE status='PENDING'").run(now());activity(db,'SYSTEM','EMERGENCY_STOP_CHANGED',active?'Emergency stop activated; pending jobs disabled.':'Emergency stop cleared by a human.',{active});audit(db,'EMERGENCY_STOP_CHANGED','SYSTEM',null,active?'Emergency stop activated.':'Emergency stop cleared.',{active});}
        else if(url.pathname==='/actions/lead-create')revenue.createLead({company:String(form.get('company')||''),website:String(form.get('website')||''),productCategory:String(form.get('productCategory')||''),leadSource:String(form.get('leadSource')||''),fitReason:String(form.get('fitReason')||''),estimatedDealCents:dollars(form,'estimatedDeal'),proposedConcept:String(form.get('proposedConcept')||'')});
        else if(url.pathname==='/actions/lead-stage')revenue.moveLead(id,String(form.get('stage')) as LeadStage,String(form.get('note')||''));
        else if(url.pathname==='/actions/pitch-draft')revenue.draftPitch(number(form,'leadId'),String(form.get('pitch')||''));
        else if(url.pathname==='/actions/approval')revenue.decideApproval(id,String(form.get('status')) as 'APPROVED'|'REJECTED'|'CHANGES_REQUESTED',String(form.get('note')||''));
        else if(url.pathname==='/actions/attention-defer')deferAttention(db,String(form.get('sourceType')||''),number(form,'sourceId'),String(form.get('reason')||''));
        else if(url.pathname==='/actions/autonomy-decision'){const status=String(form.get('status')) as 'APPROVED'|'REJECTED'|'CHANGES_REQUESTED';const request=db.prepare('SELECT capability,target_level FROM autonomy_promotion_requests WHERE id=?').get(id) as {capability:string;target_level:number}|undefined;if(!request)throw new Error('Autonomy promotion request not found.');if(status==='APPROVED'){const gate=autonomyEligibility(db,request.capability,request.target_level);if(!gate.eligible)throw new Error(gate.reasons.join(' '));}decideAutonomyPromotion(db,id,status,'CHRIS',String(form.get('note')||''));if(status==='APPROVED')promoteAutonomy(db,request.capability,request.target_level,id);audit(db,'AUTONOMY_PROMOTION_DECIDED','AUTONOMY',id,`Autonomy promotion ${status.toLowerCase()}.`,{capability:request.capability,targetLevel:request.target_level});}
        else if(url.pathname==='/actions/pitch-sent')revenue.recordPitchSent(number(form,'communicationId'),String(form.get('idempotencyKey')||''));
        else if(url.pathname==='/actions/project-create')revenue.createClientProject(number(form,'leadId'),number(form,'packageId'),String(form.get('title')||''));
        else if(url.pathname==='/actions/package-price'){const packageId=number(form,'packageId'),priceCents=dollars(form,'price');if(priceCents<0)throw new Error('Price cannot be negative.');db.prepare('UPDATE service_packages SET price_cents=?,updated_at=? WHERE id=?').run(priceCents,now(),packageId);audit(db,'PACKAGE_PRICE_CHANGED','SERVICE_PACKAGE',packageId,'Package price changed by owner.',{priceCents});}
        else if(url.pathname==='/actions/addon')revenue.addProjectAddon(number(form,'projectId'),number(form,'addonId'),1,dollars(form,'price'),{terms:String(form.get('terms')||'')});
        else if(url.pathname==='/actions/intake'){const values=Object.fromEntries(form.entries());delete values._csrf;const projectId=number(form,'projectId');revenue.saveIntake(projectId,values);revenue.saveIntakeDetails(projectId,values);}
        else if(url.pathname==='/actions/agreement')revenue.createAgreement(number(form,'projectId'),{priceCents:dollars(form,'price'),depositCents:dollars(form,'deposit'),revisionRounds:Math.max(0,number(form,'revisionRounds')||1),turnaroundDays:Math.max(1,number(form,'turnaroundDays')||7),paidAdUsage:form.get('paidAdUsage')==='on',perpetualUsage:form.get('perpetualUsage')==='on',rawFootageOwnership:form.get('rawFootageOwnership')==='on',categoryExclusivity:form.get('categoryExclusivity')==='on',competitorExclusivity:form.get('competitorExclusivity')==='on',usageExpires:String(form.get('usageExpires')||''),portfolioPermission:String(form.get('portfolioPermission')||'UNKNOWN')});
        else if(url.pathname==='/actions/agreement-accept')revenue.acceptAgreement(number(form,'agreementId'));
        else if(url.pathname==='/actions/invoice')revenue.createInvoice(number(form,'projectId'),dollars(form,'amount'),String(form.get('kind')) as 'DEPOSIT'|'BALANCE'|'FULL');
        else if(url.pathname==='/actions/payment')revenue.confirmPayment(number(form,'invoiceId'),dollars(form,'amount'),String(form.get('idempotencyKey')||''));
        else if(url.pathname==='/actions/project-metrics'){const projectId=number(form,'projectId'),minutes=number(form,'minutes'),expense=dollars(form,'expense');if(minutes>0)revenue.addProductionMinutes(projectId,minutes);if(expense>0)revenue.recordProjectExpense(projectId,expense,'Direct production cost');}
        else if(url.pathname==='/actions/followup')revenue.createFollowup(number(form,'projectId'),String(form.get('type')) as 'TESTIMONIAL'|'REPEAT_ORDER',String(form.get('message')||''));
        else if(url.pathname==='/actions/portfolio')revenue.addPortfolioItem(number(form,'projectId')||undefined,{title:String(form.get('title')||''),productBrand:String(form.get('productBrand')||''),category:String(form.get('category')||''),format:String(form.get('format')) as 'PRODUCT_DEMONSTRATION'|'PROBLEM_SOLUTION'|'TESTIMONIAL'|'UNBOXING'|'SOFTWARE_WEBSITE_DEMO',description:String(form.get('description')||''),permissionStatus:String(form.get('permissionStatus')) as 'UNKNOWN'|'REQUESTED'|'GRANTED'|'DENIED'|'SELF_INITIATED',visibility:String(form.get('visibility')) as 'PUBLIC'|'PRIVATE',videoUri:String(form.get('videoUri')||''),thumbnailUri:String(form.get('thumbnailUri')||''),skills:String(form.get('skills')||'').split(',').map(value=>value.trim()).filter(Boolean)});
        else if(url.pathname==='/actions/production-create')revenue.createProductionItem(number(form,'projectId'),String(form.get('title')||''),'VERTICAL_VIDEO');
        else if(url.pathname==='/actions/production-stage')revenue.moveProductionItem(id,String(form.get('stage')),String(form.get('blockedReason')||''));
        else if(url.pathname==='/actions/version')revenue.addVersion(number(form,'itemId'),String(form.get('fileUri')||''),form.get('watermarked')==='on','DRAFT',String(form.get('sha256')||'')||undefined);
        else if(url.pathname==='/actions/check')revenue.recordProjectCheck(number(form,'projectId'),number(form,'itemId'),String(form.get('checkType')) as 'CLAIM'|'DISCLOSURE'|'HOOK'|'CTA'|'END_CARD'|'CREATIVE_VARIETY'|'PLATFORM_POLICY'|'QUALITY',form.get('passed')==='true',String(form.get('reason')||'')?[String(form.get('reason'))]:[],{},number(form,'versionId'));
        else if(url.pathname==='/actions/revision')revenue.requestRevision(number(form,'itemId'),number(form,'versionId'),String(form.get('requestText')||''));
        else if(url.pathname==='/actions/final-approval')revenue.requestApproval('FINAL_DELIVERY','PROJECT',number(form,'projectId'),'Release the approved unwatermarked final asset.','The selected version is ready for owner review.',{versionId:number(form,'versionId')},{risks:['Payment and QA gates must pass before release.']},'VANTAGE');
        else if(url.pathname==='/actions/delivery'){if(setting(db,'emergency_stop',false)||setting(db,'delivery_paused',false)||setting(db,'global_automation_paused',true))throw new Error('Delivery is paused by Hermes controls.');revenue.deliver(number(form,'projectId'),number(form,'versionId'),String(form.get('type')) as 'WATERMARKED_DRAFT'|'FINAL_UNWATERMARKED',String(form.get('idempotencyKey')||''));}
        else if(url.pathname==='/actions/generate'){if(setting(db,'emergency_stop',false)||setting(db,'agents_paused',false)||setting(db,'generation_paused',true)||setting(db,'global_automation_paused',true))throw new Error('Generation is paused by Hermes controls.');await pipeline.generateCandidate(number(form,'ideaId'));}
        else if(url.pathname==='/actions/variants'){if(setting(db,'emergency_stop',false)||setting(db,'agents_paused',false))throw new Error('Agent work is paused by Hermes controls.');pipeline.scoutConcepts(number(form,'productId'));}
        else if(url.pathname==='/actions/finding'){const disposition=String(form.get('disposition'));if(!['ACCEPT','QUESTION','IGNORE'].includes(disposition))throw new Error('Invalid finding disposition.');db.prepare('UPDATE agent_findings SET disposition=?,updated_at=? WHERE id=?').run(disposition,now(),id);activity(db,'SYSTEM','FINDING_REVIEWED',`Finding ${id} marked ${disposition} by a human.`,{id,disposition});}
        else if(url.pathname==='/actions/approve')pipeline.approve(id);
        else if(url.pathname==='/actions/reject')pipeline.reject(id);
        else if(url.pathname==='/actions/hold')pipeline.hold(id);
        else if(url.pathname==='/actions/publish'){if(setting(db,'publishing_paused',false)||setting(db,'global_automation_paused',true))throw new Error('Publishing is paused by Hermes controls.');const job=pipeline.schedule(id);await pipeline.runJob(job);}
        else {res.writeHead(404);res.end('Not found');return;}
        redirect(res);return;
      }
      res.writeHead(404);res.end('Not found');
    }catch(error){const raw=error instanceof Error?error.message:String(error);const cleaned=sanitizeUserFacingOutput(raw);res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:cleaned.safe?cleaned.text:'Action failed. Internal content was blocked.'}));}
  });
}

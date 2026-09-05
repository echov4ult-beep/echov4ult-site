import { afterEach,describe,expect,it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { openDatabase,setSetting,now } from '../src/db.js';
import { seedDatabase } from '../src/seed-data.js';
import { RevenueOps } from '../src/revenue.js';
import { sanitizeUserFacingOutput } from '../src/policies.js';

let db:DatabaseSync|undefined;
afterEach(()=>{db?.close();db=undefined;});

function setup(){
  db=openDatabase(':memory:');seedDatabase(db);return {db,revenue:new RevenueOps(db)};
}

function wonLead(revenue:RevenueOps){
  const lead=revenue.createLead({company:'Acme Gear',website:'https://acme.example',productCategory:'gaming accessories',leadSource:'research',fitReason:'Clear visual product demo',estimatedDealCents:39900});
  revenue.moveLead(lead,'QUALIFIED');return lead;
}

function clientProject(revenue:RevenueOps,database:DatabaseSync){
  const lead=wonLead(revenue);
  const pitch=revenue.draftPitch(lead,'I prepared a specific controller demo concept for Acme.');
  revenue.decideApproval(pitch.approvalId,'APPROVED','Reviewed by owner.');
  setSetting(database,'outreach_paused',false);setSetting(database,'global_automation_paused',false);
  revenue.recordPitchSent(pitch.communicationId,'pitch-acme-1');
  for(const stage of ['REPLIED','DISCOVERY','PROPOSAL_SENT','WON'] as const)revenue.moveLead(lead,stage);
  const pkg=database.prepare("SELECT id FROM service_packages WHERE code='UGC_GROWTH'").get() as {id:number};
  const project=revenue.createClientProject(lead,pkg.id,'Acme Controller Launch');
  const intake=revenue.saveIntake(project,{clientBrand:'Acme',productInformation:'Wireless controller',targetCustomer:'Mobile gamers',customerPainPoint:'Touch controls',primaryBenefit:'Physical controls',approvedClaims:'Bluetooth compatible',prohibitedClaims:'Guaranteed wins',brandVoice:'Direct',cta:'Learn more',usageType:'ORGANIC',requestedUsageTerm:'90 days',revisionContact:'Pat',finalApprover:'Pat',portfolioPermission:'UNKNOWN',aiProductionPolicy:'AI-assisted editing allowed'});
  expect(intake.complete).toBe(true);
  return project;
}

describe('client revenue workflow',()=>{
  it('requires approval, respects pauses and prevents duplicate outreach',()=>{
    const {db,revenue}=setup();const lead=wonLead(revenue);const pitch=revenue.draftPitch(lead,'Personalized pitch.');
    expect(()=>revenue.recordPitchSent(pitch.communicationId,'pitch-1')).toThrow(/paused|approval/i);
    revenue.decideApproval(pitch.approvalId,'APPROVED','Owner approved.');
    setSetting(db,'outreach_paused',false);setSetting(db,'global_automation_paused',false);
    revenue.recordPitchSent(pitch.communicationId,'pitch-1');
    expect(()=>revenue.recordPitchSent(pitch.communicationId,'pitch-1')).toThrow(/duplicate/i);
  });

  it('emergency stop blocks an otherwise approved external action',()=>{
    const {db,revenue}=setup();const lead=wonLead(revenue);const pitch=revenue.draftPitch(lead,'Personalized pitch.');revenue.decideApproval(pitch.approvalId,'APPROVED','Owner approved.');setSetting(db,'outreach_paused',false);setSetting(db,'global_automation_paused',false);setSetting(db,'emergency_stop',true);
    expect(()=>revenue.recordPitchSent(pitch.communicationId,'pitch-stop')).toThrow(/emergency stop/i);
  });

  it('keeps add-on rights out of base packages and requires a quoted add-on',()=>{
    const {db,revenue}=setup();const project=clientProject(revenue,db);
    const agreement=revenue.createAgreement(project,{priceCents:39900,depositCents:19950,revisionRounds:1,turnaroundDays:7});
    expect((db.prepare('SELECT paid_ad_usage,perpetual_usage,raw_footage_ownership FROM agreements WHERE id=?').get(agreement) as any)).toMatchObject({paid_ad_usage:0,perpetual_usage:0,raw_footage_ownership:0});
    db.prepare('DELETE FROM agreements WHERE id=?').run(agreement);
    expect(()=>revenue.createAgreement(project,{priceCents:49900,depositCents:24950,revisionRounds:1,turnaroundDays:7,paidAdUsage:true})).toThrow(/PAID_AD_USAGE/);
    const addon=db.prepare("SELECT id FROM package_addons WHERE code='PAID_AD_USAGE'").get() as {id:number};
    revenue.addProjectAddon(project,addon.id,1,10000,{durationDays:90});
    const upgraded=revenue.createAgreement(project,{priceCents:49900,depositCents:24950,revisionRounds:1,turnaroundDays:7,paidAdUsage:true,usageExpires:'2026-12-31'});
    expect((db.prepare('SELECT paid_ad_usage FROM agreements WHERE id=?').get(upgraded) as any).paid_ad_usage).toBe(1);
  });

  it('runs a client project through QA, protected final delivery and follow-up',()=>{
    const {db,revenue}=setup();const project=clientProject(revenue,db);
    const agreement=revenue.createAgreement(project,{priceCents:39900,depositCents:39900,revisionRounds:1,turnaroundDays:7});revenue.acceptAgreement(agreement);
    const invoice=revenue.createInvoice(project,39900,'FULL');
    const item=revenue.createProductionItem(project,'Controller problem/solution','VERTICAL_VIDEO');
    revenue.moveProductionItem(item,'INTERNAL_QA');
    for(const type of ['CLAIM','DISCLOSURE','QUALITY'] as const)revenue.recordProjectCheck(project,item,type,true,[],{reviewed:true});
    const watermarked=revenue.addVersion(item,'manual://acme-draft-v1.mp4',true,'CLIENT_REVIEW','draft-checksum');
    setSetting(db,'delivery_paused',true);expect(()=>revenue.deliver(project,watermarked,'WATERMARKED_DRAFT','paused-draft')).toThrow(/paused/i);setSetting(db,'delivery_paused',false);
    const draftDelivery=revenue.deliver(project,watermarked,'WATERMARKED_DRAFT','delivery-draft-1');
    const revision=revenue.requestRevision(item,watermarked,'Use a tighter opening.');revenue.completeRevision(revision);
    const finalVersion=revenue.addVersion(item,'manual://acme-final-v2.mp4',false,'APPROVED','final-checksum');
    const finalApproval=revenue.requestApproval('FINAL_DELIVERY','PROJECT',project,'Release approved final file.','Client approved the revision.',{versionId:finalVersion},{risks:['Payment must be complete.']},'VANTAGE');revenue.decideApproval(finalApproval,'APPROVED','Final reviewed.');
    expect(()=>revenue.deliver(project,finalVersion,'FINAL_UNWATERMARKED','delivery-final-1')).toThrow(/payment/i);
    expect(()=>revenue.confirmPayment(invoice,40000,'payment-too-high')).toThrow(/exceeds/i);expect((db.prepare('SELECT COUNT(*) count FROM payments').get() as {count:number}).count).toBe(0);
    revenue.confirmPayment(invoice,39900,'payment-acme-1');
    expect(()=>revenue.confirmPayment(invoice,39900,'payment-acme-1')).toThrow(/duplicate/i);
    const finalDelivery=revenue.deliver(project,finalVersion,'FINAL_UNWATERMARKED','delivery-final-1');
    expect(()=>revenue.deliver(project,finalVersion,'FINAL_UNWATERMARKED','delivery-final-1')).toThrow(/duplicate/i);
    revenue.recordDownload(finalDelivery);revenue.addProductionMinutes(project,180);revenue.recordProjectExpense(project,2500,'Props and shipping');
    revenue.createFollowup(project,'TESTIMONIAL','Would you share a short testimonial?');revenue.createFollowup(project,'REPEAT_ORDER','Would you like to reserve the next three-video package?');
    const result=db.prepare('SELECT actual_revenue_cents,expense_cents,production_minutes,testimonial_status,repeat_order_status,status FROM projects WHERE id=?').get(project) as any;
    expect(result).toMatchObject({actual_revenue_cents:39900,expense_cents:2500,production_minutes:180,testimonial_status:'REQUESTED',repeat_order_status:'PROMPTED',status:'DELIVERED'});
    expect((db.prepare('SELECT receipt_code,download_count FROM deliveries WHERE id=?').get(finalDelivery) as any).download_count).toBe(1);
    expect((db.prepare('SELECT delivery_type FROM deliveries WHERE id=?').get(draftDelivery) as any).delivery_type).toBe('WATERMARKED_DRAFT');
  });

  it('enforces financial separation by project business type',()=>{
    const {db,revenue}=setup();const affiliate=Number(db.prepare("INSERT INTO projects(business_type,title,goal_json,status,created_at,updated_at) VALUES('AFFILIATE','Desk setup affiliate test','{\"primary\":\"confirmed commission\"}','ACTIVE',?,?)").run(now(),now()).lastInsertRowid);
    revenue.recordFinancialEntry(affiliate,'AFFILIATE','COMMISSION',1200,'CONFIRMED','Verified network commission');
    expect(()=>revenue.recordFinancialEntry(affiliate,'CLIENT_UGC','REVENUE',1200,'CONFIRMED','Wrong lane')).toThrow(/separation violation/i);
    expect((db.prepare("SELECT COUNT(*) count FROM financial_entries WHERE business_type='AFFILIATE'").get() as any).count).toBe(1);
  });

  it('blocks internal orchestration language from user-facing output',()=>{
    expect(sanitizeUserFacingOutput('Your final video is ready.').safe).toBe(true);
    expect(sanitizeUserFacingOutput('Raw tool output: hidden routing queue instructions').safe).toBe(false);
  });
});

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { dashboard,css } from './dashboard.js';
import { activity,setSetting,setting } from './db.js';
import type { UgcPipeline } from './pipeline.js';

async function body(req:IncomingMessage):Promise<URLSearchParams>{const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));return new URLSearchParams(Buffer.concat(chunks).toString());}
const redirect=(res:ServerResponse)=>{res.writeHead(303,{Location:'/'});res.end();};
export function createApp(db:DatabaseSync,pipeline:UgcPipeline){return createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self'; script-src 'self' 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'");
    if(req.method==='GET'&&url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(dashboard(db));return;}
    if(req.method==='GET'&&url.pathname==='/app.css'){res.setHeader('Content-Type','text/css');res.end(css);return;}
    if(req.method==='GET'&&url.pathname==='/api/health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,mode:setting(db,'publishing_mode','MANUAL_APPROVAL'),emergencyStop:setting(db,'emergency_stop',false)}));return;}
    if(req.method==='GET'&&url.pathname==='/api/state'){const tables=['products','content_ideas','creative_candidates','published_posts','performance_snapshots','experiments','agent_findings','compliance_checks','publishing_jobs','agent_activity','affiliate_programs'];const counts=Object.fromEntries(tables.map(table=>[table,(db.prepare(`SELECT COUNT(*) count FROM ${table}`).get() as {count:number}).count]));res.setHeader('Content-Type','application/json');res.end(JSON.stringify({counts}));return;}
    if(req.method==='POST'&&url.pathname.startsWith('/actions/')){const form=await body(req);const id=Number(form.get('id'));
      if(url.pathname==='/actions/mode'){const mode=String(form.get('mode'));if(!['OFF','MANUAL_APPROVAL','SCHEDULED','AUTONOMOUS'].includes(mode))throw new Error('Invalid publishing mode.');if(mode==='AUTONOMOUS')setSetting(db,'autonomous_explicitly_enabled',true);setSetting(db,'publishing_mode',mode);activity(db,'SYSTEM','MODE_CHANGED',`Publishing mode changed to ${mode} by a human dashboard action.`,{mode});}
      else if(url.pathname==='/actions/emergency-stop'){const active=form.get('active')==='true';setSetting(db,'emergency_stop',active);if(active)db.prepare("UPDATE publishing_jobs SET status='BLOCKED',skip_reason='MANUAL_HOLD',last_error='Emergency stop activated',updated_at=? WHERE status='PENDING'").run(new Date().toISOString());activity(db,'SYSTEM','EMERGENCY_STOP_CHANGED',active?'Emergency stop activated; pending jobs disabled.':'Emergency stop cleared by a human.',{active});}
      else if(url.pathname==='/actions/generate')await pipeline.generateCandidate(Number(form.get('ideaId')));
      else if(url.pathname==='/actions/variants')pipeline.scoutConcepts(Number(form.get('productId')));
      else if(url.pathname==='/actions/finding'){const disposition=String(form.get('disposition'));if(!['ACCEPT','QUESTION','IGNORE'].includes(disposition))throw new Error('Invalid finding disposition.');db.prepare('UPDATE agent_findings SET disposition=?,updated_at=? WHERE id=?').run(disposition,new Date().toISOString(),id);activity(db,'SYSTEM','FINDING_REVIEWED',`Finding ${id} marked ${disposition} by a human.`,{id,disposition});}
      else if(url.pathname==='/actions/approve')pipeline.approve(id);else if(url.pathname==='/actions/reject')pipeline.reject(id);else if(url.pathname==='/actions/hold')pipeline.hold(id);
      else if(url.pathname==='/actions/publish'){const job=pipeline.schedule(id);await pipeline.runJob(job);} else {res.writeHead(404);res.end('Not found');return;} redirect(res);return;
    }
    res.writeHead(404);res.end('Not found');
  }catch(error){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error instanceof Error?error.message:String(error)}));}
});}

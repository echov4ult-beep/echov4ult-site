import { describe,expect,it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { request as httpRequest } from 'node:http';
import { openDatabase } from '../src/db.js';
import { seedDatabase } from '../src/seed-data.js';
import { MockHiggsfieldClient,MockTikTokAnalytics,MockTikTokPublisher } from '../src/integrations.js';
import { UgcPipeline } from '../src/pipeline.js';
import { RevenueOps } from '../src/revenue.js';
import { createApp } from '../src/server.js';

describe('owner dashboard security',()=>{
  it('rejects missing CSRF tokens and accepts a same-origin protected form',async()=>{
    const db=openDatabase(':memory:');seedDatabase(db);
    const pipeline=new UgcPipeline(db,new MockHiggsfieldClient(),new MockTikTokPublisher(),new MockTikTokAnalytics());
    const server=createApp(db,pipeline,new RevenueOps(db));
    await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
    const port=(server.address() as AddressInfo).port,origin=`http://127.0.0.1:${port}`;
    try{
      const blocked=await fetch(`${origin}/actions/lead-create`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',origin},body:'company=Blocked'});
      expect(blocked.status).toBe(400);expect(await blocked.text()).toMatch(/action token/i);
      const rebound=await new Promise<{status:number;body:string}>((resolve,reject)=>{
        const request=httpRequest({hostname:'127.0.0.1',port,path:'/',headers:{Host:`attacker.example:${port}`,Origin:`http://attacker.example:${port}`}},response=>{const chunks:Buffer[]=[];response.on('data',chunk=>chunks.push(Buffer.from(chunk)));response.on('end',()=>resolve({status:response.statusCode||0,body:Buffer.concat(chunks).toString()}));});
        request.on('error',reject);request.end();
      });
      expect(rebound.status).toBe(400);expect(rebound.body).toMatch(/host is not allowed/i);
      const page=await (await fetch(origin)).text();const token=page.match(/const csrf="([a-f0-9]+)"/)?.[1];expect(token).toBeTruthy();
      const form=new URLSearchParams({_csrf:token!,company:'Temporary Test Brand',website:'https://test.invalid',productCategory:'technology',leadSource:'automated test',fitReason:'Ephemeral in-memory validation',estimatedDeal:'149',proposedConcept:'Test only'});
      const accepted=await fetch(`${origin}/actions/lead-create`,{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded',origin},body:form});
      expect(accepted.status).toBe(303);expect((db.prepare('SELECT COUNT(*) count FROM leads').get() as {count:number}).count).toBe(1);
      for(const key of ['production_paused','agents_paused','global_automation_paused']){
        const pause=new URLSearchParams({_csrf:token!,key,active:'true'});const response=await fetch(`${origin}/actions/pause`,{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded',origin},body:pause});expect(response.status).toBe(303);expect((db.prepare('SELECT value_json FROM settings WHERE key=?').get(key) as {value_json:string}).value_json).toBe('true');
      }
      expect((db.prepare("SELECT COUNT(*) count FROM audit_events WHERE event_type='PAUSE_CHANGED'").get() as {count:number}).count).toBe(3);
      const autonomy=new URLSearchParams({_csrf:token!,mode:'AUTONOMOUS'});
      const refused=await fetch(`${origin}/actions/mode`,{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded',origin},body:autonomy});
      expect(refused.status).toBe(400);expect(await refused.text()).toMatch(/separate governed promotion/i);
      expect((db.prepare("SELECT value_json FROM settings WHERE key='autonomous_explicitly_enabled'").get() as {value_json:string}).value_json).toBe('false');
    }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));db.close();}
  });
});

import { describe,expect,it } from 'vitest';
import type { AddressInfo } from 'node:net';
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
      const page=await (await fetch(origin)).text();const token=page.match(/const csrf="([a-f0-9]+)"/)?.[1];expect(token).toBeTruthy();
      const form=new URLSearchParams({_csrf:token!,company:'Temporary Test Brand',website:'https://test.invalid',productCategory:'technology',leadSource:'automated test',fitReason:'Ephemeral in-memory validation',estimatedDeal:'149',proposedConcept:'Test only'});
      const accepted=await fetch(`${origin}/actions/lead-create`,{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded',origin},body:form});
      expect(accepted.status).toBe(303);expect((db.prepare('SELECT COUNT(*) count FROM leads').get() as {count:number}).count).toBe(1);
    }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));db.close();}
  });
});

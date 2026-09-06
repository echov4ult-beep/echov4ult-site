import {afterEach,describe,expect,it} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../src/db.js';

const folders:string[]=[];
afterEach(()=>{for(const folder of folders.splice(0))rmSync(folder,{recursive:true,force:true});});

describe('database migrations',()=>{
  it('fails closed when migration history has a gap',()=>{
    const folder=mkdtempSync(join(tmpdir(),'ugc-command-db-'));folders.push(folder);
    const path=join(folder,'gapped.db'),db=new DatabaseSync(path);
    db.exec('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
    db.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES(?,?)').run(7,new Date().toISOString());
    db.close();
    expect(()=>openDatabase(path)).toThrow(/migration history is incomplete or unknown/i);
  });

  it('installs the dashboard query indexes',()=>{
    const db=openDatabase(':memory:');
    try{
      const indexes=(db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all() as {name:string}[]).map(row=>row.name);
      expect(indexes).toEqual(expect.arrayContaining(['idx_communications_lead','idx_invoices_project_status','idx_payments_invoice_status']));
    }finally{db.close();}
  });
});

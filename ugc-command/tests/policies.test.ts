import { describe,expect,it } from 'vitest';
import { claimFirewall,complianceGate,decideSkip,publishingGate } from '../src/policies.js';
import type { CandidateDraft } from '../src/types.js';
const base:CandidateDraft={caption:'#ad factual caption',overlayText:['#advertisement'],script:'GameSir lists this controller as compatible with supported phones.',factualClaims:[{text:'Compatible with supported phones',evidenceId:1}],monetized:true,requiresBurnedInDisclosure:true,affiliateUrl:'https://www.amazon.com/dp/X?tag=echo-20',programType:'AMAZON'};
describe('experience claim firewall',()=>{
  it.each(["I've been using it","I tested it","I love it","It feels better","my favorite","I noticed lag","after using it","this fixed my setup"])("blocks %s when unverified",phrase=>expect(claimFirewall({...base,script:phrase},'UNVERIFIED',new Set([1])).passed).toBe(false));
  it('allows sourced factual language',()=>expect(claimFirewall(base,'UNVERIFIED',new Set([1])).passed).toBe(true));
  it('requires every factual claim to map to product evidence',()=>expect(claimFirewall({...base,factualClaims:[{text:'Unsupported'}]},'PHYSICALLY_TESTED',new Set([1])).passed).toBe(false));
});
describe('affiliate compliance',()=>{
  it('passes conspicuous caption and burned-in disclosures',()=>expect(complianceGate(base).passed).toBe(true));
  it('blocks buried caption disclosure',()=>expect(complianceGate({...base,caption:'Buy it now #ad'}).reasons[0]).toContain('start'));
  it('blocks missing first-frame disclosure',()=>expect(complianceGate({...base,overlayText:['Product shot']}).passed).toBe(false));
  it('blocks an untagged Amazon URL',()=>expect(complianceGate({...base,affiliateUrl:'https://amazon.com/dp/X'}).passed).toBe(false));
});
describe('skip logic',()=>{it('prioritizes hard gates',()=>{expect(decideSkip({claimPassed:false,compliancePassed:false,score:99,duplicate:false})).toBe('CLAIM_RISK');expect(decideSkip({claimPassed:true,compliancePassed:false,score:99,duplicate:false})).toBe('COMPLIANCE_FAILURE');});it('skips weak work and allows strong work',()=>{expect(decideSkip({claimPassed:true,compliancePassed:true,score:39,duplicate:false})).toBe('LOW_QUALITY');expect(decideSkip({claimPassed:true,compliancePassed:true,score:85,duplicate:false})).toBeNull();});});
describe('publishing enforcement',()=>{const allowed={mode:'MANUAL_APPROVAL' as const,emergencyStop:false,approved:true,due:true,lifecycle:'LEARNING' as const,postsInLast24Hours:0,accountAgeDays:10,autonomousExplicitlyEnabled:false};it('allows approved due work',()=>expect(publishingGate(allowed).passed).toBe(true));it('kill switch overrides approval',()=>expect(publishingGate({...allowed,emergencyStop:true}).passed).toBe(false));it('requires explicit autonomous toggle',()=>expect(publishingGate({...allowed,mode:'AUTONOMOUS'}).passed).toBe(false));it('enforces lifecycle caps',()=>expect(publishingGate({...allowed,postsInLast24Hours:1}).passed).toBe(false));});

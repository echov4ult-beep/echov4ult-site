import type { CandidateDraft, EvidenceState, Lifecycle, PublishingMode, SkipReason } from './types.js';

export interface GateResult { passed: boolean; reasons: string[]; evidence: Record<string, unknown> }

const experiencePatterns = [
  /\bi(?:'ve| have) been using\b/i, /\bi tested\b/i, /\bi love\b/i, /\bfeels?\b/i,
  /\bmy favou?rite\b/i, /\bi noticed\b/i, /\bafter using\b/i, /\bthis fixed my\b/i,
  /\bin my experience\b/i, /\bworks? for me\b/i
];

export function claimFirewall(draft: CandidateDraft, evidenceState: EvidenceState, validEvidenceIds: Set<number>): GateResult {
  const fullText = [draft.caption, draft.script, ...draft.overlayText].join('\n');
  const reasons: string[] = [];
  if (evidenceState === 'UNVERIFIED') {
    const matches = experiencePatterns.filter(pattern => pattern.test(fullText)).map(pattern => pattern.source);
    if (matches.length) reasons.push(`Experiential language is blocked for an UNVERIFIED product (${matches.length} match${matches.length === 1 ? '' : 'es'}).`);
  }
  for (const claim of draft.factualClaims) {
    if (!claim.evidenceId) reasons.push(`Factual claim has no evidence mapping: ${claim.text}`);
    else if (!validEvidenceIds.has(claim.evidenceId)) reasons.push(`Factual claim maps to missing or wrong-product evidence: ${claim.text}`);
  }
  return { passed: reasons.length === 0, reasons, evidence: { evidenceState, factualClaimCount: draft.factualClaims.length, mappedEvidenceIds: [...validEvidenceIds] } };
}

export function complianceGate(draft: CandidateDraft): GateResult {
  const reasons: string[] = [];
  const caption = draft.caption.trim();
  if (draft.monetized && !/^(#ad|\(ad\))(?:\s|$)/i.test(caption)) reasons.push('Monetized caption must start with #ad or (ad).');
  const firstOverlay = draft.overlayText[0]?.trim() || '';
  if (draft.monetized && draft.requiresBurnedInDisclosure && !/^#advertisement(?:\s|$)/i.test(firstOverlay)) reasons.push('Required #advertisement overlay must be present from the first frame.');
  if (draft.affiliateUrl) {
    let url: URL | undefined;
    try { url = new URL(draft.affiliateUrl); } catch { reasons.push('Affiliate URL is invalid.'); }
    if (url && draft.programType === 'AMAZON') {
      if (!/(^|\.)amazon\.[a-z.]+$/i.test(url.hostname)) reasons.push('Amazon program must use a direct Amazon URL.');
      if (!url.searchParams.get('tag')) reasons.push('Amazon URL is missing an Associates tag.');
      if (url.pathname.startsWith('/go/')) reasons.push('Amazon links may never use /go/.');
    }
    if (url && draft.programType !== 'AMAZON' && /(^|\.)amazon\.[a-z.]+$/i.test(url.hostname)) reasons.push('Amazon destination must be declared as AMAZON.');
  }
  return { passed: reasons.length === 0, reasons, evidence: { captionPrefix: caption.slice(0, 18), firstOverlay, monetized: draft.monetized } };
}

export interface PublishContext {
  mode: PublishingMode; emergencyStop: boolean; approved: boolean; due: boolean;
  lifecycle: Lifecycle; postsInLast24Hours: number; accountAgeDays: number; autonomousExplicitlyEnabled: boolean;
}

const caps: Record<Lifecycle, number> = { COLD_START: 0, LEARNING: 1, GROWTH: 1, SCALE: 2 };
export function publishingGate(context: PublishContext): GateResult {
  const reasons: string[] = [];
  if (context.emergencyStop) reasons.push('Emergency stop is active.');
  if (context.mode === 'OFF') reasons.push('Publishing mode is OFF.');
  if (!context.due) reasons.push('Publishing job is not due.');
  if (context.mode === 'MANUAL_APPROVAL' && !context.approved) reasons.push('Manual approval is required.');
  if (context.mode === 'AUTONOMOUS' && !context.autonomousExplicitlyEnabled) reasons.push('Autonomous mode has not been explicitly enabled by a human.');
  const cap = context.lifecycle === 'COLD_START' && context.accountAgeDays >= 4 ? 1 : caps[context.lifecycle];
  if (context.postsInLast24Hours >= cap) reasons.push(`Lifecycle cap reached (${cap} post${cap === 1 ? '' : 's'} per 24 hours).`);
  return { passed: reasons.length === 0, reasons, evidence: { ...context, cap } };
}

export function decideSkip(input: { claimPassed: boolean; compliancePassed: boolean; score: number; duplicate: boolean; generationFailed?: boolean; platformFailed?: boolean; held?: boolean }): SkipReason | null {
  if (input.held) return 'MANUAL_HOLD';
  if (!input.claimPassed) return 'CLAIM_RISK';
  if (!input.compliancePassed) return 'COMPLIANCE_FAILURE';
  if (input.duplicate) return 'DUPLICATE';
  if (input.generationFailed) return 'GENERATION_FAILURE';
  if (input.platformFailed) return 'PLATFORM_ERROR';
  if (input.score < 60) return input.score < 40 ? 'LOW_QUALITY' : 'LOW_CONFIDENCE';
  return null;
}

export function requireApprovedExternalAction(input:{approvalStatus?:string;emergencyStop:boolean;paused:boolean;idempotencyExists:boolean}):GateResult{
  const reasons:string[]=[];
  if(input.emergencyStop)reasons.push('Emergency stop is active.');
  if(input.paused)reasons.push('This external-action lane is paused.');
  if(input.approvalStatus!=='APPROVED')reasons.push('Explicit human approval is required.');
  if(input.idempotencyExists)reasons.push('Duplicate external action blocked by idempotency key.');
  return{passed:reasons.length===0,reasons,evidence:{approvalStatus:input.approvalStatus||'MISSING',emergencyStop:input.emergencyStop,paused:input.paused,idempotencyExists:input.idempotencyExists}};
}

export function validateBaseUsageRights(input:{paidAdUsage:boolean;perpetualUsage:boolean;rawFootageOwnership:boolean;categoryExclusivity:boolean;competitorExclusivity:boolean}):GateResult{
  const included=Object.entries(input).filter(([,value])=>value).map(([key])=>key);
  return{passed:included.length===0,reasons:included.map(key=>`${key} is an add-on right and cannot be silently included in a base package.`),evidence:{included}};
}

const internalOutputPatterns:[string,RegExp][]=[
  ['chain-of-thought',/\b(chain[- ]of[- ]thought|hidden reasoning|private reasoning)\b/i],
  ['scratchpad',/\b(scratchpad|internal monologue)\b/i],
  ['routing',/\b(subagent_type|route this to agent|agent routing|queue instructions?)\b/i],
  ['system-prompt',/\b(system prompt|hidden prompt)\b/i],
  ['raw-tool',/\b(raw tool (?:response|output)|tool_call|tool result:)\b/i]
];
export function sanitizeUserFacingOutput(value:string):{safe:boolean;text:string;blockedReasons:string[]}{
  const blockedReasons=internalOutputPatterns.filter(([,pattern])=>pattern.test(value)).map(([name])=>name);
  return{safe:blockedReasons.length===0,text:blockedReasons.length===0?value:'',blockedReasons};
}

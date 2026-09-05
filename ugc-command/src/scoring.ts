import type { CandidateDraft, CreativeDimensions, OpportunityDimensions } from './types.js';

const clamp10 = (value: number) => Math.max(0, Math.min(10, value));
const opportunityWeights: Record<keyof OpportunityDimensions, number> = {
  visualTransformation: 8, tiktokDemoPotential: 9, problemClarity: 8, price: 4, impulsePotential: 6,
  commissionPercent: 4, expectedCommission: 5, brandRecognition: 4, competition: 4, saturation: 5,
  audienceSize: 7, creativeAssets: 5, realFootage: 8, claimComplianceRisk: 8, angleCount: 6,
  adjacentExpansion: 5, conversionFriction: 4
};
const opportunityInverted = new Set<keyof OpportunityDimensions>(['competition','saturation','claimComplianceRisk','conversionFriction']);

export function scoreOpportunity(input: OpportunityDimensions): { total: number; dimensions: OpportunityDimensions; contributions: Record<string, number> } {
  const dimensions = Object.fromEntries(Object.entries(input).map(([key,value]) => [key, clamp10(value)])) as unknown as OpportunityDimensions;
  const weightTotal = Object.values(opportunityWeights).reduce((a,b) => a+b,0);
  const contributions: Record<string,number> = {};
  let total = 0;
  for (const key of Object.keys(opportunityWeights) as (keyof OpportunityDimensions)[]) {
    const normalized = opportunityInverted.has(key) ? 10 - dimensions[key] : dimensions[key];
    contributions[key] = Number((normalized * opportunityWeights[key] / weightTotal * 10).toFixed(2));
    total += contributions[key]!;
  }
  return { total: Number(total.toFixed(1)), dimensions, contributions };
}

const positiveCreative: (keyof CreativeDimensions)[] = ['firstFrame','hook','clarity','curiosity','movement','productVisibility','nativeFeel','retentionPotential','payoff','credibility','cta','novelty','compliance'];
const penalties: (keyof CreativeDimensions)[] = ['adLikePenalty','repetitionPenalty','claimRisk','similarityPenalty'];
export function scoreCreative(input: CreativeDimensions): number {
  const positive = positiveCreative.reduce((sum,key) => sum + clamp10(input[key]), 0) / positiveCreative.length * 10;
  const penalty = penalties.reduce((sum,key) => sum + clamp10(input[key]), 0) / penalties.length * 3;
  return Number(Math.max(0, Math.min(100, positive - penalty)).toFixed(1));
}

const slopRules: [string, RegExp][] = [
  ['you-need-this', /\byou need this\b/i], ['must-have', /\bmust[- ]have\b/i],
  ['generic-hype', /\b(game[- ]?changer|revolutionary|insane|obsessed)\b/i],
  ['unsupported-superlative', /\b(best|perfect|ultimate|greatest)\b/i],
  ['fabricated-experience', /\b(i tested|i love|i(?:'ve| have) been using|my favorite)\b/i]
];
export function detectSlop(draft: CandidateDraft): string[] {
  const text = [draft.caption,draft.script,...draft.overlayText].join(' ');
  const flags = slopRules.filter(([,rule]) => rule.test(text)).map(([name]) => name);
  const emojiCount = [...text].filter(char => /\p{Extended_Pictographic}/u.test(char)).length;
  if (emojiCount > 3) flags.push('emoji-spam');
  if (/^(buy|shop|get yours|link in bio)\b/i.test(draft.script.trim())) flags.push('sales-language-first-second');
  const hook = draft.script.split(/[.!?\n]/)[0]?.trim().toLowerCase();
  if (hook && draft.previousHooks?.some(item => item.trim().toLowerCase() === hook)) flags.push('repeated-hook');
  return [...new Set(flags)];
}

export interface ConceptFactor { productId: number; hook: string; angle: string; format: string; cta: string; priorSamples: number; uncertainty: number; qualityPrior: number }
export function selectConcepts(factors: ConceptFactor[], requested: number, rateLimit: number): ConceptFactor[] {
  const allowed = [1,3,5,10].includes(requested) ? requested : 5;
  const count = Math.min(allowed, Math.max(0, rateLimit));
  return [...factors].map(item => ({ item, value: item.uncertainty * 0.6 + item.qualityPrior * 0.25 + (item.priorSamples === 0 ? 1.5 : 1 / Math.sqrt(item.priorSamples)) * 0.15 }))
    .sort((a,b) => b.value-a.value).slice(0,count).map(({item}) => item);
}

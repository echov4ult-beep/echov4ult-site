import { createHash } from 'node:crypto';
import type { CandidateDraft } from './types.js';

export interface GeneratedVideo { uri: string; providerJobId: string; mock: boolean }
export interface PublishResult { platformPostId: string; shareUrl: string; mock: boolean }
export interface AnalyticsResult { metrics: Record<string, number | null>; unavailable: string[]; source: string }
export interface HiggsfieldClient { generate(draft: CandidateDraft): Promise<GeneratedVideo> }
export interface TikTokPublisher { publish(input: { videoUri: string; caption: string; idempotencyKey: string }): Promise<PublishResult> }
export interface TikTokAnalytics { snapshot(platformPostId: string): Promise<AnalyticsResult> }
export interface AffiliateLinks { validate(input: { url: string; programType: string }): { valid: boolean; reasons: string[] } }
export interface PaymentConfirmationProvider { validate(input:{amountCents:number;idempotencyKey:string}):{provider:string;valid:boolean;reasons:string[]} }

const digest = (value: string) => createHash('sha256').update(value).digest('hex').slice(0,16);
export class MockHiggsfieldClient implements HiggsfieldClient {
  async generate(draft: CandidateDraft): Promise<GeneratedVideo> {
    const id = digest(draft.script); return { uri: `mock://generated/${id}.mp4`, providerJobId: `mock-gen-${id}`, mock: true };
  }
}
export class MockTikTokPublisher implements TikTokPublisher {
  async publish(input: { videoUri: string; caption: string; idempotencyKey: string }): Promise<PublishResult> {
    const id = digest(input.idempotencyKey); return { platformPostId: `mock-post-${id}`, shareUrl: `mock://tiktok/${id}`, mock: true };
  }
}
export class MockTikTokAnalytics implements TikTokAnalytics {
  async snapshot(): Promise<AnalyticsResult> {
    return { metrics: { views: null, likes: null, comments: null, shares: null, saves: null, watch_time: null, completion: null, profile_visits: null, clicks: null, conversions: null, revenue: null, commission: null, rpm: null, follower_gain: null }, unavailable: ['views','likes','comments','shares','saves','watch_time','completion','profile_visits','clicks','conversions','revenue','commission','rpm','follower_gain'], source: 'MOCK_NO_DATA' };
  }
}
export class ComplianceAffiliateLinks implements AffiliateLinks {
  validate(input: { url: string; programType: string }) {
    const reasons: string[] = [];
    try {
      const url = new URL(input.url);
      if (input.programType === 'AMAZON' && (!/(^|\.)amazon\.[a-z.]+$/i.test(url.hostname) || !url.searchParams.has('tag'))) reasons.push('Amazon link must be a raw tagged Amazon URL.');
      if (input.programType !== 'AMAZON' && url.pathname.startsWith('/go/') && url.origin !== 'https://echov4ult.com') reasons.push('/go/ links must use echov4ult.com.');
    } catch { reasons.push('Invalid URL.'); }
    return { valid: reasons.length === 0, reasons };
  }
}

export class ManualPaymentConfirmationProvider implements PaymentConfirmationProvider {
  validate(input:{amountCents:number;idempotencyKey:string}){
    const reasons:string[]=[];
    if(!Number.isInteger(input.amountCents)||input.amountCents<=0)reasons.push('Payment amount must be a positive number of cents.');
    if(!input.idempotencyKey.trim())reasons.push('A bank or provider receipt identifier is required.');
    return{provider:'MANUAL',valid:reasons.length===0,reasons};
  }
}

export class UnconfiguredHiggsfieldClient implements HiggsfieldClient { async generate(): Promise<never> { throw new Error('Real Higgsfield integration is not configured; no generation was submitted.'); } }
export class UnconfiguredTikTokPublisher implements TikTokPublisher { async publish(): Promise<never> { throw new Error('TikTok Content Posting API is not configured; no post was submitted.'); } }
export class UnconfiguredTikTokAnalytics implements TikTokAnalytics { async snapshot(): Promise<never> { throw new Error('TikTok analytics integration is not configured; no metrics were fabricated.'); } }

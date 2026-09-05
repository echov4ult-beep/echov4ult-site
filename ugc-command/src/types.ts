export type PublishingMode = 'OFF' | 'MANUAL_APPROVAL' | 'SCHEDULED' | 'AUTONOMOUS';
export type Lifecycle = 'COLD_START' | 'LEARNING' | 'GROWTH' | 'SCALE';
export type EvidenceState = 'UNVERIFIED' | 'PHYSICALLY_TESTED';
export type SkipReason = 'LOW_QUALITY' | 'COMPLIANCE_FAILURE' | 'CLAIM_RISK' | 'DUPLICATE' | 'NO_GOOD_PRODUCT' | 'GENERATION_FAILURE' | 'PLATFORM_ERROR' | 'LOW_CONFIDENCE' | 'MANUAL_HOLD';
export type ExperimentTag = 'CONTROL' | 'ITERATION' | 'EXPERIMENT';
export type FindingDisposition = 'PENDING' | 'ACCEPT' | 'QUESTION' | 'IGNORE';
export type MoneyStatus = 'ESTIMATED' | 'PENDING' | 'CONFIRMED';
export type BusinessType = 'CLIENT_UGC' | 'AFFILIATE' | 'PORTFOLIO' | 'EXPERIMENT';
export type LeadStage = 'DISCOVERED' | 'QUALIFIED' | 'PITCH_DRAFTED' | 'AWAITING_APPROVAL' | 'PITCH_SENT' | 'FOLLOW_UP_DUE' | 'REPLIED' | 'DISCOVERY' | 'PROPOSAL_SENT' | 'NEGOTIATION' | 'WON' | 'LOST' | 'NURTURE';
export type ApprovalType = 'PROSPECT_OUTREACH' | 'FOLLOW_UP_MESSAGE' | 'PRICING_DISCOUNT' | 'CONTRACT_TERMS' | 'PRODUCT_CLAIM' | 'CREATIVE_BRIEF' | 'FINAL_SCRIPT' | 'CLIENT_DRAFT' | 'FINAL_DELIVERY' | 'PUBLISHING' | 'AFFILIATE_LINK' | 'COMPLIANCE_EXCEPTION' | 'PAYMENT_OVERRIDE';

export interface FactualClaim { text: string; evidenceId?: number }
export interface CandidateDraft {
  caption: string;
  overlayText: string[];
  script: string;
  factualClaims: FactualClaim[];
  monetized: boolean;
  requiresBurnedInDisclosure: boolean;
  affiliateUrl?: string;
  programType?: 'AMAZON' | 'DIRECT' | 'TIKTOK_SHOP';
  previousHooks?: string[];
}

export interface OpportunityDimensions {
  visualTransformation: number; tiktokDemoPotential: number; problemClarity: number;
  price: number; impulsePotential: number; commissionPercent: number;
  expectedCommission: number; brandRecognition: number; competition: number;
  saturation: number; audienceSize: number; creativeAssets: number;
  realFootage: number; claimComplianceRisk: number; angleCount: number;
  adjacentExpansion: number; conversionFriction: number;
}

export interface CreativeDimensions {
  firstFrame: number; hook: number; clarity: number; curiosity: number; movement: number;
  productVisibility: number; nativeFeel: number; retentionPotential: number; payoff: number;
  credibility: number; cta: number; novelty: number; adLikePenalty: number;
  repetitionPenalty: number; claimRisk: number; compliance: number; similarityPenalty: number;
}

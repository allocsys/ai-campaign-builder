export interface BusinessProfile {
  name: string;
  categoryLabel: string;
  phone: string;
  sizeTier: 'micro' | 'small' | 'medium' | 'large';
  smsWalletBalanceToman: number;
  smsMonthlyCapToman: number | null;
}

export interface ChecklistItem {
  key: string;
  label: string;
  completed: boolean;
}

export interface CampaignTask {
  name: string;
  pattern: string;
  points: number;
}

export interface CampaignReward {
  name: string;
  threshold: number;
}

export interface Campaign {
  status: 'active' | 'draft' | 'ended';
  goal: 'acquisition' | 'retention';
  pointMultiplier: number;
  startDate: string;
  endDate: string;
  tasks: CampaignTask[];
  rewards: CampaignReward[];
}

export interface Insight {
  id: string;
  cadence: 'daily' | 'weekly' | 'anomaly';
  message: string;
}

export interface SuggestedChange {
  id: string;
  riskTier: 'low' | 'high';
  changeType: string;
  rationale: string;
  status: 'pending' | 'applied' | 'dismissed';
}

export interface AutopilotState {
  enabled: boolean;
  manualApplyCount: number;
  eligibilityThreshold: number;
}

export interface MicrositeModule {
  key: string;
  labelFa: string;
  enabled: boolean;
}

export interface MicrositeState {
  published: boolean;
  templateName: string;
  subdomainSlug: string;
  modules: MicrositeModule[];
}

export interface Subscription {
  tier: string;
  monthlyPriceToman: number;
  status: string;
  currentPeriodEnd: string;
}

export interface SendLogEntry {
  id: string;
  contact: string;
  channel: 'sms' | 'telegram';
  trigger: string;
  status: 'sent' | 'skipped' | 'failed';
  sentAt: string;
}

export interface AuthUserProfile {
  id: string;
  phone: string;
  role: string;
}

// ============================================================================
// Customer persona
// Shapes match apps/backend/src/routes/customer.ts's JSON responses exactly.
// ============================================================================

export interface CustomerProfile {
  businessName: string;
  personalCode: string;
  qrPayload: string;
  pointsBalance: number;
  referralCount: number;
  maxReferralCap: number;
  carryoverBonus: number;
  telegramOptedIn: boolean;
}

export type CustomerTaskVerificationMethod =
  | 'screenshot_ai'
  | 'code_link_auto'
  | 'pos_scan'
  | 'receipt_claim';

export type CustomerTaskStatus = 'pending' | 'approved' | null;

export interface CustomerTask {
  id: string;
  title: string;
  instruction: string;
  verificationMethod: CustomerTaskVerificationMethod;
  pointsValue: number;
  status: CustomerTaskStatus;
}

export interface CustomerReward {
  id: string;
  title: string;
  thresholdPoints: number;
  unlocked: boolean;
}

export interface CustomerNotification {
  id: string;
  channel: 'sms' | 'telegram';
  trigger: string;
  text: string;
  sentAt: string;
}

export interface SubmitTaskResponse {
  submissionId: string;
  status: 'pending';
}

export interface SimulateAiApproveResponse {
  status: 'approved';
  pointsAwarded: number;
}

export interface RedeemRewardResponse {
  redemptionId: string;
  redemptionCode: string;
  expiresAt: string;
}

export interface TelegramOptInResponse {
  telegramOptedIn: boolean;
}

export type RetroClaimFailureReason = 'outside_time_window' | 'duplicate_receipt' | 'rate_limited';

export interface RetroClaim {
  id: string;
  receiptHash: string;
  receiptNumber: string;
  hoursAgo: number;
  submittedAt: string;
  status: 'pending';
}

export type RetroClaimResponse =
  | { success: true; claim: RetroClaim }
  | { success: false; reason: RetroClaimFailureReason };

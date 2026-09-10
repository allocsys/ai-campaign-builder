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

export interface StaffMember {
  id: string;
  name: string;
  phone: string;
  phoneVerified: boolean;
  active: boolean;
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
  /** Present on staff-role verify-otp responses; scopes the staff member to a business. */
  businessId?: string;
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

// ============================================================================
// Staff POS persona
// Shapes match apps/backend/src/routes/staff-pos.ts's JSON responses exactly.
// ============================================================================

export interface StaffPosCustomerLookupResponse {
  personalCode: string;
  name: string;
  pointsBalance: number;
  campaignId: string;
}

export interface StaffPosLogPurchaseRequest {
  personalCode: string;
  amountToman?: number;
  idempotencyKey?: string;
}

export interface StaffPosLogPurchaseResponse {
  status: 'synced' | 'duplicate_skipped';
  submissionId?: string;
  pointsAwarded?: number;
  loggedBy?: string;
}

export interface StaffPosRedemptionResponse {
  code: string;
  rewardTitle: string;
  customerName: string;
  customerCode: string;
  pointsDeducted: number;
  status: 'pending' | 'fulfilled' | 'cancelled';
  expired: boolean;
}

export interface StaffPosFulfillRedemptionResponse {
  code: string;
  rewardTitle: string;
  customerName: string;
  customerCode: string;
  pointsDeducted: number;
  status: 'fulfilled';
}

export interface OfflineQueueItemIn {
  id: string;
  idempotencyKey: string;
  personalCode: string;
  actionType: 'purchase' | 'fulfill_reward';
  amountToman?: number;
  redemptionCode?: string;
}

export interface StaffPosSyncRequest {
  items?: OfflineQueueItemIn[];
}

export interface StaffPosSyncResultItem {
  itemId: string;
  idempotencyKey: string;
  actionType: 'purchase' | 'fulfill_reward';
  status: 'synced' | 'duplicate_skipped' | 'invalid_skipped';
  pointsAwarded?: number;
  reason: string;
}

export interface StaffPosSyncResponse {
  results: StaffPosSyncResultItem[];
}

// ============================================================================
// Review Console persona
// Shapes match apps/backend/src/routes/review.ts's JSON responses exactly.
// ============================================================================

export type ReviewSubmissionType = 'screenshot' | 'receipt_claim';
export type ReviewSubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface ReviewSubmission {
  id: string;
  customerName: string;
  taskTitle: string;
  submissionType: ReviewSubmissionType;
  evidenceUrl: string | null;
  receiptNumber: string | null;
  aiConfidenceScore: number | null;
  status: ReviewSubmissionStatus;
  reviewedBy: string | null;
  pointsAwarded: number | null;
  submittedAt: string;
  taskPointsValue: number;
}

export interface ResolveSubmissionResponse {
  id: string;
  status: 'approved' | 'rejected';
  pointsAwarded: number;
}

export interface ReferrerAggregate {
  codeId: string;
  referrerName: string;
  personalCode: string;
  referralCount24h: number;
  deadReferralCount: number;
}

export type ReferralFlagRule = 'velocity' | 'dead_referral_ratio';
export type ReferralFlagStatus = 'open' | 'reviewed' | 'dismissed';

export interface ReferralFlag {
  id: string;
  referrerName: string;
  ruleTriggered: ReferralFlagRule;
  ruleNameFa: string;
  description: string;
  triggeredAt: string;
  status: ReferralFlagStatus;
  notes: string;
}

export interface RunDetectionResponse {
  flags: ReferralFlag[];
  addedCount: number;
}

export interface ResolveFlagResponse {
  id: string;
  status: 'reviewed' | 'dismissed';
  notes: string;
}

export type StaffPosActivityEntry =
  | {
      id: string;
      type: 'purchase';
      customerCode: string;
      amountToman: number | null;
      pointsAwarded: number;
      createdAt: string;
      status: 'synced';
    }
  | {
      id: string;
      type: 'fulfill';
      customerCode: string;
      rewardTitle: string;
      pointsDeducted: number;
      createdAt: string;
      status: 'synced';
    };

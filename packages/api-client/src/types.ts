export interface BusinessProfile {
  name: string;
  categoryLabel: string;
  phone: string;
  sizeTier: 'micro' | 'small' | 'medium' | 'large';
  smsWalletBalanceToman: number;
  smsMonthlyCapToman: number | null;
  /** plan.md Open Item 9 -- auto-fills the microsite Contact module when set. */
  address: string;
  /**
   * plan.md Item 16 Step E -- "حالت حرفه‌ای" (Professional Mode). Gates the
   * owner's own access to the manual campaign editor. Self-serve toggle via
   * PUT /profile, OR settable by review_admin on the owner's behalf (see
   * AdminBusinessListItem.manualEditorEnabled). review_admin's own editor
   * access is unconditional regardless of this flag.
   */
  manualEditorEnabled: boolean;
}

/**
 * Aggregate lifetime stats for the dashboard overview panel.
 * Backend endpoint (GET /api/business/stats) doesn't exist yet -- this type
 * and getBusinessStats() are added frontend-first so the UI is ready; until
 * the endpoint ships, getBusinessStats() 404s and DashboardTab hides the
 * stats row rather than erroring the whole page. See plan.md open items.
 */
export interface BusinessStats {
  totalMembers: number;
  totalPointsIssued: number;
  rewardsRedeemed: number;
  conversionRatePercent: number;
}

export interface ChecklistItem {
  key: string;
  label: string;
  completed: boolean;
}

export interface CampaignTask {
  /**
   * plan.md Item 16 Step E -- always present on a GET response (the DB row's
   * real primary key). Optional on a PUT body: the manual editor round-trips
   * existing ids and omits it for newly-added rows; the backend ignores
   * whatever id is sent either way, since tasks/rewards are still saved as a
   * whole-array replace (fresh ids assigned server-side on every save).
   */
  id?: string;
  name: string;
  pattern: string;
  points: number;
}

export interface CampaignReward {
  /** Same id semantics as CampaignTask.id -- see that field's doc comment. */
  id?: string;
  name: string;
  pattern: string;
  threshold: number;
}

export interface Campaign {
  status: 'active' | 'draft' | 'ended';
  goal: 'acquisition' | 'retention' | 'acquisition_retention';
  pointMultiplier: number;
  startDate: string;
  endDate: string;
  tasks: CampaignTask[];
  rewards: CampaignReward[];
}

// ============================================================================
// Onboarding wizard / AI campaign generation (plan.md Open Item 8)
// Shapes match apps/backend/src/routes/business.ts's POST /campaign/generate.
// ============================================================================

/** The 6 v1 business category slugs (business_categories.slug in the DB). */
export type BusinessCategorySlug =
  | 'coffee_shop'
  | 'clothing'
  | 'restaurant'
  | 'online_store'
  | 'gym'
  | 'beauty_clinic';

/** The 6 reward_patterns.name values -- the wizard's Step 4 dropdown options. */
export type RewardPatternName =
  | 'percentage_discount'
  | 'free_item'
  | 'free_shipping'
  | 'vip_tier'
  | 'promo_item'
  | 'early_access';

export interface GenerateCampaignRequest {
  businessName: string;
  /** plan.md Open Item 9 -- optional; omitted/empty leaves any existing businesses.address untouched. */
  businessAddress?: string;
  categorySlug: BusinessCategorySlug;
  goal: 'acquisition' | 'retention' | 'acquisition_retention';
  audienceDescription: string;
  /** Daily walk-in/existing-customer count -- always provided, average of the wizard's range-slider selection (plan.md "Signal model revised again", 2026-09-12). */
  dailyCustomerCount: number;
  monthlyRevenueToman: number;
  /** Optional -- null unless the owner checked "has an Instagram page" and entered a count. Not every business has a page. */
  followerCount: number | null;
  /** Optional -- may be empty; only ever feeds LLM copy generation, never the deterministic reward/points math. */
  offerDescription: string;
  /** At least one reward_pattern; one reward tier is generated per selected pattern (min 2 tiers). */
  rewardPatternNames: RewardPatternName[];
}

export interface GeneratedSizeTier {
  key: 'micro' | 'small' | 'medium' | 'large';
  nameFa: string;
  pointMultiplier: number;
  suggestedDurationDays: number;
}

export interface GeneratedChallenge {
  description: string;
  requiredActions: number;
  bonusPoints: number;
}

/** Campaign + the extra proposal-only fields the generate endpoint adds on top. */
export interface GeneratedCampaignProposal extends Campaign {
  sizeTier: GeneratedSizeTier;
  proposalTitle: string;
  proposalNarrative: string;
  challenge: GeneratedChallenge;
  discountClamped: boolean;
  copyGeneratedByAi: boolean;
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
  /** plan.md Item 17 -- false once the owner has made their one-time slug choice (backend then rejects further PUT changes to it). */
  subdomainSlugEditable: boolean;
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
  /** plan.md Item 14 Step A -- null until the business creates/publishes a microsite. */
  micrositeSlug: string | null;
  /** plan.md Item 14 Step A -- the campaign's public join-link slug (same value used in apps/microsite's /join/:slug route). */
  joinSlug: string;
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

export interface UploadEvidenceResponse {
  evidenceUrl: string;
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

export interface SubmitRetroClaimRequest {
  receiptHash?: string;
  receiptNumber?: string;
  hoursAgo?: number;
  /**
   * Opaque storage key from uploadEvidence(), same pattern TaskSubmitModal.tsx
   * uses for screenshots. Previously the retro-claim modal's file picker was
   * never actually uploaded anywhere -- this was a real gap, now fixed.
   */
  evidenceUrl?: string;
}

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
// Staff POS firsthand verification queue -- social_proof/review_ugc
// screenshot submissions (Instagram story/post shares, written reviews) AND
// receipt_claim submissions (retroactive purchase claims). Both moved out of
// the central review console (review.ts, 2026-09-13) so staff can verify
// these firsthand instead of routing them through the central review team,
// which has no way to recognize a given business's receipts/products out of
// context. Submissions only land here at all when AI confidence scored below
// the auto-approve threshold or scoring failed/wasn't configured -- see
// customer.ts's applyVisionScoreAndMaybeAutoApprove. Shapes match
// staff-pos.ts's /submissions* endpoints.
// ============================================================================

export type StaffSubmissionType = 'screenshot' | 'receipt_claim';
export type StaffSubmissionTaskPattern = 'social_proof' | 'review_ugc';
export type StaffSubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface StaffPendingSubmission {
  id: string;
  customerName: string;
  taskTitle: string;
  submissionType: StaffSubmissionType;
  /** null for receipt_claim rows (they aren't tied to a social_proof/review_ugc task_pattern). */
  taskPattern: StaffSubmissionTaskPattern | null;
  evidenceUrl: string | null;
  /** Only present on receipt_claim rows. */
  receiptNumber: string | null;
  aiConfidenceScore: number | null;
  status: StaffSubmissionStatus;
  pointsAwarded: number | null;
  submittedAt: string;
  taskPointsValue: number;
}

export interface StaffResolveSubmissionResponse {
  id: string;
  status: 'approved' | 'rejected';
  pointsAwarded: number;
}

// ============================================================================
// Review Console persona
// Shapes match apps/backend/src/routes/review.ts's JSON responses exactly.
// The submissions queue (uncertain-AI screenshots + receipt claims) that
// used to live here was removed 2026-09-13 -- see staff-pos.ts's
// StaffPendingSubmission/StaffResolveSubmissionResponse types instead, which
// now cover both submission types.
// ============================================================================

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

// ============================================================================
// Review Admin persona
// Shapes match apps/backend/src/routes/review-admin.ts's JSON responses.
// ============================================================================

export interface AdminUserProfile {
  id: string;
  username: string;
  role: 'review_admin';
  isRoot: boolean;
}

export interface AdminLoginResponse {
  ok: boolean;
  token?: string;
  user?: AdminUserProfile;
  error?: string;
}

export interface ReviewTeamMember {
  id: string;
  name: string;
  phone: string;
  phoneVerified: boolean;
  active: boolean;
}

export interface ReviewAdminAccount {
  id: string;
  username: string;
  createdAt: string;
  createdBy: string;
}

/**
 * plan.md Item 16 Step B -- business picker for the admin campaign UI.
 * Shape matches review-admin.ts's GET /businesses response. review_admin has
 * no per-business scoping (unlike business_owner, whose JWT sub IS the
 * business id), so this lists every business in the system.
 */
export interface AdminBusinessListItem {
  id: string;
  name: string;
  phone: string;
  categoryLabel: string;
  /**
   * plan.md Item 16 Step E -- lets the business picker show each business's
   * "حالت حرفه‌ای" state and toggle it via
   * updateAdminBusinessManualEditor(), without a separate per-business fetch.
   */
  manualEditorEnabled: boolean;
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

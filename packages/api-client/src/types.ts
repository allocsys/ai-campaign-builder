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

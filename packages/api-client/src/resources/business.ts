import type { ApiClient } from '../client';
import type {
  BusinessProfile,
  BusinessStats,
  ChecklistItem,
  Campaign,
  GenerateCampaignRequest,
  GeneratedCampaignProposal,
  Insight,
  SuggestedChange,
  CampaignChatRequest,
  CampaignChatResult,
  AutopilotState,
  MicrositeState,
  Subscription,
  SendLogEntry,
  StaffMember,
} from '../types';

export async function getBusinessProfile(client: ApiClient): Promise<BusinessProfile> {
  return client.request<BusinessProfile>('/api/business/profile');
}

export async function updateBusinessProfile(
  client: ApiClient,
  data: Partial<BusinessProfile>
): Promise<BusinessProfile> {
  return client.request<BusinessProfile>('/api/business/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getChecklist(client: ApiClient): Promise<ChecklistItem[]> {
  return client.request<ChecklistItem[]>('/api/business/checklist');
}

/**
 * GET /api/business/stats -- backend route not implemented yet (frontend-first,
 * see BusinessStats doc comment in types.ts). Callers must catch/handle the
 * rejection until the endpoint ships; DashboardTab treats a failure here as
 * "no stats to show" rather than a page-level error.
 */
export async function getBusinessStats(client: ApiClient): Promise<BusinessStats> {
  return client.request<BusinessStats>('/api/business/stats');
}

export async function getCampaign(client: ApiClient): Promise<Campaign> {
  return client.request<Campaign>('/api/business/campaign');
}

export async function updateCampaign(
  client: ApiClient,
  data: Partial<Campaign>
): Promise<Campaign> {
  return client.request<Campaign>('/api/business/campaign', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function generateCampaign(
  client: ApiClient,
  data: GenerateCampaignRequest
): Promise<GeneratedCampaignProposal> {
  return client.request<GeneratedCampaignProposal>('/api/business/campaign/generate', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getInsights(client: ApiClient): Promise<Insight[]> {
  return client.request<Insight[]>('/api/business/insights');
}

export async function getSuggestedChanges(client: ApiClient): Promise<SuggestedChange[]> {
  return client.request<SuggestedChange[]>('/api/business/suggestions');
}

export async function applySuggestedChange(
  client: ApiClient,
  id: string
): Promise<SuggestedChange> {
  return client.request<SuggestedChange>(`/api/business/suggestions/${encodeURIComponent(id)}/apply`, {
    method: 'POST',
  });
}

export async function dismissSuggestedChange(
  client: ApiClient,
  id: string,
  reason?: string
): Promise<SuggestedChange> {
  return client.request<SuggestedChange>(`/api/business/suggestions/${encodeURIComponent(id)}/dismiss`, {
    method: 'POST',
    body: reason !== undefined ? JSON.stringify({ reason }) : undefined,
  });
}

/**
 * plan.md Open Item 20 Part B -- sends one turn of the NL campaign-editing
 * chat. Response is either a clarifying question (send another message with
 * the SAME sessionId to continue the conversation) or a freshly-created
 * `pending` SuggestedChange, which then shows up wherever getSuggestedChanges
 * is polled (SuggestionsTab) for the normal Apply/Dismiss confirmation.
 */
export async function sendCampaignChatMessage(
  client: ApiClient,
  data: CampaignChatRequest
): Promise<CampaignChatResult> {
  return client.request<CampaignChatResult>('/api/business/campaign/chat', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getAutopilotState(client: ApiClient): Promise<AutopilotState> {
  return client.request<AutopilotState>('/api/business/autopilot');
}

export async function updateAutopilotState(
  client: ApiClient,
  data: Partial<AutopilotState>
): Promise<AutopilotState> {
  return client.request<AutopilotState>('/api/business/autopilot', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getMicrositeState(client: ApiClient): Promise<MicrositeState> {
  return client.request<MicrositeState>('/api/business/microsite');
}

export async function updateMicrositeState(
  client: ApiClient,
  data: Partial<MicrositeState>
): Promise<MicrositeState> {
  return client.request<MicrositeState>('/api/business/microsite', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getSubscription(client: ApiClient): Promise<Subscription> {
  return client.request<Subscription>('/api/business/subscription');
}

export async function getSendsLog(client: ApiClient): Promise<SendLogEntry[]> {
  return client.request<SendLogEntry[]>('/api/business/notifications-log');
}

export async function getStaff(client: ApiClient): Promise<StaffMember[]> {
  return client.request<StaffMember[]>('/api/business/staff');
}

export async function addStaff(
  client: ApiClient,
  data: { name: string; phone: string }
): Promise<StaffMember> {
  return client.request<StaffMember>('/api/business/staff', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateStaff(
  client: ApiClient,
  id: string,
  data: Partial<{ active: boolean; name: string }>
): Promise<StaffMember> {
  return client.request<StaffMember>(`/api/business/staff/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

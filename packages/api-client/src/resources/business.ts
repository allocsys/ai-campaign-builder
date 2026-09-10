import type { ApiClient } from '../client';
import type {
  BusinessProfile,
  ChecklistItem,
  Campaign,
  Insight,
  SuggestedChange,
  AutopilotState,
  MicrositeState,
  Subscription,
  SendLogEntry,
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

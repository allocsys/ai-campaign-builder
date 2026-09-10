import type { ApiClient } from '../client';
import type {
  CustomerProfile,
  CustomerTask,
  CustomerReward,
  CustomerNotification,
  SubmitTaskResponse,
  SimulateAiApproveResponse,
  RedeemRewardResponse,
  TelegramOptInResponse,
  RetroClaimResponse,
} from '../types';

export async function getCustomerProfile(client: ApiClient): Promise<CustomerProfile> {
  return client.request<CustomerProfile>('/api/customer/profile');
}

export async function updateTelegramOptIn(
  client: ApiClient,
  optedIn: boolean
): Promise<TelegramOptInResponse> {
  return client.request<TelegramOptInResponse>('/api/customer/telegram-opt-in', {
    method: 'PUT',
    body: JSON.stringify({ optedIn }),
  });
}

export async function getCustomerTasks(client: ApiClient): Promise<CustomerTask[]> {
  return client.request<CustomerTask[]>('/api/customer/tasks');
}

export async function submitTask(
  client: ApiClient,
  taskId: string,
  evidenceUrl?: string
): Promise<SubmitTaskResponse> {
  return client.request<SubmitTaskResponse>(`/api/customer/tasks/${encodeURIComponent(taskId)}/submit`, {
    method: 'POST',
    body: evidenceUrl !== undefined ? JSON.stringify({ evidenceUrl }) : undefined,
  });
}

export async function simulateAiApproveTask(
  client: ApiClient,
  taskId: string
): Promise<SimulateAiApproveResponse> {
  return client.request<SimulateAiApproveResponse>(
    `/api/customer/tasks/${encodeURIComponent(taskId)}/simulate-ai-approve`,
    { method: 'POST' }
  );
}

export async function getCustomerRewards(client: ApiClient): Promise<CustomerReward[]> {
  return client.request<CustomerReward[]>('/api/customer/rewards');
}

export async function redeemReward(
  client: ApiClient,
  rewardId: string
): Promise<RedeemRewardResponse> {
  return client.request<RedeemRewardResponse>(`/api/customer/rewards/${encodeURIComponent(rewardId)}/redeem`, {
    method: 'POST',
  });
}

export async function submitRetroClaim(
  client: ApiClient,
  data: { receiptHash?: string; receiptNumber?: string; hoursAgo?: number }
): Promise<RetroClaimResponse> {
  return client.request<RetroClaimResponse>('/api/customer/retro-claims', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getCustomerNotifications(client: ApiClient): Promise<CustomerNotification[]> {
  return client.request<CustomerNotification[]>('/api/customer/notifications');
}

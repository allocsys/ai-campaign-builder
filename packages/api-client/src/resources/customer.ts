import { ApiClient, ApiError } from '../client';
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

// The backend signals each rejection reason via a distinct HTTP status
// (400 outside_time_window, 409 duplicate_receipt, 429 rate_limited) and
// ApiClient.request throws on any non-2xx response, so the {success:false,
// reason} body itself never reaches the caller as a resolved value -- it's
// lost inside the thrown ApiError. Catch it here and translate the status
// back into the reason the caller actually needs.
export async function submitRetroClaim(
  client: ApiClient,
  data: { receiptHash?: string; receiptNumber?: string; hoursAgo?: number }
): Promise<RetroClaimResponse> {
  try {
    return await client.request<RetroClaimResponse>('/api/customer/retro-claims', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 400) return { success: false, reason: 'outside_time_window' };
      if (err.status === 409) return { success: false, reason: 'duplicate_receipt' };
      if (err.status === 429) return { success: false, reason: 'rate_limited' };
    }
    throw err;
  }
}

export async function getCustomerNotifications(client: ApiClient): Promise<CustomerNotification[]> {
  return client.request<CustomerNotification[]>('/api/customer/notifications');
}

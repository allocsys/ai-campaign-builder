import { ApiClient, ApiError } from '../client';
import type {
  CustomerProfile,
  CustomerTask,
  CustomerReward,
  CustomerNotification,
  SubmitTaskResponse,
  UploadEvidenceResponse,
  RedeemRewardResponse,
  TelegramOptInResponse,
  RetroClaimResponse,
  SubmitRetroClaimRequest,
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

// Uploads the raw file bytes to POST /api/customer/evidence-upload -- a
// separate call from submitTask() itself (see routes/customer.ts's comment
// on the endpoint for why: lets the UI show upload progress/failure before
// the customer commits to submitting the task). Body is the raw File
// object; ApiClient.request only auto-sets Content-Type when none is
// present, so setting it here to the file's real mime type (rather than
// letting the client default to application/json) is what makes this a
// correct binary upload instead of a broken JSON one.
export async function uploadEvidence(
  client: ApiClient,
  file: File
): Promise<UploadEvidenceResponse> {
  return client.request<UploadEvidenceResponse>('/api/customer/evidence-upload', {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: file,
  });
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
  data: SubmitRetroClaimRequest
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

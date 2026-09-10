import { ApiClient } from '../client';
import type {
  StaffPosCustomerLookupResponse,
  StaffPosLogPurchaseRequest,
  StaffPosLogPurchaseResponse,
  StaffPosRedemptionResponse,
  StaffPosFulfillRedemptionResponse,
  StaffPosSyncRequest,
  StaffPosSyncResponse,
  StaffPosActivityEntry,
} from '../types';

export async function getCustomerByCode(
  client: ApiClient,
  code: string
): Promise<StaffPosCustomerLookupResponse> {
  return client.request<StaffPosCustomerLookupResponse>(
    `/api/staff/customers/${encodeURIComponent(code)}`
  );
}

export async function logPurchase(
  client: ApiClient,
  data: StaffPosLogPurchaseRequest
): Promise<StaffPosLogPurchaseResponse> {
  return client.request<StaffPosLogPurchaseResponse>('/api/staff/purchases', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getRedemptionByCode(
  client: ApiClient,
  code: string
): Promise<StaffPosRedemptionResponse> {
  return client.request<StaffPosRedemptionResponse>(
    `/api/staff/redemptions/${encodeURIComponent(code)}`
  );
}

export async function fulfillRedemption(
  client: ApiClient,
  code: string
): Promise<StaffPosFulfillRedemptionResponse> {
  return client.request<StaffPosFulfillRedemptionResponse>(
    `/api/staff/redemptions/${encodeURIComponent(code)}/fulfill`,
    {
      method: 'POST',
    }
  );
}

export async function syncOfflineQueue(
  client: ApiClient,
  data: StaffPosSyncRequest
): Promise<StaffPosSyncResponse> {
  return client.request<StaffPosSyncResponse>('/api/staff/sync', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getActivity(
  client: ApiClient
): Promise<StaffPosActivityEntry[]> {
  return client.request<StaffPosActivityEntry[]>('/api/staff/activity');
}

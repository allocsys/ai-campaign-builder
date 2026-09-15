import { ApiClient } from '../client';
import type {
  StaffPosCustomerLookupResponse,
  StaffPosTaskOption,
  StaffPosLogPurchaseRequest,
  StaffPosLogPurchaseResponse,
  StaffPosRedemptionResponse,
  StaffPosFulfillRedemptionResponse,
  StaffPosSyncRequest,
  StaffPosSyncResponse,
  StaffPosActivityEntry,
  StaffPendingSubmission,
  StaffResolveSubmissionResponse,
} from '../types';

export async function getCustomerByCode(
  client: ApiClient,
  code: string
): Promise<StaffPosCustomerLookupResponse> {
  return client.request<StaffPosCustomerLookupResponse>(
    `/api/staff/customers/${encodeURIComponent(code)}`
  );
}

export async function getPosTaskOptions(
  client: ApiClient
): Promise<StaffPosTaskOption[]> {
  return client.request<StaffPosTaskOption[]>('/api/staff/pos-tasks');
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

// ============================================================================
// Firsthand screenshot verification queue -- see staff-pos.ts backend and
// types.ts for full context.
// ============================================================================

export async function getPendingSubmissions(
  client: ApiClient,
  status: string = 'pending'
): Promise<StaffPendingSubmission[]> {
  return client.request<StaffPendingSubmission[]>(
    `/api/staff/submissions?status=${encodeURIComponent(status)}`
  );
}

// Named distinctly from review.ts's resolveSubmission -- packages/api-client's
// index.ts re-exports every resource module with `export *`, so two
// same-named exports from different resource files is an ambiguous-export
// TS error (TS2308), not just a same-file collision.
export async function resolveStaffSubmission(
  client: ApiClient,
  id: string,
  decision: 'approved' | 'rejected'
): Promise<StaffResolveSubmissionResponse> {
  return client.request<StaffResolveSubmissionResponse>(
    `/api/staff/submissions/${encodeURIComponent(id)}/resolve`,
    {
      method: 'POST',
      body: JSON.stringify({ decision }),
    }
  );
}

// Returns a Blob rather than a URL -- the evidence image is served through
// an authenticated proxy route (private B2 bucket), not a public URL, so the
// caller must fetch it with the auth token and turn it into an object URL
// (URL.createObjectURL) for display.
export async function getSubmissionEvidenceBlob(
  client: ApiClient,
  id: string
): Promise<Blob> {
  return client.requestBlob(`/api/staff/submissions/${encodeURIComponent(id)}/evidence`);
}
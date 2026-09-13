import { ApiClient } from '../client';
import type {
  ReferrerAggregate,
  ReferralFlag,
  RunDetectionResponse,
  ResolveFlagResponse,
} from '../types';

// getSubmissions/resolveSubmission removed 2026-09-13 -- the central review
// console's submissions queue was removed server-side (review.ts); use
// staff-pos.ts's resource module (getPendingSubmissions/resolveStaffSubmission)
// instead, which now covers both screenshot and receipt_claim submissions.

export async function getReferrerAggregates(
  client: ApiClient
): Promise<ReferrerAggregate[]> {
  return client.request<ReferrerAggregate[]>('/api/review/referral-aggregates');
}

export async function getReferralFlags(
  client: ApiClient
): Promise<ReferralFlag[]> {
  return client.request<ReferralFlag[]>('/api/review/referral-flags');
}

export async function runReferralDetection(
  client: ApiClient
): Promise<RunDetectionResponse> {
  return client.request<RunDetectionResponse>('/api/review/referral-flags/run-detection', {
    method: 'POST',
  });
}

export async function resolveFlag(
  client: ApiClient,
  id: string,
  decision: 'reviewed' | 'dismissed'
): Promise<ResolveFlagResponse> {
  return client.request<ResolveFlagResponse>(
    `/api/review/referral-flags/${encodeURIComponent(id)}/resolve`,
    {
      method: 'POST',
      body: JSON.stringify({ decision }),
    }
  );
}

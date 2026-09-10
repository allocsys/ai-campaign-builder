import { ApiClient } from '../client';
import type {
  ReviewSubmission,
  ResolveSubmissionResponse,
  ReferrerAggregate,
  ReferralFlag,
  RunDetectionResponse,
  ResolveFlagResponse,
} from '../types';

export async function getSubmissions(
  client: ApiClient,
  status: string = 'pending'
): Promise<ReviewSubmission[]> {
  return client.request<ReviewSubmission[]>(
    `/api/review/submissions?status=${encodeURIComponent(status)}`
  );
}

export async function resolveSubmission(
  client: ApiClient,
  id: string,
  decision: 'approved' | 'rejected'
): Promise<ResolveSubmissionResponse> {
  return client.request<ResolveSubmissionResponse>(
    `/api/review/submissions/${encodeURIComponent(id)}/resolve`,
    {
      method: 'POST',
      body: JSON.stringify({ decision }),
    }
  );
}

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

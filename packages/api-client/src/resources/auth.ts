import type { ApiClient } from '../client';
import type { AuthUserProfile } from '../types';

export interface RequestOtpResponse {
  ok: boolean;
  message?: string;
}

export interface VerifyOtpResponse {
  ok: boolean;
  token?: string;
  user?: AuthUserProfile;
  error?: string;
}

export async function requestOtp(
  client: ApiClient,
  phone: string,
  role: string
): Promise<RequestOtpResponse> {
  return client.request<RequestOtpResponse>('/api/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, role }),
  });
}

export async function verifyOtp(
  client: ApiClient,
  phone: string,
  role: string,
  otp: string,
  referralCode?: string
): Promise<VerifyOtpResponse> {
  return client.request<VerifyOtpResponse>('/api/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, role, otp, ...(referralCode ? { referralCode } : {}) }),
  });
}

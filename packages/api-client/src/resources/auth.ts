import type { ApiClient } from '../client';
import type { AuthUserProfile } from '../types';

export interface RequestOtpResponse {
  ok: boolean;
  message?: string;
  /** TEMPORARY, dev-mode only: the backend's hardcoded DEV_OTPS value for this
   * role, echoed back so a live human tester can complete OTP verification
   * without server/log access. Remove once a real SMS provider is wired in. */
  devOtp?: string;
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
  referralCode?: string,
  // Open Item 13, Step B: only meaningful for role: 'customer' -- resolved
  // to a campaignId server-side (auth.ts's Step A support). Optional so
  // every other role's call site is unaffected.
  joinSlug?: string
): Promise<VerifyOtpResponse> {
  return client.request<VerifyOtpResponse>('/api/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({
      phone,
      role,
      otp,
      ...(referralCode ? { referralCode } : {}),
      ...(joinSlug ? { joinSlug } : {}),
    }),
  });
}

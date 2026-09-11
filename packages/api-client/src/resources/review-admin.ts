import { ApiClient } from '../client';
import type { AdminLoginResponse, ReviewTeamMember, ReviewAdminAccount } from '../types';

export async function adminLogin(
  client: ApiClient,
  username: string,
  password: string
): Promise<AdminLoginResponse> {
  return client.request<AdminLoginResponse>('/api/review-admin/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function changeAdminPassword(
  client: ApiClient,
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean }> {
  return client.request<{ ok: boolean }>('/api/review-admin/password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function getReviewTeamMembers(client: ApiClient): Promise<ReviewTeamMember[]> {
  return client.request<ReviewTeamMember[]>('/api/review-admin/team-members');
}

export async function addReviewTeamMember(
  client: ApiClient,
  input: { name: string; phone: string }
): Promise<ReviewTeamMember> {
  return client.request<ReviewTeamMember>('/api/review-admin/team-members', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateReviewTeamMember(
  client: ApiClient,
  id: string,
  input: Partial<{ active: boolean; name: string }>
): Promise<ReviewTeamMember> {
  return client.request<ReviewTeamMember>(`/api/review-admin/team-members/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function getReviewAdmins(client: ApiClient): Promise<ReviewAdminAccount[]> {
  return client.request<ReviewAdminAccount[]>('/api/review-admin/admins');
}

export async function addReviewAdmin(
  client: ApiClient,
  input: { username: string; password: string }
): Promise<ReviewAdminAccount> {
  return client.request<ReviewAdminAccount>('/api/review-admin/admins', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function removeReviewAdmin(client: ApiClient, id: string): Promise<{ ok: boolean; id: string }> {
  return client.request<{ ok: boolean; id: string }>(`/api/review-admin/admins/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

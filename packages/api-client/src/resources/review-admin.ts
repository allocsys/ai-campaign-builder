import { ApiClient } from '../client';
import type {
  AdminLoginResponse,
  ReviewTeamMember,
  ReviewAdminAccount,
  AdminBusinessListItem,
  AdminCustomerListItem,
  Campaign,
  StaffMember,
} from '../types';

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
  input: Partial<{ active: boolean; name: string; phone: string }>
): Promise<ReviewTeamMember> {
  return client.request<ReviewTeamMember>(`/api/review-admin/team-members/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function removeReviewTeamMember(client: ApiClient, id: string): Promise<{ ok: boolean; id: string }> {
  return client.request<{ ok: boolean; id: string }>(`/api/review-admin/team-members/${encodeURIComponent(id)}`, {
    method: 'DELETE',
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

// ----------------------------------------------------------------------------
// Campaign access (plan.md Item 16 Step C). Mirrors resources/business.ts's
// getCampaign/updateCampaign/generateCampaign, but businessId-scoped -- the
// backend endpoints (Step B) reuse the exact same validation/side effects as
// the owner's own campaign endpoints, so the same response shapes apply.
// ----------------------------------------------------------------------------

export async function getAdminBusinesses(client: ApiClient): Promise<AdminBusinessListItem[]> {
  return client.request<AdminBusinessListItem[]>('/api/review-admin/businesses');
}

export async function getAdminBusinessCampaign(client: ApiClient, businessId: string): Promise<Campaign> {
  return client.request<Campaign>(`/api/review-admin/businesses/${encodeURIComponent(businessId)}/campaign`);
}

export async function updateAdminBusinessCampaign(
  client: ApiClient,
  businessId: string,
  data: Partial<Campaign>
): Promise<Campaign> {
  return client.request<Campaign>(`/api/review-admin/businesses/${encodeURIComponent(businessId)}/campaign`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Hard cascade delete -- see backend's deleteCampaignForBusiness for exactly
// what this removes. "Pause" is intentionally NOT a separate function here:
// it's just updateAdminBusinessCampaign(businessId, { status: 'draft' }).
export async function deleteAdminBusinessCampaign(
  client: ApiClient,
  businessId: string
): Promise<{ ok: boolean; deletedCampaignId: string }> {
  return client.request<{ ok: boolean; deletedCampaignId: string }>(
    `/api/review-admin/businesses/${encodeURIComponent(businessId)}/campaign`,
    {
      method: 'DELETE',
    }
  );
}

// Decided 2026-09-15: generateAdminBusinessCampaign (POST /businesses/:businessId/campaign/generate)
// was removed -- it had no caller anywhere in review-console, and the
// backend route it pointed at was itself deleted as dead code once
// generateCampaignForBusiness stopped supporting implicit campaignId
// resolution (see review-admin.ts's own decision note server-side). Admin
// campaign access remains full parity with the owner's for view/edit/delete
// above (getAdminBusinessCampaign/updateAdminBusinessCampaign/deleteAdminBusinessCampaign).

// plan.md Item 16 Step E -- admin-side toggle for a business's manual-editor
// gate ("حالت حرفه‌ای"). The owner can also self-toggle their own via
// updateBusinessProfile({ manualEditorEnabled }) in resources/business.ts --
// either one flips the same shared businesses.manual_editor_enabled column.
export async function updateAdminBusinessManualEditor(
  client: ApiClient,
  businessId: string,
  enabled: boolean
): Promise<{ id: string; manualEditorEnabled: boolean }> {
  return client.request<{ id: string; manualEditorEnabled: boolean }>(
    `/api/review-admin/businesses/${encodeURIComponent(businessId)}/manual-editor`,
    {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }
  );
}

// ----------------------------------------------------------------------------
// Entity deletion -- staff / customers / businesses / microsites. All hard,
// irreversible deletes server-side; callers (review-console) are expected to
// confirm with the admin before calling any of these.
// ----------------------------------------------------------------------------

export async function getAdminBusinessStaff(client: ApiClient, businessId: string): Promise<StaffMember[]> {
  return client.request<StaffMember[]>(`/api/review-admin/businesses/${encodeURIComponent(businessId)}/staff`);
}

export async function deleteAdminStaff(
  client: ApiClient,
  businessId: string,
  staffId: string
): Promise<{ ok: boolean; id: string }> {
  return client.request<{ ok: boolean; id: string }>(
    `/api/review-admin/businesses/${encodeURIComponent(businessId)}/staff/${encodeURIComponent(staffId)}`,
    { method: 'DELETE' }
  );
}

export async function deleteAdminMicrosite(
  client: ApiClient,
  businessId: string
): Promise<{ ok: boolean; deletedMicrositeId: string }> {
  return client.request<{ ok: boolean; deletedMicrositeId: string }>(
    `/api/review-admin/businesses/${encodeURIComponent(businessId)}/microsite`,
    { method: 'DELETE' }
  );
}

export async function getAdminCustomers(client: ApiClient): Promise<AdminCustomerListItem[]> {
  return client.request<AdminCustomerListItem[]>('/api/review-admin/customers');
}

export async function deleteAdminCustomer(client: ApiClient, customerId: string): Promise<{ ok: boolean; id: string }> {
  return client.request<{ ok: boolean; id: string }>(`/api/review-admin/customers/${encodeURIComponent(customerId)}`, {
    method: 'DELETE',
  });
}

export async function deleteAdminBusiness(client: ApiClient, businessId: string): Promise<{ ok: boolean; id: string }> {
  return client.request<{ ok: boolean; id: string }>(`/api/review-admin/businesses/${encodeURIComponent(businessId)}`, {
    method: 'DELETE',
  });
}

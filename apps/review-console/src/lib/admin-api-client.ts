import { ApiClient } from '@ai-campaign-builder/api-client'
import type { Campaign } from '@ai-campaign-builder/api-client'
import {
  adminLogin as _adminLogin,
  changeAdminPassword as _changeAdminPassword,
  getReviewTeamMembers as _getReviewTeamMembers,
  addReviewTeamMember as _addReviewTeamMember,
  updateReviewTeamMember as _updateReviewTeamMember,
  removeReviewTeamMember as _removeReviewTeamMember,
  getReviewAdmins as _getReviewAdmins,
  addReviewAdmin as _addReviewAdmin,
  removeReviewAdmin as _removeReviewAdmin,
  getAdminBusinesses as _getAdminBusinesses,
  getAdminBusinessCampaign as _getAdminBusinessCampaign,
  updateAdminBusinessCampaign as _updateAdminBusinessCampaign,
  deleteAdminBusinessCampaign as _deleteAdminBusinessCampaign,
  updateAdminBusinessManualEditor as _updateAdminBusinessManualEditor,
} from '@ai-campaign-builder/api-client'

// Separate token storage key from the review_team auth in lib/api-client.ts
// (ADMIN_AUTH_STORAGE_KEY, defined alongside AdminAuthProvider in
// lib/admin-auth.tsx) -- a review_admin token and a review_team token are
// different JWTs for different roles, so they can't share one localStorage
// slot the way a single-persona app would.
const ADMIN_AUTH_STORAGE_KEY = 'aicb_review_console_admin_auth'

export const adminApiClient = new ApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || '',
  getToken: () => {
    try {
      // Check both -- a remember=false login lands in sessionStorage
      // (see lib/admin-auth.tsx's readStoredAdminAuth, which already checks
      // both); this only checked localStorage, so a "don't remember me"
      // session could read fine on mount but fail every subsequent API request.
      const raw = localStorage.getItem(ADMIN_AUTH_STORAGE_KEY) ?? sessionStorage.getItem(ADMIN_AUTH_STORAGE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      return parsed?.token || null
    } catch {
      return null
    }
  },
})

export const adminLogin = (username: string, password: string) => _adminLogin(adminApiClient, username, password)
export const changeAdminPassword = (currentPassword: string, newPassword: string) =>
  _changeAdminPassword(adminApiClient, currentPassword, newPassword)
export const getReviewTeamMembers = () => _getReviewTeamMembers(adminApiClient)
export const addReviewTeamMember = (input: { name: string; phone: string }) =>
  _addReviewTeamMember(adminApiClient, input)
export const updateReviewTeamMember = (id: string, input: Partial<{ active: boolean; name: string; phone: string }>) =>
  _updateReviewTeamMember(adminApiClient, id, input)
export const removeReviewTeamMember = (id: string) => _removeReviewTeamMember(adminApiClient, id)
export const getReviewAdmins = () => _getReviewAdmins(adminApiClient)
export const addReviewAdmin = (input: { username: string; password: string }) => _addReviewAdmin(adminApiClient, input)
export const removeReviewAdmin = (id: string) => _removeReviewAdmin(adminApiClient, id)

// plan.md Item 16 Step G -- business picker + campaign view + manual editor.
export const getAdminBusinesses = () => _getAdminBusinesses(adminApiClient)
export const getAdminBusinessCampaign = (businessId: string) => _getAdminBusinessCampaign(adminApiClient, businessId)
export const updateAdminBusinessCampaign = (businessId: string, data: Partial<Campaign>) =>
  _updateAdminBusinessCampaign(adminApiClient, businessId, data)
export const deleteAdminBusinessCampaign = (businessId: string) => _deleteAdminBusinessCampaign(adminApiClient, businessId)
export const updateAdminBusinessManualEditor = (businessId: string, enabled: boolean) =>
  _updateAdminBusinessManualEditor(adminApiClient, businessId, enabled)

export { ADMIN_AUTH_STORAGE_KEY }
export default adminApiClient

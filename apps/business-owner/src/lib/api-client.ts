import { ApiClient } from '@ai-campaign-builder/api-client'
import { notifyAccountDeleted } from './account-deleted-bus'

export const apiClient = new ApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || '',
  getToken: () => {
    try {
      // Check both -- a remember=false login lands in sessionStorage
      // (see lib/auth.tsx's readStoredAuth, which already checks both);
      // this only checked localStorage, so a "don't remember me" session
      // could read fine on mount but fail every subsequent API request.
      const raw =
        localStorage.getItem('aicb_business_owner_auth') ?? sessionStorage.getItem('aicb_business_owner_auth')
      if (!raw) return null
      const parsed = JSON.parse(raw)
      return parsed?.token || null
    } catch {
      return null
    }
  },
  // Single place that reacts to the backend's distinguishing error code for
  // a deleted business account (see business.ts's exists-check guard and
  // account-deleted-bus.ts) instead of every tab's own .catch() having to
  // check err.code individually. AuthProvider subscribes to this bus and
  // renders AccountDeletedScreen in place of the normal dashboard.
  onError: (err) => {
    if (err.code === 'business_account_deleted') {
      notifyAccountDeleted()
    }
  },
})

export default apiClient

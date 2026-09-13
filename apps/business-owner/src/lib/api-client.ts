import { ApiClient } from '@ai-campaign-builder/api-client'

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
})

export default apiClient

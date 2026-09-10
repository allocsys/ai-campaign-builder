import { ApiClient } from '@ai-campaign-builder/api-client'

export const apiClient = new ApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || '',
  getToken: () => {
    try {
      const raw = localStorage.getItem('aicb_business_owner_auth')
      if (!raw) return null
      const parsed = JSON.parse(raw)
      return parsed?.token || null
    } catch {
      return null
    }
  },
})

export default apiClient

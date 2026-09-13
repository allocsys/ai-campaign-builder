import { ApiClient } from '@ai-campaign-builder/api-client'
import {
  getReferrerAggregates as _getReferrerAggregates,
  getReferralFlags as _getReferralFlags,
  runReferralDetection as _runReferralDetection,
  resolveFlag as _resolveFlag,
} from '@ai-campaign-builder/api-client'

export const apiClient = new ApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || '',
  getToken: () => {
    try {
      // Check both -- a remember=false login lands in sessionStorage
      // (see lib/auth.tsx's readStoredAuth, which already checks both);
      // this only checked localStorage, so a "don't remember me" session
      // could read fine on mount but fail every subsequent API request.
      const raw = localStorage.getItem('aicb_review_console_auth') ?? sessionStorage.getItem('aicb_review_console_auth')
      if (!raw) return null
      const parsed = JSON.parse(raw)
      return parsed?.token || null
    } catch {
      return null
    }
  },
})

export const getReferrerAggregates = () => _getReferrerAggregates(apiClient)
export const getReferralFlags = () => _getReferralFlags(apiClient)
export const runReferralDetection = () => _runReferralDetection(apiClient)
export const resolveFlag = (id: string, decision: 'reviewed' | 'dismissed') =>
  _resolveFlag(apiClient, id, decision)

export default apiClient

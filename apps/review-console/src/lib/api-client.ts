import { ApiClient } from '@ai-campaign-builder/api-client'
import {
  getSubmissions as _getSubmissions,
  resolveSubmission as _resolveSubmission,
  getReferrerAggregates as _getReferrerAggregates,
  getReferralFlags as _getReferralFlags,
  runReferralDetection as _runReferralDetection,
  resolveFlag as _resolveFlag,
} from '@ai-campaign-builder/api-client'

export const apiClient = new ApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || '',
  getToken: () => {
    try {
      const raw = localStorage.getItem('aicb_review_console_auth')
      if (!raw) return null
      const parsed = JSON.parse(raw)
      return parsed?.token || null
    } catch {
      return null
    }
  },
})

export const getSubmissions = (status?: string) => _getSubmissions(apiClient, status)
export const resolveSubmission = (id: string, decision: 'approved' | 'rejected') =>
  _resolveSubmission(apiClient, id, decision)
export const getReferrerAggregates = () => _getReferrerAggregates(apiClient)
export const getReferralFlags = () => _getReferralFlags(apiClient)
export const runReferralDetection = () => _runReferralDetection(apiClient)
export const resolveFlag = (id: string, decision: 'reviewed' | 'dismissed') =>
  _resolveFlag(apiClient, id, decision)

export default apiClient

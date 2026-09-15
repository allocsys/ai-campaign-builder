import { ApiClient } from '@ai-campaign-builder/api-client'
import {
  getCustomerByCode as _getCustomerByCode,
  getPosTaskOptions as _getPosTaskOptions,
  logPurchase as _logPurchase,
  getRedemptionByCode as _getRedemptionByCode,
  fulfillRedemption as _fulfillRedemption,
  syncOfflineQueue as _syncOfflineQueue,
  getActivity as _getActivity,
  getPendingSubmissions as _getPendingSubmissions,
  resolveStaffSubmission as _resolveStaffSubmission,
  getSubmissionEvidenceBlob as _getSubmissionEvidenceBlob,
} from '@ai-campaign-builder/api-client'

export const apiClient = new ApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || '',
  getToken: () => {
    try {
      // Check both -- a remember=false login lands in sessionStorage
      // (see lib/auth.tsx's readStoredAuth, which already checks both);
      // this only checked localStorage, so a "don't remember me" session
      // could read fine on mount but fail every subsequent API request.
      const raw = localStorage.getItem('aicb_staff_auth') ?? sessionStorage.getItem('aicb_staff_auth')
      if (!raw) return null
      const parsed = JSON.parse(raw)
      return parsed?.token || null
    } catch {
      return null
    }
  },
})

export const getCustomerByCode = (code: string) => _getCustomerByCode(apiClient, code)
export const getPosTaskOptions = () => _getPosTaskOptions(apiClient)
export const logPurchase = (data: any) => _logPurchase(apiClient, data)
export const getRedemptionByCode = (code: string) => _getRedemptionByCode(apiClient, code)
export const fulfillRedemption = (code: string) => _fulfillRedemption(apiClient, code)
export const syncOfflineQueue = (data: any) => _syncOfflineQueue(apiClient, data)
export const getActivity = () => _getActivity(apiClient)
export const getPendingSubmissions = (status?: string) => _getPendingSubmissions(apiClient, status)
export const resolveSubmission = (id: string, decision: 'approved' | 'rejected') =>
  _resolveStaffSubmission(apiClient, id, decision)
export const getSubmissionEvidenceBlob = (id: string) => _getSubmissionEvidenceBlob(apiClient, id)

export default apiClient
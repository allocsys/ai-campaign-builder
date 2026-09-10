import { ApiClient } from '@ai-campaign-builder/api-client'
import {
  getCustomerByCode as _getCustomerByCode,
  logPurchase as _logPurchase,
  getRedemptionByCode as _getRedemptionByCode,
  fulfillRedemption as _fulfillRedemption,
  syncOfflineQueue as _syncOfflineQueue,
  getActivity as _getActivity,
} from '@ai-campaign-builder/api-client'

export const apiClient = new ApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || '',
  getToken: () => {
    try {
      const raw = localStorage.getItem('aicb_staff_auth')
      if (!raw) return null
      const parsed = JSON.parse(raw)
      return parsed?.token || null
    } catch {
      return null
    }
  },
})

export const getCustomerByCode = (code: string) => _getCustomerByCode(apiClient, code)
export const logPurchase = (data: any) => _logPurchase(apiClient, data)
export const getRedemptionByCode = (code: string) => _getRedemptionByCode(apiClient, code)
export const fulfillRedemption = (code: string) => _fulfillRedemption(apiClient, code)
export const syncOfflineQueue = (data: any) => _syncOfflineQueue(apiClient, data)
export const getActivity = () => _getActivity(apiClient)

export default apiClient

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StaffPosHome } from '../StaffPosHome'
import * as apiClient from '../../lib/api-client'

const mockLogout = vi.fn()
const mockShowToast = vi.fn()

vi.mock('../../lib/auth', () => ({
  useAuth: () => ({
    logout: mockLogout,
  }),
}))

vi.mock('@ai-campaign-builder/ui-kit', async () => {
  const actual = await vi.importActual<typeof import('@ai-campaign-builder/ui-kit')>('@ai-campaign-builder/ui-kit')
  return {
    ...actual,
    useToast: () => ({
      show: mockShowToast,
    }),
  }
})

vi.mock('../../lib/api-client', () => ({
  getCustomerByCode: vi.fn(),
  logPurchase: vi.fn(),
  getRedemptionByCode: vi.fn(),
  fulfillRedemption: vi.fn(),
  syncOfflineQueue: vi.fn(),
  getActivity: vi.fn(),
  getPendingSubmissions: vi.fn(),
  resolveSubmission: vi.fn(),
  getSubmissionEvidenceBlob: vi.fn(),
}))

describe('StaffPosHome', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(apiClient.getActivity).mockResolvedValue([
      {
        id: 'a1',
        type: 'purchase',
        text: 'ثبت فاکتور ۲۴۰,۰۰۰ تومان برای کد 33812 (+۶۰ امتیاز)',
        time: '۱۵ دقیقه پیش',
        status: 'synced',
      } as any,
    ])
    vi.mocked(apiClient.getCustomerByCode).mockImplementation(async (code: string) => {
      if (code === '99999') {
        return {
          personalCode: '99999',
          name: 'سارا احمدی',
          pointsBalance: 250,
          campaignId: 'c_narvan_autumn',
        }
      }
      return {
        personalCode: '48291',
        name: 'علی محمدی',
        pointsBalance: 120,
        campaignId: 'c_narvan_autumn',
      }
    })
    vi.mocked(apiClient.getRedemptionByCode).mockResolvedValue({
      code: 'RDM-84920',
      rewardTitle: 'قهوه رایگان',
      customerName: 'مریم حسینی',
      customerCode: '33812',
      pointsDeducted: 100,
      status: 'pending',
      expired: false,
    })
    vi.mocked(apiClient.getPendingSubmissions).mockResolvedValue([])
  })

  it('renders correctly on initial load with initial customer and activity', async () => {
    render(<StaffPosHome />)

    expect(screen.getByText('صندوق کافه نارون')).toBeInTheDocument()
    expect(screen.getByText('آنلاین (متصل به سرور)')).toBeInTheDocument()

    await waitFor(() => {
      expect(apiClient.getActivity).toHaveBeenCalled()
      expect(apiClient.getCustomerByCode).toHaveBeenCalledWith('48291')
    })

    expect(screen.getByText('علی محمدی (کد 48291)')).toBeInTheDocument()
    expect(screen.getByText('120 امتیاز')).toBeInTheDocument()
    expect(screen.getByText('ثبت فاکتور ۲۴۰,۰۰۰ تومان برای کد 33812 (+۶۰ امتیاز)')).toBeInTheDocument()
  })

  it('triggers customer lookup when typing customer code or clicking camera scan button', async () => {
    const user = userEvent.setup()
    render(<StaffPosHome />)

    await waitFor(() => {
      expect(apiClient.getCustomerByCode).toHaveBeenCalledWith('48291')
    })

    const customerInput = screen.getByLabelText('کد یا بارکد مشتری')
    await user.clear(customerInput)
    await user.type(customerInput, '99999')

    await waitFor(() => {
      expect(screen.getByText('سارا احمدی (کد 99999)')).toBeInTheDocument()
    })

    // Test camera scan button for customer
    const scanBtn = screen.getByRole('button', { name: 'اسکن بارکد مشتری' })
    await user.click(scanBtn)

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('بارکد مشتری خوانده شد: 48291', 'info')
    })
  })

  it('creates purchase/order online successfully', async () => {
    const user = userEvent.setup()
    vi.mocked(apiClient.logPurchase).mockResolvedValueOnce({
      status: 'synced',
      pointsAwarded: 60,
    })

    render(<StaffPosHome />)

    await waitFor(() => {
      expect(apiClient.getCustomerByCode).toHaveBeenCalledWith('48291')
    })

    const submitBtn = screen.getByRole('button', { name: '✓ ثبت خرید و اعمال امتیاز' })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(apiClient.logPurchase).toHaveBeenCalledWith(
        expect.objectContaining({
          personalCode: '48291',
          amountToman: 180000,
        })
      )
    })

    expect(mockShowToast).toHaveBeenCalledWith('خرید با موفقیت ثبت شد و 60 امتیاز به کد 48291 اعطا گردید.', 'success')
  })

  it('handles reward redemption tab typing and camera scan trigger', async () => {
    const user = userEvent.setup()
    render(<StaffPosHome />)

    // Switch to fulfill tab
    const fulfillTabBtn = screen.getByRole('button', { name: /تحویل پاداش/ })
    await user.click(fulfillTabBtn)

    expect(screen.getByLabelText('کد یک‌بار مصرف پاداش')).toBeInTheDocument()

    const rdmInput = screen.getByLabelText('کد یک‌بار مصرف پاداش')
    await user.type(rdmInput, 'RDM-84920')

    await waitFor(() => {
      expect(apiClient.getRedemptionByCode).toHaveBeenCalledWith('RDM-84920')
    })
    expect(screen.getByText('✓ کد پاداش معتبر است')).toBeInTheDocument()
    expect(screen.getByText('عنوان پاداش: قهوه رایگان')).toBeInTheDocument()

    // Camera scan trigger
    const scanBtn = screen.getByRole('button', { name: 'اسکن کد یک‌بار مصرف پاداش' })
    await user.click(scanBtn)

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('بارکد پاداش شناسایی شد: RDM-84920', 'info')
    })

    // Submit redemption
    vi.mocked(apiClient.fulfillRedemption).mockResolvedValueOnce({ ok: true } as any)
    const submitFulfillBtn = screen.getByRole('button', { name: '🎁 تایید تحویل پاداش به مشتری' })
    await user.click(submitFulfillBtn)

    await waitFor(() => {
      expect(apiClient.fulfillRedemption).toHaveBeenCalledWith('RDM-84920')
    })
    expect(mockShowToast).toHaveBeenCalledWith('پاداش RDM-84920 با موفقیت در سیستم باطل و تحویل داده شد.', 'success')
  })

  it('handles offline queue accumulation and sync', async () => {
    const user = userEvent.setup()
    render(<StaffPosHome />)

    // Toggle offline mode simulation
    const offlineToggle = screen.getByRole('checkbox', { hidden: true })
    await user.click(offlineToggle)

    expect(screen.getByText('آفلاین (بدون اینترنت)')).toBeInTheDocument()
    expect(mockShowToast).toHaveBeenCalledWith('دستگاه به حالت آفلاین رفت. کلیه عملیات در صف آفلاین ذخیره خواهند شد.', 'warning')

    // Submit purchase while offline
    const submitPurchaseBtn = screen.getByRole('button', { name: '✓ ثبت خرید و اعمال امتیاز' })
    await user.click(submitPurchaseBtn)

    expect(mockShowToast).toHaveBeenCalledWith('تراکنش در صف آفلاین دستگاه ذخیره شد و پس از اتصال اینترنت همگام می‌شود.', 'warning')

    // Switch to queue tab
    const queueTabBtn = screen.getByRole('button', { name: /صف \(1\)/ })
    await user.click(queueTabBtn)

    expect(screen.getByText(/کد مشتری: 48291/)).toBeInTheDocument()

    // Trigger sync
    vi.mocked(apiClient.syncOfflineQueue).mockResolvedValueOnce({
      results: [
        {
          itemId: 'q_1',
          idempotencyKey: '48291_123',
          actionType: 'purchase',
          status: 'synced',
          pointsAwarded: 60,
          reason: 'موفق',
        },
      ],
    })

    const syncBtn = screen.getByRole('button', { name: /همگام‌سازی و راستی‌آزمایی سرور/ })
    await user.click(syncBtn)

    await waitFor(() => {
      expect(apiClient.syncOfflineQueue).toHaveBeenCalledWith({
        items: [
          expect.objectContaining({
            personalCode: '48291',
            amountToman: 180000,
            actionType: 'purchase',
          }),
        ],
      })
    })

    expect(screen.getByText('📊 نتایج آخرین همگام‌سازی')).toBeInTheDocument()
    expect(screen.getByText('امتیاز اعطا شده: +60')).toBeInTheDocument()
  })

  it('handles screenshot resolution tab approving and rejecting submissions', async () => {
    const user = userEvent.setup()
    const mockPending: any[] = [
      {
        id: 'sub_1',
        customerName: 'سارا رضایی',
        taskTitle: 'اشتراک‌گذاری استوری اینستاگرام',
        submissionType: 'screenshot',
        taskPattern: 'social_proof',
        evidenceUrl: 'https://example.com/image.jpg',
        receiptNumber: 'REC-101',
        aiConfidenceScore: 0.65,
        status: 'pending',
        pointsAwarded: null,
        submittedAt: '۱۰ دقیقه پیش',
        taskPointsValue: 50,
      },
      {
        id: 'sub_2',
        customerName: 'رضا کمالی',
        taskTitle: 'ثبت نظر در گوگل map',
        submissionType: 'screenshot',
        taskPattern: 'review_ugc',
        evidenceUrl: 'https://example.com/image2.jpg',
        receiptNumber: null,
        aiConfidenceScore: 0.4,
        status: 'pending',
        pointsAwarded: null,
        submittedAt: '۵ دقیقه پیش',
        taskPointsValue: 30,
      },
    ]

    vi.mocked(apiClient.getPendingSubmissions).mockResolvedValueOnce(mockPending)
    const mockBlob = new Blob(['fake image content'], { type: 'image/jpeg' })
    vi.mocked(apiClient.getSubmissionEvidenceBlob).mockResolvedValue(mockBlob)

    render(<StaffPosHome />)

    // Switch to screenshots tab
    const screenshotsTabBtn = screen.getByRole('button', { name: /بررسی محتوا/ })
    await user.click(screenshotsTabBtn)

    await waitFor(() => {
      expect(apiClient.getPendingSubmissions).toHaveBeenCalledWith('pending')
      expect(apiClient.getSubmissionEvidenceBlob).toHaveBeenCalledWith('sub_1')
      expect(apiClient.getSubmissionEvidenceBlob).toHaveBeenCalledWith('sub_2')
    })

    expect(screen.getByText('اشتراک‌گذاری استوری اینستاگرام')).toBeInTheDocument()
    expect(screen.getByText('سارا رضایی • ۱۰ دقیقه پیش')).toBeInTheDocument()
    expect(screen.getByText('ثبت نظر در گوگل map')).toBeInTheDocument()

    // Test approve sub_1
    vi.mocked(apiClient.resolveSubmission).mockResolvedValueOnce({
      status: 'approved',
      pointsAwarded: 50,
    } as any)

    const approveBtns = screen.getAllByRole('button', { name: /تایید/ })
    await user.click(approveBtns[0])

    await waitFor(() => {
      expect(apiClient.resolveSubmission).toHaveBeenCalledWith('sub_1', 'approved')
    })
    expect(mockShowToast).toHaveBeenCalledWith('تایید شد — 50 امتیاز به سارا رضایی اعطا شد.', 'success')

    // Test reject sub_2
    vi.mocked(apiClient.resolveSubmission).mockResolvedValueOnce({
      status: 'rejected',
      pointsAwarded: 0,
    } as any)

    const rejectBtn = screen.getByRole('button', { name: /رد کردن/ })
    await user.click(rejectBtn)

    await waitFor(() => {
      expect(apiClient.resolveSubmission).toHaveBeenCalledWith('sub_2', 'rejected')
    })
    expect(mockShowToast).toHaveBeenCalledWith('رد شد — به رضا کمالی اطلاع داده می‌شود که می‌تواند دوباره ارسال کند.', 'danger')
  })
})

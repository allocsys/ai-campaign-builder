import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReviewConsoleHome } from '../ReviewConsoleHome'
import type { ReferralFlag } from '@ai-campaign-builder/api-client'

const mockLogout = vi.fn()
const mockShowToast = vi.fn()
const mockGetReferralFlags = vi.fn()
const mockRunReferralDetection = vi.fn()
const mockResolveFlag = vi.fn()

vi.mock('@ai-campaign-builder/ui-kit', async () => {
  const actual = await vi.importActual<typeof import('@ai-campaign-builder/ui-kit')>('@ai-campaign-builder/ui-kit')
  return {
    ...actual,
    useToast: () => ({
      show: mockShowToast,
    }),
  }
})

vi.mock('../../lib/auth', () => ({
  useAuth: () => ({
    phone: '09121111111',
    logout: mockLogout,
  }),
}))

vi.mock('../../lib/api-client', () => ({
  getReferralFlags: () => mockGetReferralFlags(),
  runReferralDetection: () => mockRunReferralDetection(),
  resolveFlag: (id: string, decision: 'reviewed' | 'dismissed') => mockResolveFlag(id, decision),
}))

const mockFlags: ReferralFlag[] = [
  {
    id: 'flag-1',
    referrerName: 'علی محمدی',
    ruleTriggered: 'velocity',
    ruleNameFa: 'سرعت بالای معرفی',
    description: 'بیش از ۵ معرفی در ۲۴ ساعت ثبت شده است',
    triggeredAt: '2026-09-13 14:00',
    status: 'open',
    notes: '',
  },
  {
    id: 'flag-2',
    referrerName: 'رضا احمدی',
    ruleTriggered: 'dead_referral_ratio',
    ruleNameFa: 'نسبت بالای دعوت بدون خرید',
    description: '۱۰ دعوت ثبت شده بدون حتی یک خرید موفق',
    triggeredAt: '2026-09-13 15:00',
    status: 'reviewed',
    notes: 'بررسی شد - هشدارهای قبلی تایید شد',
  },
]

describe('ReviewConsoleHome', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state initially', () => {
    mockGetReferralFlags.mockReturnValue(new Promise(() => {})) // pending promise
    render(<ReviewConsoleHome />)

    expect(screen.getByText('در حال بارگذاری…')).toBeInTheDocument()
    expect(screen.getByText('09121111111')).toBeInTheDocument()
  })

  it('shows empty queue message when no flags exist', async () => {
    mockGetReferralFlags.mockResolvedValueOnce([])
    render(<ReviewConsoleHome />)

    await waitFor(() => {
      expect(screen.getByText('هیچ هشدار تقلب فعالی وجود ندارد')).toBeInTheDocument()
    })
  })

  it('shows toast error when loading flags fails', async () => {
    mockGetReferralFlags.mockRejectedValueOnce(new Error('Network error'))
    render(<ReviewConsoleHome />)

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('خطا در بارگذاری اطلاعات از سرور.', 'danger')
    })
  })

  it('renders flags list when loaded', async () => {
    mockGetReferralFlags.mockResolvedValueOnce(mockFlags)
    render(<ReviewConsoleHome />)

    await waitFor(() => {
      expect(screen.getByText('علی محمدی')).toBeInTheDocument()
    })

    expect(screen.getByText('رضا احمدی')).toBeInTheDocument()
    expect(screen.getByText('سرعت بالای معرفی')).toBeInTheDocument()
    expect(screen.getByText('بیش از ۵ معرفی در ۲۴ ساعت ثبت شده است')).toBeInTheDocument()
    expect(screen.getByText('در انتظار بررسی')).toBeInTheDocument()
    expect(screen.getByText('بررسی شد')).toBeInTheDocument()
    expect(screen.getByText(/بررسی شد - هشدارهای قبلی تایید شد/)).toBeInTheDocument()
  })

  it('triggers batch detection and updates flags with success toast when addedCount > 0', async () => {
    const user = userEvent.setup()
    mockGetReferralFlags.mockResolvedValueOnce([])
    mockRunReferralDetection.mockResolvedValueOnce({
      addedCount: 2,
      flags: mockFlags,
    })

    render(<ReviewConsoleHome />)

    await waitFor(() => {
      expect(screen.getByText('هیچ هشدار تقلب فعالی وجود ندارد')).toBeInTheDocument()
    })

    const batchBtn = screen.getByRole('button', { name: 'اجرای شبیه‌سازی دسته‌ای آنالیز تقلب' })
    await user.click(batchBtn)

    await waitFor(() => {
      expect(mockRunReferralDetection).toHaveBeenCalled()
    })

    expect(mockShowToast).toHaveBeenCalledWith('باتچ آنالیز تقلب اجرا شد: 2 هشدار ناهنجاری جدید شناسایی شد.', 'success')
    expect(screen.getByText('علی محمدی')).toBeInTheDocument()
  })

  it('triggers batch detection and shows info toast when addedCount is 0', async () => {
    const user = userEvent.setup()
    mockGetReferralFlags.mockResolvedValueOnce(mockFlags)
    mockRunReferralDetection.mockResolvedValueOnce({
      addedCount: 0,
      flags: mockFlags,
    })

    render(<ReviewConsoleHome />)

    await waitFor(() => {
      expect(screen.getByText('علی محمدی')).toBeInTheDocument()
    })

    const batchBtn = screen.getByRole('button', { name: 'اجرای شبیه‌سازی دسته‌ای آنالیز تقلب' })
    await user.click(batchBtn)

    await waitFor(() => {
      expect(mockRunReferralDetection).toHaveBeenCalled()
    })

    expect(mockShowToast).toHaveBeenCalledWith(
      'باتچ آنالیز تقلب اجرا شد: هیچ هشدار جدیدی اضافه نشد (موارد فعلی در حال بررسی هستند).',
      'info'
    )
  })

  it('shows error toast when batch detection fails', async () => {
    const user = userEvent.setup()
    mockGetReferralFlags.mockResolvedValueOnce([])
    mockRunReferralDetection.mockRejectedValueOnce(new Error('Batch error'))

    render(<ReviewConsoleHome />)

    await waitFor(() => {
      expect(screen.getByText('هیچ هشدار تقلب فعالی وجود ندارد')).toBeInTheDocument()
    })

    const batchBtn = screen.getByRole('button', { name: 'اجرای شبیه‌سازی دسته‌ای آنالیز تقلب' })
    await user.click(batchBtn)

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('خطا در اجرای آنالیز تقلب. دوباره تلاش کنید.', 'danger')
    })
  })

  it('resolves flag as dismissed', async () => {
    const user = userEvent.setup()
    mockGetReferralFlags.mockResolvedValueOnce(mockFlags)
    mockResolveFlag.mockResolvedValueOnce({
      id: 'flag-1',
      status: 'dismissed',
      notes: 'رد شده توسط مدیریت',
    })

    render(<ReviewConsoleHome />)

    await waitFor(() => {
      expect(screen.getByText('علی محمدی')).toBeInTheDocument()
    })

    const dismissBtn = screen.getByRole('button', { name: 'رد هشدار (بی‌خطر بود)' })
    await user.click(dismissBtn)

    await waitFor(() => {
      expect(mockResolveFlag).toHaveBeenCalledWith('flag-1', 'dismissed')
    })

    expect(mockShowToast).toHaveBeenCalledWith('وضعیت هشدار به‌روزرسانی شد.', 'success')
    expect(screen.getByText('رد شده')).toBeInTheDocument()
  })

  it('resolves flag as reviewed', async () => {
    const user = userEvent.setup()
    mockGetReferralFlags.mockResolvedValueOnce(mockFlags)
    mockResolveFlag.mockResolvedValueOnce({
      id: 'flag-1',
      status: 'reviewed',
      notes: 'بررسی گردید',
    })

    render(<ReviewConsoleHome />)

    await waitFor(() => {
      expect(screen.getByText('علی محمدی')).toBeInTheDocument()
    })

    const reviewBtn = screen.getByRole('button', { name: 'علامت‌گذاری به‌عنوان بررسی‌شده' })
    await user.click(reviewBtn)

    await waitFor(() => {
      expect(mockResolveFlag).toHaveBeenCalledWith('flag-1', 'reviewed')
    })

    expect(mockShowToast).toHaveBeenCalledWith('وضعیت هشدار به‌روزرسانی شد.', 'success')
  })

  it('shows error toast when resolveFlag fails', async () => {
    const user = userEvent.setup()
    mockGetReferralFlags.mockResolvedValueOnce(mockFlags)
    mockResolveFlag.mockRejectedValueOnce(new Error('API error'))

    render(<ReviewConsoleHome />)

    await waitFor(() => {
      expect(screen.getByText('علی محمدی')).toBeInTheDocument()
    })

    const reviewBtn = screen.getByRole('button', { name: 'علامت‌گذاری به‌عنوان بررسی‌شده' })
    await user.click(reviewBtn)

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('خطا در به‌روزرسانی هشدار. دوباره تلاش کنید.', 'danger')
    })
  })

  it('calls logout when logout button is clicked', async () => {
    const user = userEvent.setup()
    mockGetReferralFlags.mockResolvedValueOnce([])

    render(<ReviewConsoleHome />)

    await waitFor(() => {
      expect(screen.getByText('هیچ هشدار تقلب فعالی وجود ندارد')).toBeInTheDocument()
    })

    const logoutBtn = screen.getByRole('button', { name: 'خروج' })
    await user.click(logoutBtn)

    expect(mockLogout).toHaveBeenCalled()
  })
})

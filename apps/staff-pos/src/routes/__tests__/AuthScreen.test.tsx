import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthScreen } from '../AuthScreen'

const mockNavigate = vi.fn()
const mockShowToast = vi.fn()
const mockRequestOtp = vi.fn()
const mockVerifyOtp = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

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
    requestOtp: mockRequestOtp,
    verifyOtp: mockVerifyOtp,
  }),
}))

describe('AuthScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders phone input step initially', () => {
    render(<AuthScreen />)

    expect(screen.getByRole('heading', { name: 'ورود به صندوق' })).toBeInTheDocument()
    expect(screen.getByText('شماره موبایل پرسنل صندوق را وارد کنید')).toBeInTheDocument()
    expect(screen.getByLabelText('شماره موبایل')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'دریافت کد تایید پیامکی' })).toBeInTheDocument()
  })

  it('displays validation error when phone format is invalid', async () => {
    const user = userEvent.setup()
    render(<AuthScreen />)

    const phoneInput = screen.getByLabelText('شماره موبایل')
    await user.type(phoneInput, '0912345')

    const submitBtn = screen.getByRole('button', { name: 'دریافت کد تایید پیامکی' })
    await user.click(submitBtn)

    expect(screen.getByText('شماره موبایل معتبر نیست (مثال: 09121111111)')).toBeInTheDocument()
    expect(mockRequestOtp).not.toHaveBeenCalled()
  })

  it('transitions to OTP step on successful requestOtp and shows dev OTP toast', async () => {
    const user = userEvent.setup()
    mockRequestOtp.mockResolvedValueOnce('1234')

    render(<AuthScreen />)

    const phoneInput = screen.getByLabelText('شماره موبایل')
    await user.type(phoneInput, '09121111111')

    const submitBtn = screen.getByRole('button', { name: 'دریافت کد تایید پیامکی' })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(mockRequestOtp).toHaveBeenCalledWith('09121111111')
    })

    expect(mockShowToast).toHaveBeenCalledWith('کد تست (حالت توسعه): 1234', 'warning')
    expect(screen.getByText('کد تایید ارسال شده به 09121111111 را وارد کنید')).toBeInTheDocument()
    expect(screen.getByLabelText('کد تایید')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'تایید و ورود به صندوق' })).toBeInTheDocument()
  })

  it('displays error when requestOtp fails', async () => {
    const user = userEvent.setup()
    mockRequestOtp.mockRejectedValueOnce(new Error('خطا در برقراری ارتباط با سرور'))

    render(<AuthScreen />)

    const phoneInput = screen.getByLabelText('شماره موبایل')
    await user.type(phoneInput, '09121111111')

    const submitBtn = screen.getByRole('button', { name: 'دریافت کد تایید پیامکی' })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText('خطا در برقراری ارتباط با سرور')).toBeInTheDocument()
    })
    expect(screen.getByLabelText('شماره موبایل')).toBeInTheDocument()
  })

  it('shows error when verifyOtp returns false', async () => {
    const user = userEvent.setup()
    mockRequestOtp.mockResolvedValueOnce('1234')
    mockVerifyOtp.mockResolvedValueOnce(false)

    render(<AuthScreen />)

    // Request OTP first
    await user.type(screen.getByLabelText('شماره موبایل'), '09121111111')
    await user.click(screen.getByRole('button', { name: 'دریافت کد تایید پیامکی' }))

    await waitFor(() => {
      expect(screen.getByLabelText('کد تایید')).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText('کد تایید'), '9999')
    await user.click(screen.getByRole('button', { name: 'تایید و ورود به صندوق' }))

    await waitFor(() => {
      expect(mockVerifyOtp).toHaveBeenCalledWith('09121111111', '9999', true)
    })

    expect(screen.getByText('کد وارد شده اشتباه است یا دسترسی پرسنل تعریف نشده است')).toBeInTheDocument()
  })

  it('navigates to / and shows toast on successful verifyOtp', async () => {
    const user = userEvent.setup()
    mockRequestOtp.mockResolvedValueOnce('1234')
    mockVerifyOtp.mockResolvedValueOnce(true)

    render(<AuthScreen />)

    await user.type(screen.getByLabelText('شماره موبایل'), '09121111111')
    await user.click(screen.getByRole('button', { name: 'دریافت کد تایید پیامکی' }))

    await waitFor(() => {
      expect(screen.getByLabelText('کد تایید')).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText('کد تایید'), '1234')
    await user.click(screen.getByRole('button', { name: 'تایید و ورود به صندوق' }))

    await waitFor(() => {
      expect(mockVerifyOtp).toHaveBeenCalledWith('09121111111', '1234', true)
    })

    expect(mockShowToast).toHaveBeenCalledWith('ورود به صندوق با موفقیت انجام شد. خوش آمدید!', 'success')
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('allows changing phone number from OTP step', async () => {
    const user = userEvent.setup()
    mockRequestOtp.mockResolvedValueOnce('1234')

    render(<AuthScreen />)

    await user.type(screen.getByLabelText('شماره موبایل'), '09121111111')
    await user.click(screen.getByRole('button', { name: 'دریافت کد تایید پیامکی' }))

    await waitFor(() => {
      expect(screen.getByLabelText('کد تایید')).toBeInTheDocument()
    })

    const changePhoneBtn = screen.getByRole('button', { name: 'تغییر شماره موبایل' })
    await user.click(changePhoneBtn)

    expect(screen.getByLabelText('شماره موبایل')).toBeInTheDocument()
    expect(screen.queryByLabelText('کد تایید')).not.toBeInTheDocument()
  })
})

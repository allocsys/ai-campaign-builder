import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AdminLoginScreen } from '../AdminLoginScreen'

const mockNavigate = vi.fn()
const mockShowToast = vi.fn()
const mockLogin = vi.fn()

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

vi.mock('../../lib/admin-auth', () => ({
  useAdminAuth: () => ({
    login: mockLogin,
  }),
}))

describe('AdminLoginScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders initial admin login form with default fields', () => {
    render(<AdminLoginScreen />)

    expect(screen.getByRole('heading', { name: /ورود ادمین/ })).toBeInTheDocument()
    expect(screen.getByLabelText('نام کاربری')).toBeInTheDocument()
    expect(screen.getByLabelText('رمز عبور')).toBeInTheDocument()

    const rememberCheckbox = screen.getByRole('checkbox', { name: 'مرا به خاطر بسپار' })
    expect(rememberCheckbox).toBeInTheDocument()
    expect(rememberCheckbox).toBeChecked()

    expect(screen.getByRole('button', { name: 'ورود' })).toBeInTheDocument()
  })

  it('displays validation error when username or password is empty', async () => {
    const user = userEvent.setup()
    render(<AdminLoginScreen />)

    const submitBtn = screen.getByRole('button', { name: 'ورود' })
    await user.click(submitBtn)

    expect(screen.getByText('نام کاربری و رمز عبور را وارد کنید')).toBeInTheDocument()
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('displays error when login returns false', async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValueOnce(false)

    render(<AdminLoginScreen />)

    await user.type(screen.getByLabelText('نام کاربری'), 'admin')
    await user.type(screen.getByLabelText('رمز عبور'), 'wrongpassword')

    await user.click(screen.getByRole('button', { name: 'ورود' }))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin', 'wrongpassword', true)
    })

    expect(screen.getByText('نام کاربری یا رمز عبور اشتباه است')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('navigates to /admin and shows toast on successful login', async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValueOnce(true)

    render(<AdminLoginScreen />)

    await user.type(screen.getByLabelText('نام کاربری'), '  admin  ')
    await user.type(screen.getByLabelText('رمز عبور'), 'secret123')

    const rememberCheckbox = screen.getByRole('checkbox', { name: 'مرا به خاطر بسپار' })
    await user.click(rememberCheckbox) // toggle to false

    await user.click(screen.getByRole('button', { name: 'ورود' }))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin', 'secret123', false)
    })

    expect(mockShowToast).toHaveBeenCalledWith('ورود ادمین با موفقیت انجام شد', 'success')
    expect(mockNavigate).toHaveBeenCalledWith('/admin', { replace: true })
  })
})

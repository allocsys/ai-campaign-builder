import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { motion } from 'framer-motion'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  loading?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 hover:bg-brand-700 text-white border border-transparent',
  secondary: 'bg-glass-light hover:bg-white/20 text-slate-100 border border-glass-border backdrop-blur-md',
  ghost: 'bg-transparent hover:bg-white/10 text-slate-200 border border-transparent',
  danger: 'bg-red-600/90 hover:bg-red-600 text-white border border-transparent',
}

/** Base button used across all persona apps. Glassmorphism for `secondary`/`ghost`, solid brand fill for `primary`. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', loading = false, disabled, className = '', children, ...rest }, ref) => (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.97 }}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl2 px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
      {...(rest as any)}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </motion.button>
  ),
)
Button.displayName = 'Button'

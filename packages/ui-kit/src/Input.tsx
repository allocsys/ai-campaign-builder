import { type InputHTMLAttributes, forwardRef } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

/** Base text input — glass surface, RTL-aware (inherits dir from the app's <html dir="rtl">). */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, className = '', ...rest }, ref) => {
    const inputId = id ?? rest.name
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-slate-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`bg-glass-light backdrop-blur-md border rounded-xl2 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-brand-500/60 transition-shadow ${
            error ? 'border-red-500/60' : 'border-glass-border'
          } ${className}`}
          {...rest}
        />
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    )
  },
)
Input.displayName = 'Input'

import { type HTMLAttributes } from 'react'
import { motion } from 'framer-motion'
import { Button } from './Button'

export interface AppHeaderProps extends HTMLAttributes<HTMLElement> {
  title?: string
  onMenuClick?: () => void
}

/**
 * AppHeader component for the UI kit.
 * Features a route-aware page title and a hamburger trigger button on the visual right (RTL).
 */
export function AppHeader({ title, onMenuClick, className = '', ...rest }: AppHeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center justify-between px-6 py-4 border-b border-glass-border bg-glass-light backdrop-blur-md sticky top-0 z-30 ${className}`}
      {...(rest as any)}
    >
      <div className="flex items-center gap-3">
        {title && (
          <h1 className="text-lg font-bold text-slate-100">{title}</h1>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          onClick={onMenuClick ?? (() => console.log('Hamburger menu clicked'))}
          aria-label="منوی ناوبری"
          className="p-2.5"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
            href=""
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </Button>
    </div>
    </motion.header>
  )
}

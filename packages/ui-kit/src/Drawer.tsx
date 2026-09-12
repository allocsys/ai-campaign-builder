import { type ReactNode, useEffect, useId, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { motionDuration, motionEasing } from './animation-tokens'
import { Button } from './Button'

export interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Slide-in Drawer component for the UI kit.
 * Slides in from the visual right (RTL app). Includes a backdrop overlay that closes the drawer on click.
 */
export function Drawer({ isOpen, onClose, title, children, className = '' }: DrawerProps) {
  const titleId = useId()
  const drawerRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    previouslyFocused.current = document.activeElement as HTMLElement | null
    const drawerEl = drawerRef.current
    const focusable = drawerEl?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ;(focusable?.[0] ?? drawerEl)?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !drawerEl) return
      const items = drawerEl.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previouslyFocused.current?.focus()
    }
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: motionDuration.base, ease: motionEasing.out }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: motionDuration.base, ease: motionEasing.out }}
            onClick={(e) => e.stopPropagation()}
            className={`fixed right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-slate-950/95 backdrop-blur-md border-l border-glass-border shadow-glass flex flex-col z-50 outline-none ${className}`}
          >
            <div className="flex items-center justify-between p-5 border-b border-glass-border">
              {title ? (
                <h2 id={titleId} className="text-lg font-semibold text-slate-100">
                  {title}
                </h2>
              ) : (
                <span className="text-lg font-semibold text-slate-100">منوی ناوبری</span>
              )}
              <Button
                variant="secondary"
                onClick={onClose}
                aria-label="بستن منو"
                className="p-2"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

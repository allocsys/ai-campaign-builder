import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { motionDuration, motionEasing } from './animation-tokens'

export type ToastTone = 'info' | 'success' | 'warning' | 'danger'

interface ToastItem {
  id: string
  message: string
  tone: ToastTone
}

interface ToastContextValue {
  show: (message: string, tone?: ToastTone) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const toneClasses: Record<ToastTone, string> = {
  info: 'border-glass-border',
  success: 'border-emerald-500/50',
  warning: 'border-amber-500/50',
  danger: 'border-red-500/50',
}

const toastVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
}

/**
 * Individual toast. Perf: backdrop-blur is applied only once the slide/fade-in has
 * settled and dropped as soon as it starts leaving -- see Modal/Drawer for why
 * (blurring a moving element forces a full re-sample every frame).
 */
function ToastBubble({ id, message, tone }: ToastItem) {
  const [settled, setSettled] = useState(false)

  return (
    <motion.div
      key={id}
      role={tone === 'danger' ? 'alert' : undefined}
      initial="hidden"
      animate="visible"
      exit="hidden"
      variants={toastVariants}
      transition={{ duration: motionDuration.base, ease: motionEasing.out }}
      onAnimationComplete={(label) => {
        if (label === 'visible') setSettled(true)
      }}
      className={`bg-slate-950/90 border rounded-xl2 shadow-glass px-4 py-2.5 text-sm text-slate-100 max-w-sm w-full pointer-events-auto ${
        settled ? 'backdrop-blur-md' : ''
      } ${toneClasses[tone]}`}
    >
      {message}
    </motion.div>
  )
}

/** Wrap an app's root in this once; call useToast().show(...) anywhere below it. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const show = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, tone }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        className="fixed bottom-4 inset-x-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <ToastBubble key={t.id} {...t} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}

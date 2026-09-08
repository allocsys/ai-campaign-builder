import { type ReactNode, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

export interface AccordionItem {
  id: string
  header: ReactNode
  content: ReactNode
}

export interface AccordionProps {
  items: AccordionItem[]
  /** Controlled open item id. Omit for uncontrolled (internal state). */
  openId?: string
  /** Called on header click, and on programmatic opens if you drive `openId` yourself. */
  onOpenChange?: (id: string) => void
  defaultOpenId?: string
}

/**
 * Click-to-expand accordion — mirrors the mockup's business-owner dashboard nav pattern
 * (toggleAccordionItem for header clicks, switchTab for programmatic opens from elsewhere).
 * No auto-advance-to-next-panel: the mockup tried that once and the user disliked it (see
 * session notes) — this component deliberately does not do that either.
 */
export function Accordion({ items, openId, onOpenChange, defaultOpenId }: AccordionProps) {
  const [internalOpen, setInternalOpen] = useState<string | undefined>(defaultOpenId ?? items[0]?.id)
  const activeId = openId ?? internalOpen

  const handleToggle = (id: string) => {
    const next = activeId === id ? undefined : id
    if (openId === undefined) setInternalOpen(next)
    if (next) onOpenChange?.(next)
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => {
        const isOpen = activeId === item.id
        return (
          <div
            key={item.id}
            className="bg-glass-light backdrop-blur-md border border-glass-border rounded-xl2 overflow-hidden"
          >
            <button
              type="button"
              onClick={() => handleToggle(item.id)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-100"
              aria-expanded={isOpen}
            >
              {item.header}
              <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                ▾
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="px-4 pb-4"
                >
                  {item.content}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

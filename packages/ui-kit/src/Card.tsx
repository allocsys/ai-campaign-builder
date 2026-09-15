import { useState, type HTMLAttributes } from 'react'
import { motion } from 'framer-motion'
import { motionDuration, motionEasing } from './animation-tokens'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean
}

/**
 * The base glass-panel surface, promoted to a shared component (was a raw CSS class in the Step-1 scaffold).
 *
 * Perf: backdrop-blur is only applied once the mount animation settles, not while
 * opacity/y are still animating in. Dashboards can mount many Cards at once, and
 * each one carrying backdrop-blur during its own entrance forces a separate full
 * blur re-sample per card per frame -- the main cause of janky list/dashboard loads.
 * Once settled (mount animation done, or hoverable=false), the blur is static and cheap.
 */
export function Card({ hoverable = false, className = '', children, ...rest }: CardProps) {
  const [settled, setSettled] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={hoverable ? { y: -2 } : undefined}
      transition={{ duration: motionDuration.slow, ease: motionEasing.out }}
      onAnimationComplete={() => setSettled(true)}
      className={`bg-glass-light border border-glass-border rounded-xl2 shadow-glass p-5 ${
        settled ? 'backdrop-blur-md' : ''
      } ${className}`}
      {...(rest as any)}
    >
      {children}
    </motion.div>
  )
}

import { type HTMLAttributes } from 'react'
import { motion } from 'framer-motion'
import { motionDuration, motionEasing } from './animation-tokens'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean
}

/** The base glass-panel surface, promoted to a shared component (was a raw CSS class in the Step-1 scaffold). */
export function Card({ hoverable = false, className = '', children, ...rest }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={hoverable ? { y: -2 } : undefined}
      transition={{ duration: motionDuration.slow, ease: motionEasing.out }}
      className={`bg-glass-light backdrop-blur-md border border-glass-border rounded-xl2 shadow-glass p-5 ${className}`}
      {...(rest as any)}
    >
      {children}
    </motion.div>
  )
}

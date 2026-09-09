/**
 * Centralized Framer Motion timing tokens for @ai-campaign-builder/ui-kit.
 *
 * Step 9 polish (2026-09-09): previously each component (Accordion, Card, Modal,
 * Toast) hardcoded its own duration/easing values inline, with no shared source
 * of truth — small inconsistencies (0.2 vs 0.25 vs 0.35) had crept in with no way
 * to tell which were intentional vs accidental drift. These tokens don't change
 * any existing component's visual behavior (values match what was already there);
 * they just give future components — and any future retuning — one place to look.
 *
 * Scale (three tiers, not one, since a single global duration doesn't fit every
 * motion type — a chevron flip should read as snappier than a modal entrance):
 *   - fast: micro-interactions (icon rotation, small state flips)
 *   - base: standard UI transitions (panel expand/collapse, modal/toast enter-exit)
 *   - slow: larger entrance animations (card mount, bigger layout shifts)
 */

export const motionDuration = {
  fast: 0.2,
  base: 0.25,
  slow: 0.35,
} as const

export const motionEasing = {
  /** Standard exit-decelerating curve — used for nearly everything here. */
  out: 'easeOut',
} as const

export type MotionDurationToken = keyof typeof motionDuration
export type MotionEasingToken = keyof typeof motionEasing

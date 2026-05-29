// ─── MA Finance OS — Motion System ───────────────────────────────────────────
// Variants sourced from: portifolio-rho-rosy-34.vercel.app/src/lib/motion.ts

import type { Variants, Transition } from 'framer-motion'

// ── Easing — exact values from portfolio ──────────────────────────────────────
export const ease = {
  cinema:  [0.22, 1, 0.36, 1]  as [number, number, number, number],
  drift:   [0.65, 0, 0.35, 1]  as [number, number, number, number],
  settle:  [0.16, 1, 0.30, 1]  as [number, number, number, number],
  out:     [0.33, 1, 0.68, 1]  as [number, number, number, number],
  // legacy aliases
  expoOut: [0.16, 1, 0.30, 1]  as [number, number, number, number],
  spring:  [0.34, 1.56, 0.64, 1] as [number, number, number, number],
}

// ── Transition presets — from portfolio durations ─────────────────────────────
export const t = {
  fast:     { duration: 0.4,  ease: ease.settle  } satisfies Transition,
  base:     { duration: 0.9,  ease: ease.cinema  } satisfies Transition,
  slow:     { duration: 1.6,  ease: ease.cinema  } satisfies Transition,
  epic:     { duration: 2.4,  ease: ease.drift   } satisfies Transition,
  drift:    { duration: 1.2,  ease: ease.drift   } satisfies Transition,
  springy:  { type: 'spring', stiffness: 100, damping: 20 } satisfies Transition,
}

// ── fadeRise — fade + rise + blur dissolve ────────────────────────────────────
export const fadeRise: Variants = {
  hidden: { opacity: 0, y: 28, filter: 'blur(7px)' },
  show: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { duration: 1.2, ease: ease.cinema },
  },
}

// ── fadeIn — pure opacity + subtle blur ──────────────────────────────────────
export const fadeIn: Variants = {
  hidden: { opacity: 0, filter: 'blur(4px)' },
  show: {
    opacity: 1, filter: 'blur(0px)',
    transition: { duration: 1.6, ease: ease.settle },
  },
}

// ── blurUp — faster blur + small rise, for cards/widgets ─────────────────────
export const blurUp: Variants = {
  hidden: { opacity: 0, y: 14, filter: 'blur(8px)' },
  show: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] },
  },
}

// ── maskUp — clip-path reveal + y, 1.4s cinema ───────────────────────────────
export const maskUp: Variants = {
  hidden: { clipPath: 'inset(0 0 100% 0)', y: 12 },
  show: {
    clipPath: 'inset(0 0 0% 0)', y: 0,
    transition: { duration: 1.4, ease: ease.cinema },
  },
}

// ── charStagger — individual characters, 0.04s interval ──────────────────────
export const charStagger: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.10,
    },
  },
}

export const charChild: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1, y: 0,
    transition: { duration: 0.6, ease: ease.settle },
  },
}

// ── groupStagger — sections/cards, 0.12s interval ────────────────────────────
export const groupStagger: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.15,
    },
  },
}

export const groupItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1, y: 0,
    transition: { duration: 0.9, ease: ease.cinema },
  },
}

// ── Hero variants ─────────────────────────────────────────────────────────────
export const heroContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.14, delayChildren: 0.2 },
  },
}

export const heroTitle: Variants = {
  hidden:  { opacity: 0, y: 36, clipPath: 'inset(0 0 100% 0)' },
  visible: {
    opacity: 1, y: 0, clipPath: 'inset(0 0 0% 0)',
    transition: { duration: 1.4, ease: ease.cinema },
  },
}

export const heroSubtitle: Variants = {
  hidden:  { opacity: 0, y: 20 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 1.0, ease: ease.settle },
  },
}

// ── Sidebar nav items ─────────────────────────────────────────────────────────
export const sidebarItem: Variants = {
  hidden:  { opacity: 0, x: -20, filter: 'blur(3px)' },
  visible: {
    opacity: 1, x: 0, filter: 'blur(0px)',
    transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] },
  },
}

export const staggerContainerSlow: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.10 },
  },
}

// ── Page transition ───────────────────────────────────────────────────────────
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1, y: 0,
    transition: { duration: 0.9, ease: ease.settle },
  },
  exit: {
    opacity: 0, y: -8,
    transition: { duration: 0.4, ease: ease.drift },
  },
}

// ── Card interactions ─────────────────────────────────────────────────────────
export const cardHover = {
  rest:  { scale: 1,    y: 0  },
  hover: { scale: 1.01, y: -3, transition: { duration: 0.4, ease: ease.settle } },
}

// ── Number / currency helpers ─────────────────────────────────────────────────
export function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

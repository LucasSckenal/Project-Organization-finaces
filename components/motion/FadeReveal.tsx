'use client'

import { useRef, type ReactNode } from 'react'
import { motion, useInView } from 'framer-motion'
import { fadeRise, fadeIn, maskUp, blurUp, ease } from '@/lib/motion'

interface FadeRevealProps {
  children:   ReactNode
  variant?:   'rise' | 'in' | 'mask' | 'blur'
  delay?:     number
  duration?:  number
  className?: string
  once?:      boolean
  threshold?: number
}

export function FadeReveal({
  children,
  variant   = 'rise',
  delay     = 0,
  duration,
  className,
  once      = true,
  threshold = 0.1,
}: FadeRevealProps) {
  const ref    = useRef(null)
  const inView = useInView(ref, { once, amount: threshold, margin: '0px 0px -60px 0px' })

  const variantMap = { rise: fadeRise, in: fadeIn, mask: maskUp, blur: blurUp }
  const selected   = variantMap[variant]

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? 'show' : 'hidden'}
      variants={selected}
      style={{ willChange: 'opacity, transform, filter' }}
      custom={delay}
      transition={duration ? { duration, delay, ease: ease.cinema } : { delay }}
    >
      {children}
    </motion.div>
  )
}

// ── Stagger wrapper ───────────────────────────────────────────────────────────
interface StaggerRevealProps {
  children:   ReactNode
  stagger?:   number
  delay?:     number
  className?: string
}

export function StaggerReveal({
  children,
  stagger   = 0.10,
  delay     = 0,
  className,
}: StaggerRevealProps) {
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.06, margin: '0px 0px -40px 0px' })

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? 'show' : 'hidden'}
      variants={{
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: { staggerChildren: stagger, delayChildren: delay },
        },
      }}
    >
      {children}
    </motion.div>
  )
}

// ── Stagger item — blur + rise ────────────────────────────────────────────────
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      style={{ willChange: 'opacity, transform, filter' }}
      variants={{
        hidden: { opacity: 0, y: 20, filter: 'blur(5px)' },
        show: {
          opacity: 1, y: 0, filter: 'blur(0px)',
          transition: { duration: 0.85, ease: ease.cinema },
        },
      }}
    >
      {children}
    </motion.div>
  )
}

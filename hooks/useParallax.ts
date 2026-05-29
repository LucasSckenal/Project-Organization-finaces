'use client'

import { useEffect } from 'react'
import { useMotionValue, useSpring, useTransform } from 'framer-motion'

/**
 * Tracks mouse position and returns smooth spring-interpolated MotionValues.
 * Uses Framer Motion MotionValues so zero React re-renders — all GPU composited.
 *
 * @param strength - max pixel offset (default 20)
 * @param stiffness / damping - spring feel (default: 28 / 18 = slow, floaty)
 */
export function useParallax(strength = 20, stiffness = 28, damping = 18) {
  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)

  const x = useSpring(rawX, { stiffness, damping })
  const y = useSpring(rawY, { stiffness, damping })

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      rawX.set((e.clientX / window.innerWidth  - 0.5) * strength * 2)
      rawY.set((e.clientY / window.innerHeight - 0.5) * strength * 2)
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [strength, rawX, rawY])

  // Helpers for counter-parallax and scaled offsets
  const xInv  = useTransform(x, (v) => -v * 0.65)
  const yInv  = useTransform(y, (v) => -v * 0.65)
  const xHalf = useTransform(x, (v) =>  v * 0.38)
  const yHalf = useTransform(y, (v) =>  v * 0.38)

  return { x, y, xInv, yInv, xHalf, yHalf }
}

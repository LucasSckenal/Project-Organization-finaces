'use client'

import { useEffect, useRef } from 'react'
import Lenis from 'lenis'

let lenisInstance: Lenis | null = null

export function useLenis() {
  const rafRef = useRef<number>(0)

  useEffect(() => {
    lenisInstance = new Lenis({
      duration:        1.4,
      easing:          (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel:     true,
      wheelMultiplier: 0.8,
      touchMultiplier: 1.2,
    })

    function raf(time: number) {
      lenisInstance?.raf(time)
      rafRef.current = requestAnimationFrame(raf)
    }

    rafRef.current = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(rafRef.current)
      lenisInstance?.destroy()
      lenisInstance = null
    }
  }, [])

  return lenisInstance
}

export function getLenis() {
  return lenisInstance
}

export function useScrollTo() {
  return (target: string | HTMLElement, offset = 0) => {
    lenisInstance?.scrollTo(target as any, {
      offset,
      duration: 1.6,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    })
  }
}

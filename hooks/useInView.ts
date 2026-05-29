'use client'

import { useEffect, useRef, useState } from 'react'

interface UseInViewOptions {
  threshold?: number
  rootMargin?: string
  once?: boolean
}

export function useInView({
  threshold = 0.1,
  rootMargin = '0px 0px -60px 0px',
  once = true,
}: UseInViewOptions = {}) {
  const ref = useRef<HTMLElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          if (once) observer.disconnect()
        } else if (!once) {
          setInView(false)
        }
      },
      { threshold, rootMargin }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold, rootMargin, once])

  return { ref, inView }
}

// Staggered children reveal
export function useStaggerReveal(count: number, baseDelay = 0, step = 80) {
  return Array.from({ length: count }, (_, i) => ({
    delay: baseDelay + i * step,
  }))
}

'use client'

// Adds data-vis="" when the element scrolls into view.
// CSS transitions handle the visual animation — no keyframe hash issues.
import { useEffect, useRef, type ComponentPropsWithoutRef } from 'react'

type Props = ComponentPropsWithoutRef<'div'>

export function Reveal({ children, ...props }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.setAttribute('data-vis', '')
          obs.disconnect()
        }
      },
      { threshold: 0.1, rootMargin: '-24px 0px' },
    )

    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={ref} {...props}>
      {children}
    </div>
  )
}

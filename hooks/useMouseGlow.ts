'use client'

import { useEffect, useRef, useCallback } from 'react'

interface MouseGlowOptions {
  radius?: number
  intensity?: number
  color?: string
}

export function useMouseGlow({
  radius = 400,
  intensity = 0.06,
  color = '155, 58, 74',
}: MouseGlowOptions = {}) {
  const glowRef = useRef<HTMLDivElement>(null)
  const posRef = useRef({ x: 0, y: 0 })
  const rafRef = useRef<number>(0)

  const handleMouseMove = useCallback((e: MouseEvent) => {
    posRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  useEffect(() => {
    const el = glowRef.current
    if (!el) return

    const update = () => {
      const { x, y } = posRef.current
      el.style.background = `radial-gradient(
        ${radius}px circle at ${x}px ${y}px,
        rgba(${color}, ${intensity}) 0%,
        transparent 70%
      )`
      rafRef.current = requestAnimationFrame(update)
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    rafRef.current = requestAnimationFrame(update)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [radius, intensity, color, handleMouseMove])

  return glowRef
}

// Magnetic hover — elements that follow the cursor slightly
export function useMagneticHover(strength = 0.3) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = (e.clientX - cx) * strength
      const dy = (e.clientY - cy) * strength
      el.style.transform = `translate(${dx}px, ${dy}px)`
    }

    const handleLeave = () => {
      el.style.transform = 'translate(0, 0)'
      el.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
    }

    const handleEnter = () => {
      el.style.transition = 'transform 0.1s ease-out'
    }

    el.addEventListener('mousemove', handleMove)
    el.addEventListener('mouseleave', handleLeave)
    el.addEventListener('mouseenter', handleEnter)

    return () => {
      el.removeEventListener('mousemove', handleMove)
      el.removeEventListener('mouseleave', handleLeave)
      el.removeEventListener('mouseenter', handleEnter)
    }
  }, [strength])

  return ref
}

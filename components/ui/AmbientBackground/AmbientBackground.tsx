'use client'

import { motion } from 'framer-motion'
import { useMouseGlow } from '@/hooks/useMouseGlow'
import { useParallax } from '@/hooks/useParallax'
import styles from './AmbientBackground.module.scss'

export function AmbientBackground() {
  const glowRef = useMouseGlow({ radius: 480, intensity: 0.06 })

  // Slow, floaty parallax — each orb moves at a different depth
  const { x, y, xInv, yInv, xHalf, yHalf } = useParallax(18, 22, 16)

  return (
    <div className={styles.root} aria-hidden="true">

      {/* 1 — Base color */}
      <div className={styles.void} />

      {/* 2 — Directional gradients */}
      <div className={styles.gradient} />

      {/* 3 & 4 — Noise grain layers */}
      <div className={styles.grain} />
      <div className={styles.grainFine} />

      {/* 5 — Ambient orbs with mouse parallax
              orbAccent moves WITH mouse (foreground feel)
              orbGold   moves AGAINST (counter-parallax = depth)
              orbDeep   subtle half-speed (mid-ground) */}
      <motion.div
        className={`${styles.orb} ${styles.orbAccent}`}
        style={{ x, y }}
      />
      <motion.div
        className={`${styles.orb} ${styles.orbGold}`}
        style={{ x: xInv, y: yInv }}
      />
      <motion.div
        className={`${styles.orb} ${styles.orbDeep}`}
        style={{ x: xHalf, y: yHalf }}
      />

      {/* 6 — Mouse-follow radial glow */}
      <div
        ref={glowRef}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          transition: 'background 0.08s ease-out',
        }}
      />

      {/* 7 — Scan line */}
      <div className={styles.scanLine} />

      {/* 8 — Vignette */}
      <div className={styles.vignette} />

      {/* 9 — Corner pools */}
      <div className={styles.vignetteCorners} />

    </div>
  )
}

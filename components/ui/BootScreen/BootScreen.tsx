'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSound } from '@/contexts/SoundContext'
import styles from './BootScreen.module.scss'

const STATUS_SEQUENCE = [
  'Initializing kernel…',
  'Connecting to Firebase…',
  'Loading portfolio data…',
  'Syncing transactions…',
  'Mounting interface…',
  'System ready.',
]

// Character-by-character typewriter
function Typewriter({ text, delay = 0 }: { text: string; delay?: number }) {
  const [displayed, setDisplayed] = useState('')
  useEffect(() => {
    let i = 0
    const timeout = setTimeout(() => {
      const id = setInterval(() => {
        setDisplayed(text.slice(0, ++i))
        if (i >= text.length) clearInterval(id)
      }, 38)
      return () => clearInterval(id)
    }, delay * 1000)
    return () => clearTimeout(timeout)
  }, [text, delay])
  return <>{displayed}</>
}

export function BootScreen() {
  const { play }              = useSound()
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusIdx, setStatusIdx] = useState(0)
  const [phase, setPhase]     = useState<'booting' | 'done'>('booting')
  const startedRef             = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    // Skip if already booted this session
    if (sessionStorage.getItem('ma-os-booted')) return

    sessionStorage.setItem('ma-os-booted', '1')
    setVisible(true)

    // Play boot sound after a short delay
    setTimeout(() => play('boot'), 700)

    // Status cycling — start after 1.1s
    let idx = 0
    const statusTimer = setTimeout(() => {
      const id = setInterval(() => {
        idx++
        if (idx < STATUS_SEQUENCE.length) {
          setStatusIdx(idx)
        } else {
          clearInterval(id)
        }
      }, 340)
      return () => clearInterval(id)
    }, 1100)

    // Progress bar — 2.4s total
    const startAt = Date.now()
    const duration = 2400
    const rafRef = { id: 0 }
    const tick = () => {
      const p = Math.min(100, ((Date.now() - startAt) / duration) * 100)
      setProgress(p)
      if (p < 100) {
        rafRef.id = requestAnimationFrame(tick)
      } else {
        setPhase('done')
        setTimeout(() => setVisible(false), 700)
      }
    }
    const progTimer = setTimeout(() => { rafRef.id = requestAnimationFrame(tick) }, 800)

    return () => {
      clearTimeout(statusTimer)
      clearTimeout(progTimer)
      cancelAnimationFrame(rafRef.id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={styles.screen}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.01 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* CRT scanlines texture */}
          <div className={styles.scanlines} aria-hidden />

          {/* Ambient glow */}
          <div className={styles.glow} aria-hidden />

          {/* Center stage */}
          <div className={styles.center}>
            {/* Kanji mark */}
            <motion.div
              className={styles.kanji}
              initial={{ opacity: 0, scale: 0.85, filter: 'blur(8px)' }}
              animate={{ opacity: 1, scale: 1,    filter: 'blur(0px)' }}
              transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
            >
              間
            </motion.div>

            {/* Title block */}
            <motion.div
              className={styles.titleBlock}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1,  y: 0  }}
              transition={{ duration: 0.9, delay: 0.75 }}
            >
              <span className={styles.titleOs}>
                <Typewriter text="MA FINANCE OS" delay={0.75} />
                <span className={styles.cursor}>▋</span>
              </span>
              <span className={styles.titleBuild}>v1.0 · 2026 · Cinematic Edition</span>
            </motion.div>

            {/* Load block */}
            <motion.div
              className={styles.loadBlock}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1, duration: 0.5 }}
            >
              {/* Progress bar */}
              <div className={styles.track} role="progressbar" aria-valuenow={Math.round(progress)}>
                <motion.div
                  className={`${styles.fill} ${phase === 'done' ? styles.fillDone : ''}`}
                  style={{ width: `${progress}%` }}
                />
                <div className={styles.trackGlow} style={{ left: `${progress}%` }} />
              </div>

              {/* Status message */}
              <div className={styles.status}>
                <span className={`${styles.statusDot} ${phase === 'done' ? styles.statusDotReady : ''}`} />
                <span className={styles.statusText}>
                  {STATUS_SEQUENCE[statusIdx]}
                </span>
                <span className={styles.progressNum}>
                  {Math.round(progress)}%
                </span>
              </div>
            </motion.div>
          </div>

          {/* Corner watermarks */}
          <div className={styles.cornerTL} aria-hidden>FINANCE — OS</div>
          <div className={styles.cornerBR} aria-hidden>間 / SYSTEM</div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

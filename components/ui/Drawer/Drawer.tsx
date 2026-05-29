'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import styles from './Drawer.module.scss'

interface DrawerProps {
  isOpen:   boolean
  onClose:  () => void
  title:    string
  children: React.ReactNode
  width?:   number
}

export function Drawer({ isOpen, onClose, title, children, width = 440 }: DrawerProps) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (isOpen) {
      document.addEventListener('keydown', onKey)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (typeof window === 'undefined') return null

  // On mobile: slide up from bottom (full-width sheet)
  // On desktop: slide in from right (side panel)
  const drawerVariants = isMobile
    ? { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }
    : { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />
          <motion.aside
            className={styles.drawer}
            style={isMobile ? undefined : { width }}
            initial={drawerVariants.initial}
            animate={drawerVariants.animate}
            exit={drawerVariants.exit}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
          >
            <div className={styles.header}>
              <span className={styles.title}>{title}</span>
              <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
            </div>
            <div className={styles.body}>{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}

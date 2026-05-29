'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useSound } from '@/contexts/SoundContext'

// ── Types ─────────────────────────────────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id:      string
  message: string
  type:    ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const { play } = useSound()

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `t-${Date.now()}`
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => dismiss(id), 3500)
    // Play sound based on type
    if (type === 'success') play('success')
    else if (type === 'error') play('error')
    else play('notify')
  }, [dismiss, play])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* ── Toast stack — fixed bottom-right ───────────────────────── */}
      <div
        aria-live="polite"
        aria-atomic="false"
        style={{
          position:      'fixed',
          bottom:        '24px',
          right:         '24px',
          zIndex:        9999,
          display:       'flex',
          flexDirection: 'column',
          gap:           '8px',
          pointerEvents: 'none',
          maxWidth:      '320px',
          width:         'calc(100vw - 48px)',
        }}
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 14,  scale: 0.94 }}
              animate={{ opacity: 1, y: 0,   scale: 1    }}
              exit={{    opacity: 0, y: -10,  scale: 0.94 }}
              transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => dismiss(t.id)}
              style={{
                pointerEvents:  'auto',
                cursor:         'pointer',
                padding:        '10px 16px',
                borderRadius:   '8px',
                fontSize:       '13px',
                letterSpacing:  '0.015em',
                lineHeight:     1.45,
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                boxShadow:      '0 4px 28px rgba(0,0,0,0.5)',
                userSelect:     'none',
                background:
                  t.type === 'success' ? 'rgba(20, 46, 28, 0.97)' :
                  t.type === 'error'   ? 'rgba(60, 22, 22, 0.97)' :
                                        'rgba(20, 17, 13, 0.97)',
                border: `1px solid ${
                  t.type === 'success' ? 'rgba(74, 124, 89,  0.5)'  :
                  t.type === 'error'   ? 'rgba(160, 68, 68,  0.5)'  :
                                        'rgba(255, 249, 240, 0.12)'
                }`,
                color:
                  t.type === 'success' ? '#7ab990' :
                  t.type === 'error'   ? '#c07070' :
                                        'rgba(242, 239, 233, 0.84)',
              }}
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

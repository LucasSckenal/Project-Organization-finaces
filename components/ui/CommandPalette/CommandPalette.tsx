'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/contexts/ThemeContext'
import { useSound } from '@/contexts/SoundContext'
import { useT } from '@/hooks/useT'
import styles from './CommandPalette.module.scss'

// Maps command id → translation key
const CMD_KEY: Record<string, string> = {
  overview: 'section.overview', analytics: 'section.analytics', expenses: 'section.expenses',
  invest: 'section.invest', goals: 'section.goals', budget: 'section.budget', reports: 'section.reports',
  __new: 'cmd.newTransaction', __chat: 'cmd.openAI', __theme: 'cmd.toggleTheme',
  __sound: 'cmd.toggleSound', __boot: 'cmd.replayBoot', __profile: 'nav.profile',
}
const CAT_KEY: Record<string, string> = {
  navigate: 'cmd.navigate', actions: 'cmd.actions', settings: 'cmd.settings',
}

// ── Command registry ──────────────────────────────────────────────────────────
type CommandCategory = 'navigate' | 'actions' | 'settings'

interface Command {
  id:        string
  num:       string
  label:     string
  hint?:     string
  shortcut?: string
  category:  CommandCategory
}

const COMMANDS: Command[] = [
  // Navigate
  { id: 'overview',  num: '01', label: 'Dashboard Overview',  hint: 'Home',     category: 'navigate' },
  { id: 'analytics', num: '02', label: 'Financial Analytics', hint: 'Charts',   shortcut: 'A', category: 'navigate' },
  { id: 'expenses',  num: '03', label: 'Transactions',         hint: 'Ledger',   shortcut: 'T', category: 'navigate' },
  { id: 'invest',    num: '04', label: 'Investment Portfolio', hint: 'Assets',   category: 'navigate' },
  { id: 'goals',     num: '05', label: 'Financial Goals',      hint: 'Targets',  shortcut: 'G', category: 'navigate' },
  { id: 'budget',    num: '06', label: 'Budget Planner',       hint: 'Limits',   shortcut: 'B', category: 'navigate' },
  { id: 'reports',   num: '07', label: 'Reports',              hint: 'Insights', category: 'navigate' },
  // Actions
  { id: '__new',     num: '＋',  label: 'New Transaction',     hint: 'Add',      shortcut: 'N', category: 'actions'  },
  { id: '__chat',    num: '✦',   label: 'Open AI Assistant',   hint: 'Ask Ma',   category: 'actions'  },
  { id: '__theme',   num: '◑',   label: 'Toggle Day / Night',  hint: 'Theme',    category: 'actions'  },
  { id: '__sound',   num: '♪',   label: 'Toggle Sound',        hint: 'Audio',    category: 'actions'  },
  { id: '__boot',    num: '⟳',   label: 'Replay Boot Screen',  hint: 'Cinematic', category: 'actions' },
  // Settings
  { id: '__profile', num: '⚙',   label: 'Settings & Profile',  hint: 'Account',  category: 'settings' },
]

const CATEGORY_LABELS: Record<CommandCategory, string> = {
  navigate: 'Navigate',
  actions:  'Actions',
  settings: 'Settings',
}

interface Props {
  isOpen:       boolean
  onClose:      () => void
  onNavigate:   (id: string) => void
  onOpenChat?:  () => void
}

export function CommandPalette({ isOpen, onClose, onNavigate, onOpenChat }: Props) {
  const [query,   setQuery]   = useState('')
  const [focused, setFocused] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router   = useRouter()
  const { toggleTheme, theme } = useTheme()
  const { play, muted, toggleMute } = useSound()
  const t = useT()

  const q = query.toLowerCase()
  const filtered = COMMANDS.filter(
    (c) =>
      c.label.toLowerCase().includes(q) ||
      t(CMD_KEY[c.id], c.label).toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q)    ||
      (c.hint ?? '').toLowerCase().includes(q),
  )

  // Group by category (only show categories that have results)
  const grouped = (['navigate', 'actions', 'settings'] as CommandCategory[])
    .map((cat) => ({ cat, items: filtered.filter((c) => c.category === cat) }))
    .filter((g) => g.items.length > 0)

  // Flat index for keyboard navigation
  const flatFiltered = grouped.flatMap((g) => g.items)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setFocused(0)
      play('open')
      const t = setTimeout(() => inputRef.current?.focus(), 40)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  useEffect(() => { setFocused(0) }, [query])

  const handleSelect = useCallback((id: string) => {
    play('click')
    onClose()

    switch (id) {
      case '__profile': router.push('/profile'); break
      case '__chat':    onOpenChat?.();          break
      case '__theme':   toggleTheme();           break
      case '__sound':   toggleMute();            break
      case '__new':
        window.dispatchEvent(new CustomEvent('ma:new-transaction'))
        break
      case '__boot':
        sessionStorage.removeItem('ma-os-booted')
        window.location.reload()
        break
      default:
        onNavigate(id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, onNavigate, onOpenChat, router, toggleTheme, toggleMute, play])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'Escape')    { e.preventDefault(); play('close'); onClose(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setFocused((v) => Math.min(v + 1, flatFiltered.length - 1)); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setFocused((v) => Math.max(v - 1, 0)); return }
      if (e.key === 'Enter') {
        e.preventDefault()
        const item = flatFiltered[focused]
        if (item) handleSelect(item.id)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, flatFiltered, focused, handleSelect])

  if (typeof window === 'undefined') return null

  let flatIdx = 0

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => { play('close'); onClose() }}
          />

          <motion.div
            className={styles.palette}
            initial={{ opacity: 0, scale: 0.96, y: -12 }}
            animate={{ opacity: 1, scale: 1,    y: 0   }}
            exit={{    opacity: 0, scale: 0.96, y: -12  }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal
            aria-label="Command palette"
          >
            {/* Search */}
            <div className={styles.inputRow}>
              <span className={styles.searchIcon}>⌕</span>
              <input
                ref={inputRef}
                className={styles.input}
                placeholder={t('cmd.placeholder')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <div className={styles.inputMeta}>
                <span className={styles.themeIndicator}>
                  {theme === 'dark' ? '◑' : '○'}
                </span>
                <button
                  className={styles.closeBtn}
                  onClick={() => { play('close'); onClose() }}
                  aria-label="Close"
                  title="Close (Esc)"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Results */}
            <div className={styles.results}>
              {grouped.length > 0 ? grouped.map(({ cat, items }) => (
                <div key={cat} className={styles.group}>
                  <div className={styles.groupLabel}>{t(CAT_KEY[cat], CATEGORY_LABELS[cat])}</div>
                  {items.map((item) => {
                    const isFocused = flatIdx === focused
                    const currentIdx = flatIdx
                    flatIdx++

                    const isActive =
                      (item.id === '__theme' && theme === 'light') ||
                      (item.id === '__sound' && muted)

                    return (
                      <button
                        key={item.id}
                        className={`${styles.result} ${isFocused ? styles.resultFocused : ''} ${isActive ? styles.resultActive : ''}`}
                        onClick={() => handleSelect(item.id)}
                        onMouseEnter={() => setFocused(currentIdx)}
                      >
                        <span className={styles.resultNum}>{item.num}</span>
                        <span className={styles.resultLabel}>{t(CMD_KEY[item.id], item.label)}</span>
                        {item.hint && <span className={styles.resultHint}>{item.hint}</span>}
                        {item.shortcut && <kbd className={styles.shortcutBadge}>{item.shortcut}</kbd>}
                        <span className={styles.resultArrow}>↗</span>
                      </button>
                    )
                  })}
                </div>
              )) : (
                <div className={styles.empty}>{t('cmd.noResults')} &quot;{query}&quot;</div>
              )}
            </div>

            {/* Footer */}
            <div className={styles.footer}>
              <span><kbd>↑↓</kbd> {t('cmd.navigateHint')}</span>
              <span><kbd>↵</kbd> {t('cmd.selectHint')}</span>
              <span className={styles.footerRight}>{flatFiltered.length} {t('cmd.commands')}</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}

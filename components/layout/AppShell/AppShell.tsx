'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter, usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar/Sidebar'
import { AmbientBackground } from '@/components/ui/AmbientBackground/AmbientBackground'
import { CommandPalette } from '@/components/ui/CommandPalette/CommandPalette'
import { ChatPanel }      from '@/components/ui/ChatPanel/ChatPanel'
import { VerifyBanner }    from '@/components/ui/VerifyBanner/VerifyBanner'
import { useLenis, getLenis } from '@/hooks/useLenis'
import { useTheme } from '@/contexts/ThemeContext'
import { useSound } from '@/contexts/SoundContext'
import { useProcessRecurrences } from '@/hooks/useFirestore'
import { useT } from '@/hooks/useT'
import { pageTransition } from '@/lib/motion'
import styles from './AppShell.module.scss'

// ── Inline icon set ───────────────────────────────────────────────────────────
const S = 15  // unified icon size

const IconSearch = () => (
  <svg width={S} height={S} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7.5" />
    <line x1="20" y1="20" x2="16.5" y2="16.5" />
  </svg>
)

const IconMoon = () => (
  <svg width={S} height={S} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
)

const IconSun = () => (
  <svg width={S} height={S} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2"  x2="12" y2="5"  />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="4.22" y1="4.22"   x2="6.34" y2="6.34"   />
    <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
    <line x1="2"  y1="12" x2="5"  y2="12" />
    <line x1="19" y1="12" x2="22" y2="12" />
    <line x1="4.22" y1="19.78"  x2="6.34" y2="17.66"  />
    <line x1="17.66" y1="6.34"  x2="19.78" y2="4.22"  />
  </svg>
)

const IconSoundOn = () => (
  <svg width={S} height={S} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
)

const IconSoundOff = () => (
  <svg width={S} height={S} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9"  x2="17" y2="15" />
    <line x1="17" y1="9"  x2="23" y2="15" />
  </svg>
)

const IconSparkle = () => (
  <svg width={S} height={S} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74z" />
    <path d="M5 3l.74 2.22L8 6l-2.26.78L5 9l-.74-2.22L2 6l2.26-.78z" opacity=".55" />
    <path d="M19 14l.56 1.68L21 16l-1.44.32L19 18l-.56-1.68L17 16l1.44-.32z" opacity=".45" />
  </svg>
)

const IconUser = () => (
  <svg width={S} height={S} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

interface AppShellProps {
  children:       React.ReactNode
  staticSection?: string   // when set: skip IntersectionObserver, show this as active section
}

const SECTION_LABELS: Record<string, string> = {
  overview:  'Dashboard Overview',
  analytics: 'Financial Analytics',
  expenses:  'Transactions',
  invest:    'Investment Portfolio',
  goals:     'Financial Goals',
  budget:    'Budget Planner',
  reports:   'Reports',
  profile:   'Settings & Profile',
}

const SECTION_NUMS: Record<string, string> = {
  overview:  '01',
  analytics: '02',
  expenses:  '03',
  invest:    '04',
  goals:     '05',
  budget:    '06',
  reports:   '07',
  profile:   '⚙',
}

const SECTION_IDS = ['overview', 'analytics', 'expenses', 'invest', 'goals']

export function AppShell({ children, staticSection }: AppShellProps) {
  const [activeSection,   setActiveSection]   = useState(staticSection ?? 'overview')
  const [mobileNavOpen,   setMobileNavOpen]   = useState(false)
  const [paletteOpen,     setPaletteOpen]     = useState(false)
  const [chatOpen,        setChatOpen]        = useState(false)
  const [transitioning,   setTransitioning]   = useState(false)

  const router   = useRouter()
  const pathname = usePathname()
  const { theme, toggleTheme } = useTheme()
  const { play, muted, toggleMute } = useSound()
  const t = useT()
  useLenis()
  useProcessRecurrences()

  // Play nav sound + flash overlay on route change
  const prevPath = useRef(pathname)
  useEffect(() => {
    if (prevPath.current !== pathname) {
      play('nav')
      prevPath.current = pathname
      setTransitioning(true)
      const t = setTimeout(() => setTransitioning(false), 220)
      return () => clearTimeout(t)
    }
  }, [pathname, play])

  // Close mobile nav on resize to desktop
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setMobileNavOpen(false) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Section tracking via IntersectionObserver (only on /dashboard, not static pages)
  useEffect(() => {
    if (staticSection) return
    if (!pathname.startsWith('/dashboard')) return
    const observers = SECTION_IDS.map((id) => {
      const el = document.getElementById(id)
      if (!el) return null
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id) },
        { threshold: 0.25, rootMargin: '-64px 0px -55% 0px' }
      )
      obs.observe(el)
      return obs
    })
    return () => { observers.forEach((obs) => obs?.disconnect()) }
  }, [staticSection])

  const handleNavigate = (id: string) => {
    play('click')
    setMobileNavOpen(false)
    // Secondary pages
    if (id === 'budget')  { router.push('/budget');  return }
    if (id === 'reports') { router.push('/reports'); return }
    // Dashboard sections
    if (pathname !== '/dashboard') {
      router.push('/dashboard')
      return
    }
    setActiveSection(id)
    const el = document.getElementById(id)
    if (!el) return
    const lenis = getLenis()
    if (lenis) lenis.scrollTo(el, { offset: -64, duration: 1.6 })
    else el.scrollIntoView({ behavior: 'smooth' })
  }

  // Global keyboard shortcuts (declared after handleNavigate)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd/Ctrl+K → command palette (always)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }

      // Skip single-key shortcuts when user is typing
      const tag = (e.target as HTMLElement)?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
                     !!(e.target as HTMLElement)?.isContentEditable
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return

      switch (e.key) {
        case 'n': case 'N':
          e.preventDefault()
          window.dispatchEvent(new CustomEvent('ma:new-transaction'))
          break
        case 'a': case 'A':
          e.preventDefault()
          handleNavigate('analytics')
          break
        case 't':
          e.preventDefault()
          handleNavigate('expenses')
          break
        case 'g': case 'G':
          e.preventDefault()
          handleNavigate('goals')
          break
        case 'b': case 'B':
          e.preventDefault()
          handleNavigate('budget')
          break
        case '?':
          e.preventDefault()
          setPaletteOpen(true)
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={styles.shell}>
      <AmbientBackground />

      <Sidebar
        activeSection={activeSection}
        onNavigate={handleNavigate}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      {/* Mobile backdrop */}
      {mobileNavOpen && (
        <div
          className={styles.mobileBackdrop}
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Full-width top rail */}
      <motion.header
        className={styles.topbar}
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      >
        {/* Desktop: spacer that mirrors sidebar width */}
        <div className={styles.topbarSpacer} />

        <div className={styles.topbarContent}>
          <div className={styles.topbarLeft}>
            {/* Mobile: hamburger */}
            <button
              className={`${styles.hamburger} ${mobileNavOpen ? styles.hamburgerOpen : ''}`}
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label="Toggle navigation"
            >
              <span className={styles.hamburgerLine} />
              <span className={styles.hamburgerLine} />
              <span className={styles.hamburgerLine} />
            </button>

            <span className={styles.topbarNum}>{SECTION_NUMS[activeSection] ?? '—'}</span>
            <span className={styles.topbarHeading}>
              {t(`section.${activeSection}`, SECTION_LABELS[activeSection] ?? 'Dashboard')}
            </span>
          </div>

          <div className={styles.topbarRight}>
            <div className={styles.statusDot} title="Live data" />

            {/* Sound toggle */}
            <button
              className={`${styles.topbarBtn} ${muted ? styles.topbarBtnMuted : ''}`}
              aria-label={muted ? 'Enable sounds' : 'Mute sounds'}
              title={muted ? 'Sounds off' : 'Sounds on'}
              onClick={() => { toggleMute(); if (muted) setTimeout(() => play('click'), 40) }}
            >
              {muted ? <IconSoundOff /> : <IconSoundOn />}
            </button>

            {/* Theme toggle */}
            <button
              className={styles.topbarBtn}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              onClick={() => { toggleTheme(); play('click') }}
            >
              {theme === 'dark' ? <IconMoon /> : <IconSun />}
            </button>

            {/* Search / Command palette */}
            <button
              className={styles.topbarBtn}
              aria-label="Search — ⌘K"
              title="Search  ⌘K"
              onClick={() => { setPaletteOpen(true); play('open') }}
            >
              <IconSearch />
              <span className={styles.topbarBtnHint}>⌘K</span>
            </button>

            {/* AI Chat */}
            <button
              className={`${styles.topbarBtn} ${chatOpen ? styles.topbarBtnActive : ''}`}
              aria-label="AI Finance Assistant"
              title="Ask Ma — AI Assistant"
              onClick={() => { setChatOpen((v) => !v); play('open') }}
            >
              <IconSparkle />
              <span className={styles.topbarBtnHint}>Ask</span>
            </button>

            {/* Profile / Settings */}
            <button
              className={`${styles.topbarBtn} ${pathname === '/profile' ? styles.topbarBtnActive : ''}`}
              aria-label="Settings & Profile"
              title="Settings & Profile"
              onClick={() => { router.push('/profile'); play('click') }}
            >
              <IconUser />
            </button>
          </div>
        </div>
      </motion.header>

      <div className={styles.content}>
        <VerifyBanner />
        <motion.main variants={pageTransition} initial="initial" animate="animate">
          {children}
        </motion.main>
      </div>

      {/* Route flash overlay */}
      <AnimatePresence>
        {transitioning && (
          <motion.div
            className={styles.routeFlash}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
        )}
      </AnimatePresence>

      {/* Command palette */}
      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={handleNavigate}
        onOpenChat={() => { setChatOpen(true); setPaletteOpen(false) }}
      />

      {/* AI Chat panel */}
      <ChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </div>
  )
}

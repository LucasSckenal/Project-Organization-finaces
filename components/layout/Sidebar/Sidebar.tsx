'use client'

import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { staggerContainerSlow, sidebarItem } from '@/lib/motion'
import { useAuth } from '@/contexts/AuthContext'
import { useT } from '@/hooks/useT'
import styles from './Sidebar.module.scss'

// Maps nav item id → translation key
const NAV_KEY: Record<string, string> = {
  overview: 'nav.overview', analytics: 'nav.analytics', expenses: 'nav.transactions',
  invest: 'nav.investments', goals: 'nav.goals', budget: 'nav.budget', reports: 'nav.reports',
}


interface NavItem {
  id:  string
  num: string
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview',  num: '01', label: 'Overview'     },
  { id: 'analytics', num: '02', label: 'Analytics'    },
  { id: 'expenses',  num: '03', label: 'Transactions' },
  { id: 'invest',    num: '04', label: 'Investments'  },
  { id: 'goals',     num: '05', label: 'Goals'        },
]

const SECONDARY_ITEMS: NavItem[] = [
  { id: 'budget',  num: '06', label: 'Budget'   },
  { id: 'reports', num: '07', label: 'Reports'  },
]

interface SidebarProps {
  activeSection:  string
  onNavigate:     (id: string) => void
  mobileOpen?:    boolean
  onMobileClose?: () => void
}

export function Sidebar({ activeSection, onNavigate, mobileOpen, onMobileClose }: SidebarProps) {
  const { user, profile, logOut, updatePhoto } = useAuth()
  const t = useT()
  const router = useRouter()
  const displayName = profile?.name ?? user?.displayName ?? 'User'
  const handle      = '@' + displayName.toLowerCase().replace(/\s+/g, '')
  const initial     = displayName[0]?.toUpperCase() ?? 'U'
  const photoURL    = profile?.photoURL ?? user?.photoURL ?? null

  const fileInputRef  = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleAvatarClick = () => fileInputRef.current?.click()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await updatePhoto(file)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleNavClick = (id: string) => {
    onNavigate(id)
    onMobileClose?.()
  }

  return (
    <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarMobileOpen : ''}`}>
      {/* Logo */}
      <div className={styles.logoArea}>
        <div className={styles.logoMark}>
          <div className={styles.logoIcon}>間</div>
          <div className={styles.logoText}>
            <span className={styles.logoName}>Ma</span>
            <span className={styles.logoSub}>Finance OS</span>
          </div>
        </div>
      </div>

      {/* Primary nav */}
      <nav className={styles.nav}>
        <motion.div
          variants={staggerContainerSlow}
          initial="hidden"
          animate="visible"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id
            return (
              <motion.div key={item.id} variants={sidebarItem}>
                <motion.button
                  className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                  onClick={() => handleNavClick(item.id)}
                  whileHover={{ x: 6, transition: { type: 'spring', stiffness: 380, damping: 22 } }}
                  whileTap={{ x: 2, scale: 0.97, transition: { type: 'spring', stiffness: 600, damping: 30 } }}
                >
                  <span className={styles.navNum}>{item.num}</span>
                  <span className={styles.navItemText}>{t(NAV_KEY[item.id], item.label)}</span>
                  <span className={styles.navArrow}>→</span>
                </motion.button>
              </motion.div>
            )
          })}
        </motion.div>

        {/* Secondary */}
        <motion.div
          variants={staggerContainerSlow}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={sidebarItem}>
            <div className={styles.navLabel}>{t('nav.insights')}</div>
          </motion.div>
          {SECONDARY_ITEMS.map((item) => {
            const isActive = activeSection === item.id
            return (
              <motion.div key={item.id} variants={sidebarItem}>
                <motion.button
                  className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                  onClick={() => handleNavClick(item.id)}
                  whileHover={{ x: 6, transition: { type: 'spring', stiffness: 380, damping: 22 } }}
                  whileTap={{ x: 2, scale: 0.97, transition: { type: 'spring', stiffness: 600, damping: 30 } }}
                >
                  <span className={styles.navNum}>{item.num}</span>
                  <span className={styles.navItemText}>{t(NAV_KEY[item.id], item.label)}</span>
                  <span className={styles.navArrow}>→</span>
                </motion.button>
              </motion.div>
            )
          })}
        </motion.div>
      </nav>

      {/* Status — "Available · 2026" style */}
      <div className={styles.statusBadge}>
        <span className={styles.statusDot} />
        <span className={styles.statusText}>Live · 2026</span>
      </div>

      {/* Profile */}
      <div className={styles.bottomArea}>
        <div className={styles.profileCard}>
          <button
            className={`${styles.avatar} ${uploading ? styles.avatarUploading : ''}`}
            onClick={handleAvatarClick}
            title="Change photo"
            aria-label="Change profile photo"
          >
            {photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoURL} alt={displayName} className={styles.avatarImg} />
            ) : (
              <span className={styles.avatarInitial}>{uploading ? '…' : initial}</span>
            )}
            <span className={styles.avatarOverlay}>
              <span className={styles.cameraIcon}>⊙</span>
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className={styles.fileInput}
            onChange={handleFileChange}
          />
          <button
            className={styles.profileInfo}
            onClick={() => { router.push('/profile'); onMobileClose?.() }}
            title="Settings & Profile"
          >
            <div className={styles.profileName}>{displayName}</div>
            <div className={styles.profileHandle}>{handle}</div>
          </button>
          <button
            className={styles.settingsIcon}
            onClick={logOut}
            title={t('settings.signOut')}
            aria-label={t('settings.signOut')}
          >
            ⏻
          </button>
        </div>
      </div>
    </aside>
  )
}

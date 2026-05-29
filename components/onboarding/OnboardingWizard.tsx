'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { completeOnboarding } from '@/lib/firestore'
import type { UserProfile } from '@/lib/types'
import styles from './OnboardingWizard.module.scss'

// ── Currency options ──────────────────────────────────────────────────────────
const CURRENCIES: { code: UserProfile['currency']; symbol: string; name: string }[] = [
  { code: 'USD', symbol: '$',  name: 'US Dollar'      },
  { code: 'EUR', symbol: '€',  name: 'Euro'           },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'JPY', symbol: '¥',  name: 'Japanese Yen'   },
  { code: 'GBP', symbol: '£',  name: 'British Pound'  },
]

type Step = 'welcome' | 'currency' | 'done'

interface Props {
  exiting:    boolean
  onComplete: () => void
}

export function OnboardingWizard({ exiting, onComplete }: Props) {
  const { user, profile } = useAuth()
  const [step,     setStep]     = useState<Step>('welcome')
  const [currency, setCurrency] = useState<UserProfile['currency']>('USD')
  const [saving,   setSaving]   = useState(false)

  const displayName = profile?.name ?? user?.displayName ?? 'there'

  const handleComplete = async () => {
    if (!user) return
    setSaving(true)
    try {
      await completeOnboarding(user.uid, currency)
      onComplete()
    } finally {
      setSaving(false)
    }
  }

  const STEP_IDX: Record<Step, number> = { welcome: 0, currency: 1, done: 2 }

  return (
    <div className={`${styles.overlay} ${exiting ? styles.overlayExit : ''}`}>

      {/* ── Progress dots ──────────────────────────────────── */}
      <div className={styles.progress}>
        {(['currency', 'done'] as Step[]).map((s, i) => (
          <span
            key={s}
            className={`${styles.dot} ${STEP_IDX[step] > i ? styles.dotDone : ''} ${step === s ? styles.dotActive : ''}`}
          />
        ))}
      </div>

      {/* ── Step card — key triggers maFadeRise on each change ─ */}
      <div key={step} className={styles.card}>

        {/* Welcome */}
        {step === 'welcome' && (
          <>
            <span className={styles.glyph}>間</span>
            <h1 className={styles.title}>
              Welcome to Ma,<br />
              <em>{displayName}.</em>
            </h1>
            <p className={styles.sub}>
              Your financial operating system is ready.
              Let&apos;s configure your workspace — takes under a minute.
            </p>
            <button className={styles.btnPrimary} onClick={() => setStep('currency')}>
              Let&apos;s go →
            </button>
          </>
        )}

        {/* Currency */}
        {step === 'currency' && (
          <>
            <h2 className={styles.title}>What&apos;s your base currency?</h2>
            <p className={styles.sub}>Used for all amounts, charts, and AI analysis.</p>

            <div className={styles.currencyList}>
              {CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  className={`${styles.currencyItem} ${currency === c.code ? styles.currencyItemActive : ''}`}
                  onClick={() => setCurrency(c.code)}
                >
                  <span className={styles.currencySymbol}>{c.symbol}</span>
                  <div className={styles.currencyInfo}>
                    <span className={styles.currencyCode}>{c.code}</span>
                    <span className={styles.currencyName}>{c.name}</span>
                  </div>
                  {currency === c.code && <span className={styles.currencyCheck}>✓</span>}
                </button>
              ))}
            </div>

            <div className={styles.rowActions}>
              <button className={styles.btnBack} onClick={() => setStep('welcome')}>← Back</button>
              <button className={styles.btnPrimary} onClick={() => setStep('done')}>Continue →</button>
            </div>
          </>
        )}

        {/* Done */}
        {step === 'done' && (
          <>
            <span className={styles.doneIcon}>✓</span>
            <h2 className={styles.title}>You&apos;re all set.</h2>
            <p className={styles.sub}>
              Ma is configured with your preferences.
              Start tracking, planning, and growing.
            </p>
            <div className={styles.doneDetails}>
              <span className={styles.doneDetail}>
                Currency: <strong>{currency}</strong>
              </span>
              <span className={styles.doneDetail}>
                Dashboard ready
              </span>
            </div>
            <button
              className={styles.btnPrimary}
              onClick={handleComplete}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Enter dashboard →'}
            </button>
          </>
        )}

      </div>

      {/* Subtle brand mark bottom */}
      <div className={styles.brandMark}>Ma Finance OS</div>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { heroContainer, heroTitle, heroSubtitle, formatPercent } from '@/lib/motion'
import { FadeReveal, StaggerReveal, StaggerItem } from '@/components/motion/FadeReveal'
import { useAuth } from '@/contexts/AuthContext'
import { useBalances, useMonthlyData, useInvestments, useGoals, useAccounts } from '@/hooks/useFirestore'
import { useCurrency } from '@/hooks/useCurrency'
import { useT } from '@/hooks/useT'
import { setAvailableCash } from '@/lib/firestore'
import { Drawer } from '@/components/ui/Drawer/Drawer'
import styles from './HeroDashboard.module.scss'

function CountUp({ value, duration = 2000 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const start   = Date.now()
    const animate = () => {
      const elapsed  = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased    = 1 - Math.pow(1 - progress, 4)
      setDisplay(Math.round(eased * value))
      if (progress < 1) rafRef.current = requestAnimationFrame(animate)
    }
    const timeout = setTimeout(() => { rafRef.current = requestAnimationFrame(animate) }, 400)
    return () => { clearTimeout(timeout); if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
  }, [value, duration])

  return <span>{display.toLocaleString('en-US')}</span>
}

export function HeroDashboard() {
  const { user, profile } = useAuth()
  const { balances }      = useBalances()
  const { monthly }       = useMonthlyData()
  const { investments }   = useInvestments()
  const { goals }         = useGoals()
  const { accounts, totalBalance } = useAccounts()
  const [dateStr,     setDateStr]     = useState('')
  const [greetKey,    setGreetKey]    = useState<'morning' | 'afternoon' | 'evening'>('morning')
  const [editOpen, setEditOpen] = useState(false)
  const [cashInput, setCashInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const { fmt, symbol } = useCurrency()
  const t = useT()

  const displayName = profile?.name ?? user?.displayName ?? 'there'

  const latest      = monthly[monthly.length - 1]
  const monthlyIn   = latest?.income   ?? 0
  const monthlyOut  = latest?.expenses ?? 0
  const savingsRate = monthlyIn > 0 ? Math.round(((monthlyIn - monthlyOut) / monthlyIn) * 100) : 0
  const investCount = investments.length
  const avgGain     = investCount > 0
    ? investments.reduce((s, i) => s + i.gain, 0) / investCount : 0

  // ── Computed net worth ──────────────────────────────────────────────────────
  // Available = manual (only user-controlled field).
  // Invested  = sum of investment positions.
  // Savings   = sum of goal balances.
  // Total     = sum of the three. Nothing here is manually editable.
  const computed = useMemo(() => {
    // When the user has accounts, their summed balance is the source of truth
    // for available cash; otherwise fall back to the manual available field.
    const available = accounts.length > 0 ? totalBalance : (balances.available || 0)
    const invested  = investments.reduce((s, i) => s + i.value, 0)
    const savings   = goals.reduce((s, g) => s + g.current, 0)
    const total     = available + invested + savings

    // Monthly change = this month's net flow (income − expenses) as % of net worth
    const netFlow   = monthlyIn - monthlyOut
    const prevTotal = total - netFlow
    const monthlyChange = prevTotal > 0 ? (netFlow / prevTotal) * 100 : 0

    return { available, invested, savings, total, monthlyChangeAmount: netFlow, monthlyChange, hasAccounts: accounts.length > 0 }
  }, [balances.available, accounts.length, totalBalance, investments, goals, monthlyIn, monthlyOut])

  const isPositive = computed.monthlyChange >= 0

  useEffect(() => {
    const h = new Date().getHours()
    setGreetKey(h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening')
    const isPt = profile?.language === 'pt-BR'
    setDateStr(
      isPt
        ? format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })
        : format(new Date(), 'EEEE, MMMM d'),
    )
  }, [profile?.language])

  const openEdit = () => {
    setCashInput(String(computed.available || ''))
    setEditOpen(true)
  }

  const handleCashSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true); setError('')
    try {
      await setAvailableCash(user.uid, parseFloat(cashInput) || 0)
      setEditOpen(false)
    } catch { setError('Failed to save') }
    finally { setSaving(false) }
  }

  return (
    <section className={styles.hero} id="overview">
      <span className={styles.sectionIndex}>001</span>

      {/* Greeting */}
      <motion.div className={styles.greeting} variants={heroContainer} initial="hidden" animate="visible">
        <motion.span className={styles.greetingKanji} variants={heroTitle}>
          おはようございます — {displayName}
        </motion.span>
        <motion.h1 className={styles.greetingTitle} variants={heroTitle}>
          {t(`hero.${greetKey}`)}, <strong>{displayName}</strong>
        </motion.h1>
        <motion.p className={styles.greetingDate} variants={heroSubtitle}>
          {dateStr} · {t('hero.portfolioIs')}{' '}
          <span className={isPositive ? styles.deltaPositive : styles.deltaNegative}>
            {isPositive ? t('hero.performing') : t('hero.adjusting')}
          </span>
        </motion.p>
      </motion.div>

      {/* Balance hero */}
      <FadeReveal variant="rise" delay={0.2}>
        <div className={styles.balanceRow}>
          <div className={styles.balanceMain}>
            <div className={styles.balanceLabelRow}>
              <span className={styles.balanceLabel}>{t('hero.netWorth')}</span>
              <span className={styles.autoBadge} title="Calculated automatically from cash + investments + goals">
                auto
              </span>
            </div>
            <div className={styles.balanceAmount}>
              <span className={styles.currency}>{symbol}</span>
              <CountUp value={computed.total} duration={2200} />
            </div>
            <div className={styles.balanceDelta}>
              <span className={isPositive ? styles.deltaPositive : styles.deltaNegative}>
                <span className={styles.deltaArrow}>{isPositive ? '↑' : '↓'}</span>
                {formatPercent(Math.abs(computed.monthlyChange))}
              </span>
              <span>&nbsp;{fmt(computed.monthlyChangeAmount)}</span>
              <span className={styles.deltaPeriod}>{t('hero.thisMonth')}</span>
            </div>
          </div>

          <div className={styles.balanceSide}>
            <motion.div className={styles.miniStat}
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
              <div className={styles.miniStatLabelRow}>
                <span className={styles.miniStatLabel}>{t('hero.available')}</span>
                {user && !computed.hasAccounts && (
                  <button className={styles.editCashBtn} onClick={openEdit} title="Edit available cash">
                    ✎
                  </button>
                )}
              </div>
              <span className={styles.miniStatValue}>{fmt(computed.available)}</span>
            </motion.div>

            <motion.div className={styles.miniStat}
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.72, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
              <span className={styles.miniStatLabel}>{t('hero.savings')}</span>
              <span className={styles.miniStatValue}>{fmt(computed.savings)}</span>
            </motion.div>
          </div>
        </div>
      </FadeReveal>

      {/* Stats strip */}
      <StaggerReveal delay={0.4} stagger={0.1}>
        <div className={styles.statsStrip}>
          <StaggerItem>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>{t('hero.invested')}</span>
              <span className={styles.statValue}><CountUp value={computed.invested} duration={1800} /></span>
              <span className={styles.statSub}>
                {investCount > 0 ? `${investCount} positions · ${avgGain > 0 ? '+' : ''}${avgGain.toFixed(1)}%` : '—'}
              </span>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>{t('hero.monthlyIn')}</span>
              <span className={styles.statValue}>{fmt(monthlyIn, true)}</span>
              <span className={styles.statSub}>{savingsRate > 0 ? `${savingsRate}% ${t('hero.saved')}` : '—'}</span>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>{t('hero.monthlyOut')}</span>
              <span className={styles.statValue}>{fmt(monthlyOut, true)}</span>
              <span className={styles.statSub}>{monthlyIn > 0 ? `${Math.round((monthlyOut / monthlyIn) * 100)}% ${t('hero.ratio')}` : '—'}</span>
            </div>
          </StaggerItem>
        </div>
      </StaggerReveal>

      <div className={styles.ambientDivider} />

      {/* ── Edit Available Cash Drawer ───────────────────────────── */}
      <Drawer isOpen={editOpen} onClose={() => { setEditOpen(false); setError('') }} title="Available Cash">
        <form onSubmit={handleCashSubmit}>
          <div className="form-field">
            <label className="form-label">Available Cash</label>
            <input className="form-input" type="number" min="0" step="1" placeholder="0"
              value={cashInput} onChange={(e) => setCashInput(e.target.value)} autoFocus />
          </div>

          <div className={styles.autoBreakdown}>
            <p className={styles.autoBreakdownTitle}>Net Worth is calculated automatically</p>
            <div className={styles.autoRow}>
              <span>Available cash</span>
              <span>{fmt(parseFloat(cashInput) || 0)}</span>
            </div>
            <div className={styles.autoRow}>
              <span>+ Invested ({investCount} positions)</span>
              <span>{fmt(computed.invested)}</span>
            </div>
            <div className={styles.autoRow}>
              <span>+ Savings ({goals.length} goals)</span>
              <span>{fmt(computed.savings)}</span>
            </div>
            <div className={`${styles.autoRow} ${styles.autoRowTotal}`}>
              <span>Net Worth</span>
              <span>{fmt((parseFloat(cashInput) || 0) + computed.invested + computed.savings)}</span>
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}
          <button className="form-submit" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>
      </Drawer>
    </section>
  )
}

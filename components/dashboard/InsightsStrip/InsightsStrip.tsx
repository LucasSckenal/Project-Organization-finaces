'use client'

import { useMemo } from 'react'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { FadeReveal } from '@/components/motion/FadeReveal'
import {
  useMonthlyData, useBudgets, useGoals, useRecurrences, useAllTransactions, useCategories,
} from '@/hooks/useFirestore'
import { useAuth } from '@/contexts/AuthContext'
import { useCurrency } from '@/hooks/useCurrency'
import { useT } from '@/hooks/useT'
import { budgetCategories as toBudgetCategories } from '@/lib/categories'
import styles from './InsightsStrip.module.scss'

type Severity = 'positive' | 'warning' | 'info'

interface Insight {
  id:       string
  icon:     string
  text:     string
  severity: Severity
  priority: number   // lower = shown first
}

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function InsightsStrip() {
  const { user }          = useAuth()
  const { fmt }           = useCurrency()
  const { monthly }       = useMonthlyData()
  const { budgets }       = useBudgets()
  const { goals }         = useGoals()
  const { recurrences }   = useRecurrences()
  const { transactions }  = useAllTransactions()
  const { custom }        = useCategories()
  const t                 = useT()

  const insights = useMemo<Insight[]>(() => {
    const out: Insight[] = []
    const monthKey = currentMonthKey()
    const catLabel = (c: string) => t(`cat.${c}`, c)

    // ── 1. Recurring due in next 3 days ─────────────────────────────────────
    recurrences
      .filter((r) => r.active)
      .forEach((r) => {
        const days = differenceInCalendarDays(parseISO(r.nextDue), new Date())
        if (days >= 0 && days <= 3) {
          const when = days === 0 ? t('ins.dueToday')
                     : days === 1 ? t('ins.dueTomorrow')
                     : `${t('ins.dueInDays')} ${days} ${t('ins.days')}`
          out.push({
            id:       `rec-${r.id}`,
            icon:     '↺',
            text:     `${r.merchant} (${fmt(Math.abs(r.amount))}) ${when}`,
            severity: r.amount < 0 ? 'warning' : 'info',
            priority: days,
          })
        }
      })

    // ── 2. Budget categories over / near limit ──────────────────────────────
    const monthSpending: Record<string, number> = {}
    transactions
      .filter((tx) => tx.amount < 0 && tx.date.startsWith(monthKey))
      .forEach((tx) => { monthSpending[tx.category] = (monthSpending[tx.category] ?? 0) + Math.abs(tx.amount) })

    toBudgetCategories(custom).forEach((cat) => {
      const limit = budgets[cat] ?? 0
      const spent = monthSpending[cat] ?? 0
      if (limit <= 0) return
      const pct = (spent / limit) * 100
      if (pct >= 100) {
        out.push({
          id: `bud-${cat}`, icon: '▲',
          text: `${catLabel(cat)} ${t('ins.overBudget')} (${fmt(spent - limit)})`,
          severity: 'warning', priority: 1,
        })
      } else if (pct >= 80) {
        out.push({
          id: `bud-${cat}`, icon: '◐',
          text: `${catLabel(cat)} ${t('ins.atBudget')} ${Math.round(pct)}% ${t('ins.ofBudget')}`,
          severity: 'warning', priority: 4,
        })
      }
    })

    // ── 3. Spending vs last month (from monthly aggregates) ─────────────────
    if (monthly.length >= 2) {
      const cur  = monthly[monthly.length - 1]
      const prev = monthly[monthly.length - 2]
      if (prev.expenses > 0) {
        const delta = ((cur.expenses - prev.expenses) / prev.expenses) * 100
        if (delta >= 15) {
          out.push({
            id: 'spend-up', icon: '↑',
            text: `${t('ins.spendUp')} ${Math.round(delta)}% ${t('ins.vsLastMonth')}`,
            severity: 'warning', priority: 5,
          })
        } else if (delta <= -10) {
          out.push({
            id: 'spend-down', icon: '↓',
            text: `${t('ins.spendDown')} ${Math.round(Math.abs(delta))}% ${t('ins.vsLastMonth')}`,
            severity: 'positive', priority: 6,
          })
        }
      }
      // Savings rate this month
      if (cur.income > 0) {
        const rate = Math.round(((cur.income - cur.expenses) / cur.income) * 100)
        if (rate >= 20) {
          out.push({
            id: 'save-good', icon: '✓',
            text: `${t('ins.strongMonth')} ${rate}% ${t('ins.ofIncome')}`,
            severity: 'positive', priority: 7,
          })
        } else if (rate < 0) {
          out.push({
            id: 'save-neg', icon: '!',
            text: t('ins.spentMore'),
            severity: 'warning', priority: 2,
          })
        }
      }
    }

    // ── 4. Goals — behind pace or nearly there ──────────────────────────────
    goals.forEach((g) => {
      const daysLeft = differenceInCalendarDays(parseISO(g.deadline), new Date())
      if (g.progress >= 90 && g.progress < 100) {
        out.push({
          id: `goal-close-${g.id}`, icon: '◈',
          text: `${g.name} ${t('ins.goalClose')} ${g.progress}% ${t('ins.goalFunded')}`,
          severity: 'positive', priority: 8,
        })
      } else if (daysLeft > 0 && daysLeft <= 30 && g.progress < 80) {
        out.push({
          id: `goal-behind-${g.id}`, icon: '◷',
          text: `${g.name} ${t('ins.deadlineNear')} ${g.progress}% ${t('ins.funded')}`,
          severity: 'warning', priority: 3,
        })
      }
    })

    return out.sort((a, b) => a.priority - b.priority).slice(0, 6)
  }, [recurrences, budgets, goals, monthly, transactions, custom, fmt, t])

  if (!user || insights.length === 0) return null

  return (
    <FadeReveal variant="rise">
      <section className={styles.strip} aria-label={t('nav.insights')}>
        <div className={styles.header}>
          <span className={styles.sparkle}>✦</span>
          <span className={styles.headerLabel}>{t('nav.insights')}</span>
        </div>
        <div className={styles.track}>
          {insights.map((ins) => (
            <div key={ins.id} className={`${styles.card} ${styles[ins.severity]}`}>
              <span className={styles.cardIcon}>{ins.icon}</span>
              <span className={styles.cardText}>{ins.text}</span>
            </div>
          ))}
        </div>
      </section>
    </FadeReveal>
  )
}

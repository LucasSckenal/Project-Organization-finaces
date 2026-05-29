'use client'

import { useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell, LineChart, Line, ReferenceLine,
} from 'recharts'
import { FadeReveal, StaggerReveal, StaggerItem } from '@/components/motion/FadeReveal'
import { useMonthlyData, useAllTransactions, useInvestments, useGoals, useBalances, useAccounts } from '@/hooks/useFirestore'
import { useCurrency } from '@/hooks/useCurrency'
import { useAuth } from '@/contexts/AuthContext'
import { useT } from '@/hooks/useT'
import styles from './ReportsView.module.scss'

// ── Config ────────────────────────────────────────────────────────────────────
const PERIOD_OPTIONS = ['3M', '6M', '1Y', 'All'] as const
type Period = typeof PERIOD_OPTIONS[number]

const PERIOD_COUNTS: Record<Period, number | null> = { '3M': 3, '6M': 6, '1Y': 12, All: null }

const CATEGORY_COLORS = [
  '#4a7c59', '#c4a882', '#8b3a3a', '#857e74',
  '#6b6560', '#4e4a44', '#3a3836', '#2a2825',
]

// ── Tooltips ─────────────────────────────────────────────────────────────────
function makeTooltip(fmt: (n: number) => string, t: (k: string, f?: string) => string) {
  return function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null
    return (
      <div className={styles.tooltip}>
        <div className={styles.tooltipLabel}>{label}</div>
        {payload.map((e: any) => {
          const key = `series.${String(e.name).toLowerCase().replace(/\s+/g, '')}`
          return (
            <div key={e.name} className={styles.tooltipRow}>
              <span className={styles.tooltipDot} style={{ background: e.color }} />
              <span>{t(key, e.name)}:</span>
              <span className={styles.tooltipVal}>
                {e.name === 'Rate' ? `${e.value}%` : fmt(e.value)}
              </span>
            </div>
          )
        })}
      </div>
    )
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function monthKey(offset = 0) {
  const d = new Date()
  d.setMonth(d.getMonth() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getChangeLabel(delta: number, t: (k: string, f?: string) => string) {
  if (Math.abs(delta) < 0.5) return t('reports.sameMonth')
  const abs = Math.abs(delta).toFixed(1)
  const sign = delta > 0 ? '+' : '−'
  return `${sign}${abs}% ${t('reports.vsLastMonth')}`
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ReportsView() {
  const [period, setPeriod] = useState<Period>('3M')
  const { monthly }                          = useMonthlyData()
  const { transactions, spendingByCategory } = useAllTransactions()
  const { investments }                      = useInvestments()
  const { goals }                            = useGoals()
  const { balances }                         = useBalances()
  const { accounts, totalBalance }           = useAccounts()
  const { fmt, fmtAxis }                     = useCurrency()
  const { profile }                          = useAuth()
  const t = useT()
  const locale = profile?.language === 'pt-BR' ? 'pt-BR' : 'en-US'

  // Current net worth (same formula as the dashboard hero)
  const currentNetWorth = useMemo(() => {
    const available = accounts.length > 0 ? totalBalance : (balances?.available || 0)
    const invested  = investments.reduce((s, i) => s + i.value, 0)
    const savings   = goals.reduce((s, g) => s + g.current, 0)
    return available + invested + savings
  }, [balances, accounts.length, totalBalance, investments, goals])

  // ── Period slice ──────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const count = PERIOD_COUNTS[period]
    return count ? monthly.slice(-count) : monthly
  }, [monthly, period])

  // ── Current-month stats ───────────────────────────────────────────────────
  const { income, expenses, savings, expDelta } = useMemo(() => {
    const cur  = monthKey(0)
    const prev = monthKey(-1)

    const curTxs  = transactions.filter((t) => t.date.startsWith(cur))
    const prevTxs = transactions.filter((t) => t.date.startsWith(prev))

    const income   = curTxs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
    const expenses = curTxs.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
    const savings  = income - expenses

    const prevExp  = prevTxs.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
    const expDelta = prevExp > 0 ? ((expenses - prevExp) / prevExp) * 100 : 0

    return { income, expenses, savings, expDelta }
  }, [transactions])

  // ── Period totals ─────────────────────────────────────────────────────────
  const periodIncome   = chartData.reduce((s, d) => s + d.income,   0)
  const periodExpenses = chartData.reduce((s, d) => s + d.expenses, 0)
  const periodSavings  = chartData.reduce((s, d) => s + d.savings,  0)

  // ── Savings rate trend ────────────────────────────────────────────────────
  const savingsRateData = useMemo(() =>
    chartData.map((d) => ({
      month: d.month,
      Rate: d.income > 0 ? Math.round((Math.max(0, d.savings) / d.income) * 100) : 0,
    })),
  [chartData])

  const avgSavingsRate = savingsRateData.length > 0
    ? Math.round(savingsRateData.reduce((s, d) => s + d.Rate, 0) / savingsRateData.length)
    : 0

  // ── Net worth trend ───────────────────────────────────────────────────────
  // Monthly `balance` = cumulative savings. Anchor the curve so the last point
  // equals the user's real current net worth, then it reads as net worth over time.
  const netWorthData = useMemo(() => {
    if (chartData.length === 0) return []
    const lastBalance = chartData[chartData.length - 1].balance
    const offset = currentNetWorth - lastBalance
    return chartData.map((d) => ({
      month: d.month,
      'Net Worth': Math.round(d.balance + offset),
    }))
  }, [chartData, currentNetWorth])

  // ── Tooltip with correct currency ────────────────────────────────────────
  const TooltipContent = useMemo(() => makeTooltip(fmt, t), [fmt, t])

  const currentMonthLabel = new Date().toLocaleString(locale, { month: 'long', year: 'numeric' })

  return (
    <div className={styles.page}>
      {/* Header */}
      <FadeReveal variant="rise">
        <div className={styles.pageHeader}>
          <span className={styles.pageTag}>{t('nav.reports')}</span>
          <h1 className={styles.pageTitle}>{t('reports.title')}</h1>
          <span className={styles.pageMonth}>{currentMonthLabel}</span>
        </div>
      </FadeReveal>

      {/* This-month stat cards */}
      <FadeReveal variant="rise" delay={0.05}>
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>{t('reports.income')}</span>
            <span className={`${styles.statValue} ${styles.valueIncome}`}>{fmt(income)}</span>
            <span className={styles.statSub}>{t('reports.thisMonth')}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>{t('reports.expenses')}</span>
            <span className={`${styles.statValue} ${styles.valueExpense}`}>{fmt(expenses)}</span>
            <span className={`${styles.statSub} ${expDelta > 5 ? styles.subDanger : expDelta < -5 ? styles.subPositive : ''}`}>
              {getChangeLabel(expDelta, t)}
            </span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>{t('reports.netSaved')}</span>
            <span className={`${styles.statValue} ${savings >= 0 ? styles.valueIncome : styles.valueExpense}`}>
              {savings < 0 ? '-' : ''}{fmt(savings)}
            </span>
            <span className={styles.statSub}>{t('reports.thisMonth')}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>{t('reports.savingRate')}</span>
            <span className={styles.statValue}>
              {income > 0 ? `${Math.max(0, Math.round((savings / income) * 100))}%` : '—'}
            </span>
            <span className={styles.statSub}>{t('reports.thisMonth')}</span>
          </div>
        </div>
      </FadeReveal>

      {/* Net Worth trend */}
      {netWorthData.length > 1 && (
        <FadeReveal variant="mask" delay={0.08}>
          <div className={styles.chartCard}>
            <div className={styles.chartCardHeader}>
              <div className={styles.chartCardLeft}>
                <span className={styles.chartTitle}>{t('reports.netWorthTrend')}</span>
                <div className={styles.chartTotals}>
                  <span className={styles.chartTotal}>
                    <span className={styles.totalDot} style={{ background: '#7ba98e' }} />
                    {fmt(currentNetWorth)} {t('reports.now')}
                  </span>
                </div>
              </div>
            </div>
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={netWorthData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                  <defs>
                    <linearGradient id="rg-networth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7ba98e" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#7ba98e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="0" stroke="rgba(255,249,240,0.04)" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#4e4a44', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#4e4a44', fontSize: 10 }} tickFormatter={(v) => fmtAxis(v)} />
                  <Tooltip content={<TooltipContent />} />
                  <Area type="monotone" dataKey="Net Worth" stroke="#7ba98e" strokeWidth={1.5}
                    fill="url(#rg-networth)" dot={false} activeDot={{ r: 4, fill: '#7ba98e', strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </FadeReveal>
      )}

      {/* Main area chart */}
      <FadeReveal variant="mask" delay={0.1}>
        <div className={styles.chartCard}>
          <div className={styles.chartCardHeader}>
            <div className={styles.chartCardLeft}>
              <span className={styles.chartTitle}>{t('reports.incomeVsExpenses')}</span>
              <div className={styles.chartTotals}>
                <span className={styles.chartTotal}>
                  <span className={styles.totalDot} style={{ background: '#4a7c59' }} />
                  {fmt(periodIncome)}
                </span>
                <span className={styles.chartTotal}>
                  <span className={styles.totalDot} style={{ background: '#8b3a3a' }} />
                  {fmt(periodExpenses)}
                </span>
                <span className={styles.chartTotal}>
                  <span className={styles.totalDot} style={{ background: '#c4a882', opacity: 0.7 }} />
                  {periodSavings < 0 ? '-' : ''}{fmt(periodSavings)}
                </span>
              </div>
            </div>
            <div className={styles.periodBtns}>
              {PERIOD_OPTIONS.map((p) => (
                <button
                  key={p}
                  className={`${styles.periodBtn} ${period === p ? styles.periodBtnActive : ''}`}
                  onClick={() => setPeriod(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="rg-income"   x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4a7c59" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#4a7c59" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="rg-expense"  x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b3a3a" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#8b3a3a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="rg-savings"  x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c4a882" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#c4a882" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="0" stroke="rgba(255,249,240,0.04)" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#4e4a44', fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#4e4a44', fontSize: 10 }}
                  tickFormatter={(v) => fmtAxis(v)}
                />
                <Tooltip content={<TooltipContent />} />
                <Area type="monotone" dataKey="income"   name="Income"
                  stroke="#4a7c59" strokeWidth={1.5} fill="url(#rg-income)"
                  dot={false} activeDot={{ r: 4, fill: '#4a7c59', strokeWidth: 0 }} />
                <Area type="monotone" dataKey="expenses" name="Expenses"
                  stroke="#8b3a3a" strokeWidth={1.5} fill="url(#rg-expense)"
                  dot={false} activeDot={{ r: 4, fill: '#8b3a3a', strokeWidth: 0 }} />
                <Area type="monotone" dataKey="savings"  name="Savings"
                  stroke="#c4a882" strokeWidth={1} strokeDasharray="4 2"
                  fill="url(#rg-savings)"
                  dot={false} activeDot={{ r: 3, fill: '#c4a882', strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </FadeReveal>

      {/* Savings rate trend */}
      {savingsRateData.length > 1 && (
        <FadeReveal variant="mask" delay={0.14}>
          <div className={styles.chartCard}>
            <div className={styles.chartCardHeader}>
              <div className={styles.chartCardLeft}>
                <span className={styles.chartTitle}>{t('reports.savingsRateTrend')}</span>
                <div className={styles.chartTotals}>
                  <span className={styles.chartTotal}>
                    <span className={styles.totalDot} style={{ background: '#c4a882' }} />
                    {t('reports.avgSaved')} {avgSavingsRate}% {t('reports.savedSuffix')}
                  </span>
                </div>
              </div>
            </div>
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={savingsRateData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="0" stroke="rgba(255,249,240,0.04)" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#4e4a44', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#4e4a44', fontSize: 10 }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                  <Tooltip content={<TooltipContent />} />
                  {avgSavingsRate > 0 && (
                    <ReferenceLine y={avgSavingsRate} stroke="rgba(196,168,130,0.3)" strokeDasharray="4 2"
                      label={{ value: 'avg', position: 'insideRight', fill: 'rgba(196,168,130,0.45)', fontSize: 9 }} />
                  )}
                  <Line type="monotone" dataKey="Rate" name="Rate" stroke="#c4a882" strokeWidth={1.5}
                    dot={{ r: 3, fill: '#c4a882', strokeWidth: 0 }}
                    activeDot={{ r: 4, fill: '#c4a882', strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </FadeReveal>
      )}

      {/* Category spending bars */}
      {spendingByCategory.length > 0 && (
        <FadeReveal variant="mask" delay={0.15}>
          <div className={styles.catCard}>
            <span className={styles.catTitle}>Spending by Category</span>
            <div className={styles.catList}>
              {spendingByCategory.map((item, i) => (
                <div key={item.name} className={styles.catRow}>
                  <div className={styles.catMeta}>
                    <span className={styles.catDot} style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                    <span className={styles.catName}>{t(`cat.${item.name}`, item.name)}</span>
                    <span className={styles.catPct}>{item.percent}%</span>
                  </div>
                  <div className={styles.catTrack}>
                    <div
                      className={styles.catFill}
                      style={{
                        width: `${item.percent}%`,
                        background: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                      }}
                    />
                  </div>
                  <span className={styles.catAmt}>{fmt(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </FadeReveal>
      )}
    </div>
  )
}

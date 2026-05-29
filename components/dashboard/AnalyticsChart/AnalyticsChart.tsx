'use client'

import { useState, useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, ReferenceLine,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { motion } from 'framer-motion'
import { FadeReveal, StaggerReveal, StaggerItem } from '@/components/motion/FadeReveal'
import { useMonthlyData, useAllTransactions } from '@/hooks/useFirestore'
import { useCurrency } from '@/hooks/useCurrency'
import { useT } from '@/hooks/useT'
import styles from './AnalyticsChart.module.scss'

const PERIOD_FILTERS = ['3M', '6M', '1Y', 'All'] as const
type Period = typeof PERIOD_FILTERS[number]
type ChartView = 'area' | 'bar'

function makeTooltip(fmt: (n: number) => string, t: (k: string, f?: string) => string) {
  return function CinematicTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null
    return (
      <div className={styles.tooltip}>
        <div className={styles.tooltipLabel}>{label}</div>
        {payload.map((entry: any) => (
          <div key={entry.name} className={styles.tooltipRow}>
            <span className={styles.tooltipDot} style={{ background: entry.color }} />
            <span className={styles.tooltipName}>{t(`series.${entry.name}`, entry.name)}</span>
            <span className={styles.tooltipValue}>{fmt(entry.value)}</span>
          </div>
        ))}
      </div>
    )
  }
}

const DONUT_COLORS = ['#4a7c59', '#c4a882', '#8b3a3a', '#857e74', '#6b6560', '#4e4a44', '#3a3836', '#2a2825']

function makeDonutTooltip(t: (k: string, f?: string) => string) {
  return function DonutTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipLabel}>{t(`cat.${payload[0].name}`, payload[0].name)}</div>
      <div className={styles.tooltipValue}>{payload[0].payload.percent}%</div>
    </div>
  )
  }
}

export function AnalyticsChart() {
  const [period,    setPeriod]    = useState<Period>('1Y')
  const [chartView, setChartView] = useState<ChartView>('area')
  const { monthly } = useMonthlyData()
  const { spendingByCategory } = useAllTransactions()
  const { fmt, fmtAxis } = useCurrency()
  const t = useT()

  const counts: Record<Period, number> = { '3M': 3, '6M': 6, '1Y': 11, All: monthly.length }
  const data = monthly.slice(-counts[period])

  // Average expense reference line
  const avgExpenses = useMemo(() =>
    data.length > 0 ? Math.round(data.reduce((s, d) => s + d.expenses, 0) / data.length) : 0,
  [data])

  // Tooltip with correct currency
  const TooltipContent = useMemo(() => makeTooltip(fmt, t), [fmt, t])
  const DonutTip       = useMemo(() => makeDonutTooltip(t), [t])

  const fmtIncome   = fmt(data.reduce((s, d) => s + d.income,   0))
  const fmtExpenses = fmt(data.reduce((s, d) => s + d.expenses, 0))
  const fmtSaved    = fmt(data.reduce((s, d) => s + d.savings,  0))

  return (
    <section className={styles.section} id="analytics">
      {/* Section header */}
      <FadeReveal variant="rise">
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <span className={styles.sectionTag}>{t('sec.an.tag')}</span>
            <h2 className={styles.sectionTitle}>{t('sec.an.title')}</h2>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.viewToggle}>
              <button
                className={`${styles.viewBtn} ${chartView === 'area' ? styles.viewBtnActive : ''}`}
                onClick={() => setChartView('area')}
                title="Area chart"
              >
                ∿
              </button>
              <button
                className={`${styles.viewBtn} ${chartView === 'bar' ? styles.viewBtnActive : ''}`}
                onClick={() => setChartView('bar')}
                title="Bar chart"
              >
                ▮▮
              </button>
            </div>
            <div className={styles.timeFilters}>
              {PERIOD_FILTERS.map((p) => (
                <button
                  key={p}
                  className={`${styles.filterBtn} ${period === p ? styles.filterBtnActive : ''}`}
                  onClick={() => setPeriod(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </FadeReveal>

      {/* Main area chart */}
      <FadeReveal variant="mask" delay={0.1}>
        <div className={styles.chartCard}>
          {/* Chart stats header — computed from selected period */}
          <div className={styles.chartHeader}>
            <div className={styles.chartStat}>
              <span className={styles.chartStatLabel}>{t('an.totalIncome')}</span>
              <span className={styles.chartStatValue}>{fmtIncome}</span>
            </div>
            <div className={styles.chartStat}>
              <span className={styles.chartStatLabel}>{t('an.totalExpenses')}</span>
              <span className={styles.chartStatValue}>{fmtExpenses}</span>
            </div>
            <div className={styles.chartStat}>
              <span className={styles.chartStatLabel}>{t('an.netSaved')}</span>
              <span className={styles.chartStatValue}>{fmtSaved}</span>
            </div>
          </div>

          <div className={styles.chartWrapper}>
            <ResponsiveContainer width="100%" height="100%">
              {chartView === 'area' ? (
                <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                  <defs>
                    <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4a7c59" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#4a7c59" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b3a3a" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#8b3a3a" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#c4a882" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#c4a882" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="0" stroke="rgba(255,249,240,0.04)" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#4e4a44', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#4e4a44', fontSize: 10 }} tickFormatter={(v) => fmtAxis(v)} />
                  <Tooltip content={<TooltipContent />} />
                  {avgExpenses > 0 && (
                    <ReferenceLine
                      y={avgExpenses}
                      stroke="rgba(196,168,130,0.3)"
                      strokeDasharray="4 2"
                      label={{ value: 'avg', position: 'insideRight', fill: 'rgba(196,168,130,0.5)', fontSize: 9 }}
                    />
                  )}
                  <Area type="monotone" dataKey="income"   stroke="#4a7c59" strokeWidth={1.5} fill="url(#incomeGradient)"  dot={false} activeDot={{ r: 4, fill: '#4a7c59', strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="expenses" stroke="#8b3a3a" strokeWidth={1.5} fill="url(#expenseGradient)" dot={false} activeDot={{ r: 4, fill: '#8b3a3a', strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="savings"  stroke="#c4a882" strokeWidth={1}   strokeDasharray="4 2" fill="url(#savingsGradient)" dot={false} activeDot={{ r: 3, fill: '#c4a882', strokeWidth: 0 }} />
                </AreaChart>
              ) : (
                <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }} barGap={2}>
                  <CartesianGrid strokeDasharray="0" stroke="rgba(255,249,240,0.04)" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#4e4a44', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#4e4a44', fontSize: 10 }} tickFormatter={(v) => fmtAxis(v)} />
                  <Tooltip content={<TooltipContent />} cursor={{ fill: 'rgba(255,249,240,0.03)' }} />
                  {avgExpenses > 0 && (
                    <ReferenceLine
                      y={avgExpenses}
                      stroke="rgba(196,168,130,0.3)"
                      strokeDasharray="4 2"
                      label={{ value: 'avg', position: 'insideRight', fill: 'rgba(196,168,130,0.5)', fontSize: 9 }}
                    />
                  )}
                  <Bar dataKey="income"   fill="#4a7c59" fillOpacity={0.7} radius={[2, 2, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="expenses" fill="#8b3a3a" fillOpacity={0.7} radius={[2, 2, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="savings"  fill="#c4a882" fillOpacity={0.5} radius={[2, 2, 0, 0]} maxBarSize={24} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      </FadeReveal>

      {/* Spending breakdown donut */}
      <StaggerReveal delay={0.15} stagger={0.08}>
        <div className={styles.donutSection}>
          <StaggerItem>
            <div className={styles.donutCard}>
              <div className={styles.donutTitle}>{t('an.spendingByCat')}</div>
              <div className={styles.donutWrapper}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      {spendingByCategory.map((_, i) => (
                        <linearGradient key={i} id={`slice-${i}`} x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor={DONUT_COLORS[i % DONUT_COLORS.length]} stopOpacity={0.9} />
                          <stop offset="100%" stopColor={DONUT_COLORS[i % DONUT_COLORS.length]} stopOpacity={0.6} />
                        </linearGradient>
                      ))}
                    </defs>
                    <Pie
                      data={spendingByCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={44}
                      outerRadius={68}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {spendingByCategory.map((_, i) => (
                        <Cell
                          key={`cell-${i}`}
                          fill={`url(#slice-${i})`}
                          stroke="transparent"
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<DonutTip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className={styles.donutCard}>
              <div className={styles.donutTitle}>{t('an.catBreakdown')}</div>
              <div className={styles.categoryList}>
                {spendingByCategory.map((item, i) => (
                  <div key={item.name} className={styles.categoryItem}>
                    <span
                      className={styles.categoryDot}
                      style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                    />
                    <span className={styles.categoryName}>{t(`cat.${item.name}`, item.name)}</span>
                    <span className={styles.categoryPercent}>{item.percent}%</span>
                  </div>
                ))}
              </div>
            </div>
          </StaggerItem>
        </div>
      </StaggerReveal>
    </section>
  )
}


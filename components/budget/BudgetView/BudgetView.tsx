'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { FadeReveal, StaggerReveal, StaggerItem } from '@/components/motion/FadeReveal'
import { useAllTransactions, useBudgets, useCategories } from '@/hooks/useFirestore'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useCurrency } from '@/hooks/useCurrency'
import { useT } from '@/hooks/useT'
import { saveBudgets } from '@/lib/firestore'
import type { Transaction } from '@/lib/types'
import styles from './BudgetView.module.scss'

// ── Config ────────────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  Housing:       '#857e74',
  Groceries:     '#c4a882',
  Dining:        '#c4a882',
  Transport:     '#6b8f71',
  Subscriptions: '#8b8080',
  Shopping:      '#c07070',
  Utilities:     '#6b6560',
  Other:         '#4e4a44',
}

// Palette cycled for custom categories that have no fixed colour
const CUSTOM_COLORS = ['#7a9c8a', '#b08a6a', '#8a7aa0', '#a08a7a', '#6a8a9c']
function colorFor(category: string, index: number): string {
  return CATEGORY_COLORS[category] ?? CUSTOM_COLORS[index % CUSTOM_COLORS.length]
}

function currentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getMonthlySpending(transactions: Transaction[]): Record<string, number> {
  const month = currentMonthKey()
  const out: Record<string, number> = {}
  transactions
    .filter((tx) => tx.amount < 0 && tx.date.startsWith(month))
    .forEach((tx) => {
      out[tx.category] = (out[tx.category] ?? 0) + Math.abs(tx.amount)
    })
  return out
}

function getMonthLabel(locale = 'en-US') {
  return new Date().toLocaleString(locale, { month: 'long', year: 'numeric' })
}

// ── Component ─────────────────────────────────────────────────────────────────
export function BudgetView() {
  const { user, profile }            = useAuth()
  const { toast }                    = useToast()
  const { fmt, symbol }              = useCurrency()
  const { transactions }             = useAllTransactions()
  const { budgets }                  = useBudgets()
  const { budgetCategories: BUDGET_CATEGORIES } = useCategories()
  const t = useT()
  const locale = profile?.language === 'pt-BR' ? 'pt-BR' : 'en-US'

  const [editing,    setEditing]    = useState<string | null>(null)
  const [editValue,  setEditValue]  = useState('')
  const [saving,     setSaving]     = useState(false)

  const monthlySpending = useMemo(() => getMonthlySpending(transactions), [transactions])

  // ── Budget alerts ─────────────────────────────────────────────────────────
  const alertedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!user) return
    BUDGET_CATEGORIES.forEach((cat) => {
      const limit = budgets[cat] ?? 0
      const spent = monthlySpending[cat] ?? 0
      if (limit <= 0) return

      const pct = (spent / limit) * 100

      if (pct >= 100 && !alertedRef.current.has(`${cat}-over`)) {
        alertedRef.current.add(`${cat}-over`)
        alertedRef.current.delete(`${cat}-warn`)
        toast(`${cat} is over budget — ${fmt(spent - limit)} over the limit`, 'error')
      } else if (pct >= 80 && pct < 100 && !alertedRef.current.has(`${cat}-warn`)) {
        alertedRef.current.add(`${cat}-warn`)
        toast(`${cat} is at ${Math.round(pct)}% of budget`, 'info')
      } else if (pct < 80) {
        alertedRef.current.delete(`${cat}-warn`)
        alertedRef.current.delete(`${cat}-over`)
      }
    })
  }, [monthlySpending, budgets, user, toast, fmt, BUDGET_CATEGORIES])

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totalBudgeted = BUDGET_CATEGORIES.reduce((s, c) => s + (budgets[c] ?? 0), 0)
  const totalSpent    = BUDGET_CATEGORIES.reduce((s, c) => s + (monthlySpending[c] ?? 0), 0)
  const remaining     = totalBudgeted - totalSpent

  // ── Editing ────────────────────────────────────────────────────────────────
  const startEdit = (category: string) => {
    setEditing(category)
    setEditValue(String(budgets[category] ?? ''))
  }

  const cancelEdit = () => { setEditing(null); setEditValue('') }

  const confirmEdit = async () => {
    if (!user || !editing) return
    setSaving(true)
    try {
      const val = parseFloat(editValue)
      const updated = { ...budgets }
      if (!isNaN(val) && val > 0) updated[editing] = val
      else delete updated[editing]
      await saveBudgets(user.uid, updated)
      toast(`${editing} budget ${updated[editing] ? 'updated' : 'removed'}`, 'success')
    } catch {
      toast('Failed to save', 'error')
    } finally {
      setSaving(false)
      cancelEdit()
    }
  }

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter')  { e.preventDefault(); confirmEdit() }
    if (e.key === 'Escape') cancelEdit()
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <FadeReveal variant="rise">
        <div className={styles.pageHeader}>
          <span className={styles.pageTag}>{t('budget.tag')}</span>
          <h1 className={styles.pageTitle}>{t('budget.title')}</h1>
          <span className={styles.pageMonth}>{getMonthLabel(locale)}</span>
        </div>
      </FadeReveal>

      {/* Summary row */}
      <FadeReveal variant="rise" delay={0.05}>
        <div className={styles.summaryRow}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>{t('budget.totalBudgeted')}</span>
            <span className={styles.summaryValue}>
              {totalBudgeted > 0 ? fmt(totalBudgeted) : '—'}
            </span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>{t('budget.spent')}</span>
            <span className={`${styles.summaryValue} ${totalBudgeted > 0 && totalSpent > totalBudgeted ? styles.valueDanger : ''}`}>
              {fmt(totalSpent)}
            </span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>{t('budget.remaining')}</span>
            <span className={`${styles.summaryValue} ${remaining < 0 ? styles.valueDanger : styles.valuePositive}`}>
              {totalBudgeted > 0 ? fmt(Math.abs(remaining)) : '—'}
            </span>
            {totalBudgeted > 0 && remaining < 0 && (
              <span className={styles.summaryBadgeOver}>{t('budget.overBudget')}</span>
            )}
          </div>
        </div>
      </FadeReveal>

      {/* Category grid */}
      <div className={styles.gridWrapper}>
        <StaggerReveal stagger={0.05} delay={0.1}>
          <div className={styles.grid}>
            {BUDGET_CATEGORIES.map((category, idx) => {
              const limit   = budgets[category] ?? 0
              const spent   = monthlySpending[category] ?? 0
              const pct     = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0
              const isOver  = limit > 0 && spent > limit
              const isWarn  = !isOver && pct >= 75
              const color   = colorFor(category, idx)
              const isEdit  = editing === category

              return (
                <StaggerItem key={category}>
                  <div className={`${styles.card} ${isOver ? styles.cardOver : isWarn ? styles.cardWarn : ''}`}>
                    {/* Card header */}
                    <div className={styles.cardTop}>
                      <div className={styles.cardTitle}>
                        <span className={styles.categoryDot} style={{ background: color }} />
                        <span className={styles.categoryName}>{t(`cat.${category}`, category)}</span>
                      </div>
                      {user && !isEdit && (
                        <button
                          className={styles.editBtn}
                          onClick={() => startEdit(category)}
                          aria-label={`Edit ${category} budget`}
                        >
                          ✎
                        </button>
                      )}
                    </div>

                    {/* Edit mode */}
                    {isEdit ? (
                      <div className={styles.editRow}>
                        <span className={styles.editCurrency}>{symbol}</span>
                        <input
                          className={styles.editInput}
                          type="number"
                          min="0"
                          step="1"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={handleEditKeyDown}
                          placeholder="0"
                          autoFocus
                        />
                        <button className={styles.saveBtn} onClick={confirmEdit} disabled={saving} aria-label="Save">
                          ✓
                        </button>
                        <button className={styles.cancelBtn} onClick={cancelEdit} aria-label="Cancel">
                          ✕
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Amounts */}
                        <div className={styles.amounts}>
                          <span className={`${styles.spentAmt} ${isOver ? styles.spentOver : ''}`}>
                            {fmt(spent)}
                          </span>
                          {limit > 0 ? (
                            <span className={styles.limitAmt}>{t('budget.of')} {fmt(limit)}</span>
                          ) : (
                            <button
                              className={styles.setLimit}
                              onClick={() => user && startEdit(category)}
                            >
                              {user ? t('budget.setLimit') : t('budget.noLimit')}
                            </button>
                          )}
                        </div>

                        {/* Progress bar */}
                        {limit > 0 && (
                          <div className={styles.track}>
                            <div
                              className={`${styles.fill} ${isOver ? styles.fillOver : isWarn ? styles.fillWarn : styles.fillOk}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}

                        {/* Status */}
                        {limit > 0 && (
                          <span className={`${styles.statusText} ${isOver ? styles.statusOver : isWarn ? styles.statusWarn : styles.statusOk}`}>
                            {isOver
                              ? `${fmt(spent - limit)} ${t('budget.over')}`
                              : `${fmt(limit - spent)} ${t('budget.left')}`
                            }
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </StaggerItem>
              )
            })}
          </div>
        </StaggerReveal>
      </div>
    </div>
  )
}

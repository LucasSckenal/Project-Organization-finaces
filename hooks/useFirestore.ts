'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  subscribeTransactions, subscribeAllTransactions,
  subscribeGoals, subscribeInvestments, subscribeBalances,
  subscribeBudgets, subscribeRecurring, processDueRecurrences,
  subscribeCategories, subscribeAccounts, TRANSFER_CATEGORY,
} from '@/lib/firestore'
import { mergeCategories, budgetCategories as toBudgetCategories } from '@/lib/categories'
import {
  expenses as mockExpenses,
  goals as mockGoals,
  investments as mockInvestments,
  balances as mockBalances,
  monthlyData as mockMonthlyData,
} from '@/data/mock'
import type { Transaction, Goal, Investment, Balances, MonthlyDataPoint, RecurringTransaction, Account } from '@/lib/types'
import { useAuth } from '@/contexts/AuthContext'

const EMPTY_BALANCES: Balances = {
  total: 0, available: 0, invested: 0, savings: 0,
  monthlyChange: 0, monthlyChangeAmount: 0,
}

// Shared: spending grouped by category (expenses only, transfers excluded)
function computeSpendingByCategory(transactions: Transaction[]) {
  const exp = transactions.filter((t) => t.amount < 0 && t.category !== TRANSFER_CATEGORY)
  const total = exp.reduce((s, t) => s + Math.abs(t.amount), 0)
  if (total === 0) return []
  const byCategory: Record<string, number> = {}
  exp.forEach((t) => {
    byCategory[t.category] = (byCategory[t.category] ?? 0) + Math.abs(t.amount)
  })
  return Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({
      name,
      value,
      percent: Math.round((value / total) * 1000) / 10,
    }))
}

// ── Transactions (paginated — for the table) ───────────────────────────────────
export function useTransactions(pageSize = 50) {
  const { user, loading: authLoading } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) { setTransactions(mockExpenses); setLoading(false); return }
    const unsub = subscribeTransactions(user.uid, (data) => {
      setTransactions(data)
      setLoading(false)
    }, pageSize)
    return unsub
  }, [user, authLoading, pageSize])

  const spendingByCategory = useMemo(() => computeSpendingByCategory(transactions), [transactions])

  return { transactions, spendingByCategory, loading }
}

// ── All transactions (last 13 months, unbounded count) ─────────────────────────
// Use this for month/category math — the paginated useTransactions only has the
// most recent 50 and would undercount budgets, charts and reports.
export function useAllTransactions() {
  const { user, loading: authLoading } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) { setTransactions(mockExpenses); setLoading(false); return }
    const unsub = subscribeAllTransactions(user.uid, (data) => {
      setTransactions(data)
      setLoading(false)
    })
    return unsub
  }, [user, authLoading])

  const spendingByCategory = useMemo(() => computeSpendingByCategory(transactions), [transactions])

  return { transactions, spendingByCategory, loading }
}

// ── Goals ─────────────────────────────────────────────────────────────────────
export function useGoals() {
  const { user, loading: authLoading } = useAuth()
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) { setGoals(mockGoals); setLoading(false); return }
    const unsub = subscribeGoals(user.uid, (data) => {
      setGoals(data)
      setLoading(false)
    })
    return unsub
  }, [user, authLoading])

  return { goals, loading }
}

// ── Investments ───────────────────────────────────────────────────────────────
export function useInvestments() {
  const { user, loading: authLoading } = useAuth()
  const [investments, setInvestments] = useState<Investment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) { setInvestments(mockInvestments); setLoading(false); return }
    const unsub = subscribeInvestments(user.uid, (data) => {
      setInvestments(data)
      setLoading(false)
    })
    return unsub
  }, [user, authLoading])

  return { investments, loading }
}

// ── Balances ──────────────────────────────────────────────────────────────────
export function useBalances() {
  const { user, loading: authLoading } = useAuth()
  const [balances, setBalances] = useState<Balances>(EMPTY_BALANCES)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) { setBalances(mockBalances); setLoading(false); return }
    const unsub = subscribeBalances(user.uid, (data) => {
      setBalances(data ?? EMPTY_BALANCES)
      setLoading(false)
    })
    return unsub
  }, [user, authLoading])

  return { balances, loading }
}

// ── Budgets ───────────────────────────────────────────────────────────────────
export function useBudgets() {
  const { user, loading: authLoading } = useAuth()
  const [budgets, setBudgetsState] = useState<Record<string, number>>({})
  const [loading, setLoading]      = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) { setLoading(false); return }
    const unsub = subscribeBudgets(user.uid, (data) => {
      setBudgetsState(data)
      setLoading(false)
    })
    return unsub
  }, [user, authLoading])

  return { budgets, loading }
}

// ── Monthly analytics — computed live from all transactions ───────────────────
function aggregateMonthly(txs: Transaction[], locale = 'en-US'): MonthlyDataPoint[] {
  if (txs.length === 0) return []
  const byMonth: Record<string, { income: number; expenses: number }> = {}
  txs.forEach((tx) => {
    if (tx.category === TRANSFER_CATEGORY) return   // transfers are balance-neutral
    const key = tx.date.slice(0, 7)           // "YYYY-MM"
    if (!byMonth[key]) byMonth[key] = { income: 0, expenses: 0 }
    if (tx.amount > 0) byMonth[key].income   += tx.amount
    else               byMonth[key].expenses += Math.abs(tx.amount)
  })
  let running = 0   // cumulative net flow (savings) over the period
  return Object.keys(byMonth)
    .sort()
    .map((key) => {
      const { income, expenses } = byMonth[key]
      const [y, m] = key.split('-').map(Number)
      const label  = new Date(y, m - 1, 1).toLocaleString(locale, { month: 'short' })
      const savings = income - expenses
      running += savings
      return {
        month:    label,
        income:   Math.round(income),
        expenses: Math.round(expenses),
        savings:  Math.round(savings),
        balance:  Math.round(running),   // cumulative savings to date
      }
    })
}

export function useMonthlyData() {
  const { user, profile, loading: authLoading } = useAuth()
  const [allTxs, setAllTxs] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) { setAllTxs([]); setLoading(false); return }
    const unsub = subscribeAllTransactions(user.uid, (data) => {
      setAllTxs(data)
      setLoading(false)
    })
    return unsub
  }, [user, authLoading])

  const locale = profile?.language === 'pt-BR' ? 'pt-BR' : 'en-US'
  const monthly = useMemo((): MonthlyDataPoint[] => {
    if (!user) return mockMonthlyData           // preview for logged-out
    return aggregateMonthly(allTxs, locale)
  }, [allTxs, user, locale])

  return { monthly, loading }
}

// ── Recurring transactions ─────────────────────────────────────────────────────
export function useRecurrences() {
  const { user, loading: authLoading } = useAuth()
  const [recurrences, setRecurrences] = useState<RecurringTransaction[]>([])
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) { setLoading(false); return }
    const unsub = subscribeRecurring(user.uid, (data) => {
      setRecurrences(data)
      setLoading(false)
    })
    return unsub
  }, [user, authLoading])

  return { recurrences, loading }
}

// ── Accounts ───────────────────────────────────────────────────────────────────
export function useAccounts() {
  const { user, loading: authLoading } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) { setAccounts([]); setLoading(false); return }
    const unsub = subscribeAccounts(user.uid, (data) => {
      setAccounts(data)
      setLoading(false)
    })
    return unsub
  }, [user, authLoading])

  const totalBalance = useMemo(() => accounts.reduce((s, a) => s + a.balance, 0), [accounts])

  return { accounts, totalBalance, loading }
}

// ── Categories (default + custom) ─────────────────────────────────────────────
export function useCategories() {
  const { user, loading: authLoading } = useAuth()
  const [custom, setCustom]   = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) { setCustom([]); setLoading(false); return }
    const unsub = subscribeCategories(user.uid, (data) => {
      setCustom(data)
      setLoading(false)
    })
    return unsub
  }, [user, authLoading])

  const all    = useMemo(() => mergeCategories(custom), [custom])
  const budget = useMemo(() => toBudgetCategories(custom), [custom])

  return { categories: all, budgetCategories: budget, custom, loading }
}

// ── Auto-process due recurrences on login ─────────────────────────────────────
export function useProcessRecurrences() {
  const { user, loading: authLoading } = useAuth()

  useEffect(() => {
    if (authLoading || !user) return
    // Only run once per day (guard via sessionStorage)
    const key = `ma-recurring-${user.uid}-${new Date().toISOString().slice(0, 10)}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')

    processDueRecurrences(user.uid).catch(console.warn)
  }, [user, authLoading])
}

'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { FadeReveal, StaggerReveal, StaggerItem } from '@/components/motion/FadeReveal'
import { useTransactions, useCategories, useAccounts } from '@/hooks/useFirestore'
import { addTransaction, updateTransaction, deleteTransaction } from '@/lib/firestore'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useCurrency } from '@/hooks/useCurrency'
import { useT } from '@/hooks/useT'
import { Drawer } from '@/components/ui/Drawer/Drawer'
import { SkeletonTableRow } from '@/components/ui/Skeleton/Skeleton'
import { RecurringDrawer } from '@/components/ui/RecurringDrawer/RecurringDrawer'
import { ImportDrawer } from '@/components/ui/ImportDrawer/ImportDrawer'
import type { Transaction } from '@/lib/types'
import styles from './ExpenseTable.module.scss'

const CATEGORY_BADGE_MAP: Record<string, string> = {
  Dining:        styles.badgeDining,
  Investment:    styles.badgeInvestment,
  Subscriptions: styles.badgeSubscriptions,
  Income:        styles.badgeIncome,
  Housing:       styles.badgeHousing,
  Groceries:     styles.badgeGroceries,
  Shopping:      styles.badgeShopping,
  Utilities:     styles.badgeUtilities,
}

function getInitial(merchant: string): string {
  const map: Record<string, string> = {
    'Nakamura Restaurant': '中', 'Vanguard Auto-Invest': '▲',
    'Spotify Premium': '♪', 'Salary Deposit': '¥',
    'Rent — Shinjuku Apt.': '⌂', 'Whole Foods Market': '⊞',
    'Tokyo Freelance Client': '東', 'Adobe Creative Cloud': 'Ai',
    'Muji Online': '無', 'Electricity & Gas': '⚡',
  }
  return map[merchant] ?? merchant[0]?.toUpperCase() ?? '?'
}

function fmtDate(s: string) { return format(parseISO(s), 'MMM d') }

function exportToCSV(transactions: Transaction[]) {
  const headers = ['Date', 'Merchant', 'Category', 'Amount', 'Status', 'Note']
  const rows = transactions.map((tx) => [
    tx.date,
    `"${tx.merchant.replace(/"/g, '""')}"`,
    tx.category,
    tx.amount.toFixed(2),
    tx.status,
    `"${(tx.note ?? '').replace(/"/g, '""')}"`,
  ])
  const csv  = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const makeBlank = () => ({
  type:      'expense' as 'income' | 'expense',
  merchant:  '',
  category:  'Dining',
  amount:    '',
  date:      new Date().toISOString().slice(0, 10),
  status:    'completed' as 'completed' | 'pending',
  note:      '',
  accountId: '',
})

export function ExpenseTable() {
  const { user }                  = useAuth()
  const { toast }                 = useToast()
  const { fmtTx }                 = useCurrency()
  const { categories: CATEGORIES } = useCategories()
  const { accounts } = useAccounts()
  const t = useT()

  // ── Pagination ────────────────────────────────────────────────────────────
  const [txLimit, setTxLimit]     = useState(50)
  const { transactions, loading } = useTransactions(txLimit)

  // ── Drawer / form state ───────────────────────────────────────────────────
  const [drawerOpen,     setDrawerOpen]     = useState(false)
  const [recurringOpen,  setRecurringOpen]  = useState(false)
  const [importOpen,     setImportOpen]     = useState(false)
  const [editingTx,      setEditingTx]      = useState<Transaction | null>(null)
  const [form,           setForm]           = useState(makeBlank)
  const [submitting,      setSubmitting]      = useState(false)
  const [error,           setError]           = useState('')
  const [deletingId,      setDeletingId]      = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Bulk select ───────────────────────────────────────────────────────────
  const [selectMode,    setSelectMode]    = useState(false)
  const [selected,      setSelected]      = useState<Set<string>>(new Set())
  const [bulkDeleting,  setBulkDeleting]  = useState(false)

  // ── Search / filter state ─────────────────────────────────────────────────
  const [search,          setSearch]          = useState('')
  const [filterType,      setFilterType]      = useState<'all' | 'income' | 'expense'>('all')
  const [filterCategory,  setFilterCategory]  = useState('all')
  const [filterAccount,   setFilterAccount]   = useState('all')

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (search) {
        const q = search.toLowerCase()
        if (
          !tx.merchant.toLowerCase().includes(q) &&
          !tx.category.toLowerCase().includes(q) &&
          !(tx.note?.toLowerCase().includes(q))
        ) return false
      }
      if (filterType === 'income'  && tx.amount <= 0) return false
      if (filterType === 'expense' && tx.amount >= 0) return false
      if (filterCategory !== 'all' && tx.category !== filterCategory) return false
      if (filterAccount !== 'all' && tx.accountId !== filterAccount) return false
      return true
    })
  }, [transactions, search, filterType, filterCategory, filterAccount])

  const hasFilters = search !== '' || filterType !== 'all' || filterCategory !== 'all' || filterAccount !== 'all'

  // ── Bulk select helpers ───────────────────────────────────────────────────
  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const exitSelectMode = useCallback(() => {
    setSelectMode(false)
    setSelected(new Set())
  }, [])

  const allFilteredSelected = filtered.length > 0 && filtered.every((t) => selected.has(t.id))

  const toggleSelectAll = () => {
    if (allFilteredSelected) setSelected(new Set())
    else setSelected(new Set(filtered.map((t) => t.id)))
  }

  const handleBulkDelete = async () => {
    if (!user || selected.size === 0) return
    setBulkDeleting(true)
    for (const id of Array.from(selected)) {
      await deleteTransaction(user.uid, id)
    }
    setBulkDeleting(false)
    toast(`Deleted ${selected.size} transaction${selected.size !== 1 ? 's' : ''}`, 'info')
    exitSelectMode()
  }

  // ── Keyboard shortcut: N → new transaction ────────────────────────────────
  useEffect(() => {
    const handler = () => {
      if (!user) return
      setEditingTx(null)
      setForm(makeBlank())
      setDrawerOpen(true)
    }
    window.addEventListener('ma:new-transaction', handler)
    return () => window.removeEventListener('ma:new-transaction', handler)
  }, [user])

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const resetAndClose = () => {
    setForm(makeBlank())
    setError('')
    setEditingTx(null)
    setDrawerOpen(false)
  }

  // ── Edit: pre-fill form with existing tx data ─────────────────────────────
  const handleEdit = (tx: Transaction) => {
    setEditingTx(tx)
    setForm({
      type:      tx.amount > 0 ? 'income' : 'expense',
      merchant:  tx.merchant,
      category:  tx.category,
      amount:    String(Math.abs(tx.amount)),
      date:      tx.date,
      status:    tx.status,
      note:      tx.note ?? '',
      accountId: tx.accountId ?? '',
    })
    setDrawerOpen(true)
  }

  // ── Submit: create or update ──────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !form.merchant.trim() || !form.amount) return
    setSubmitting(true)
    setError('')
    try {
      const amt = parseFloat(form.amount)
      if (isNaN(amt) || amt <= 0) throw new Error('Invalid amount')

      const payload = {
        merchant: form.merchant.trim(),
        category: form.category,
        amount:   form.type === 'income' ? amt : -amt,
        date:     form.date,
        status:   form.status,
        note:     form.note.trim() || null,
        ...(form.accountId ? { accountId: form.accountId } : {}),
      }

      if (editingTx) {
        await updateTransaction(user.uid, editingTx.id, payload)
        toast(t('toast.txUpdated'), 'success')
      } else {
        await addTransaction(user.uid, payload)
        toast(t('toast.txAdded'), 'success')
      }
      resetAndClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Delete with confirmation ──────────────────────────────────────────────
  const requestDelete = (id: string) => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    setConfirmDeleteId(id)
    confirmTimerRef.current = setTimeout(() => setConfirmDeleteId(null), 3000)
  }

  const handleDelete = async (id: string) => {
    if (!user) return
    setConfirmDeleteId(null)
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    setDeletingId(id)
    try {
      await deleteTransaction(user.uid, id)
      toast(t('toast.txDeleted'), 'info')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className={styles.section} id="expenses">
      <FadeReveal variant="rise">
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <span className={styles.sectionTag}>{t('sec.tx.tag')}</span>
            <h2 className={styles.sectionTitle}>{t('sec.tx.title')}</h2>
          </div>
          <div className={styles.headerActions}>
            {filtered.length > 0 && (
              <button className={styles.exportBtn} onClick={() => exportToCSV(filtered)} title="Export to CSV">
                ↓ CSV
              </button>
            )}
            {user && !selectMode && (
              <button className={styles.exportBtn} onClick={() => setImportOpen(true)} title={t('imp.title')}>
                ↑ {t('tx.import')}
              </button>
            )}
            {user && !selectMode && (
              <button className={styles.exportBtn} onClick={() => setRecurringOpen(true)} title={t('rec.title')}>
                ↺ {t('tx.recurring')}
              </button>
            )}
            {user && transactions.length > 0 && !selectMode && (
              <button className={styles.exportBtn} onClick={() => setSelectMode(true)} title={t('tx.select')}>
                ☐ {t('tx.select')}
              </button>
            )}
            {selectMode && (
              <button className={styles.exportBtn} onClick={exitSelectMode}>
                ✕ {t('common.cancel')}
              </button>
            )}
            {user && !selectMode && (
              <button className={styles.addBtn} onClick={() => { setEditingTx(null); setForm(makeBlank()); setDrawerOpen(true) }}>
                <span>＋</span> {t('common.add')}
              </button>
            )}
          </div>
        </div>
      </FadeReveal>

      <FadeReveal variant="mask" delay={0.1}>
        <div className={styles.tableCard}>

          {/* ── Filter bar ─────────────────────────────────────────── */}
          <div className={styles.filterBar}>
            {selectMode ? (
              <button className={styles.selectAllBtn} onClick={toggleSelectAll}>
                {allFilteredSelected ? '☑' : '☐'}
                <span>{selected.size > 0 ? `${selected.size} ${t('tx.selected')}` : t('tx.selectAll')}</span>
              </button>
            ) : (
              <div className={styles.searchWrap}>
                <span className={styles.searchIcon}>⌕</span>
                <input
                  className={styles.searchInput}
                  placeholder={t('tx.searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search transactions"
                />
                {search && (
                  <button className={styles.clearBtn} onClick={() => setSearch('')} aria-label="Clear search">✕</button>
                )}
              </div>
            )}

            {!selectMode && (
              <div className={styles.filterGroup}>
                {(['all', 'income', 'expense'] as const).map((ft) => (
                  <button
                    key={ft}
                    className={`${styles.filterBtn} ${filterType === ft ? styles.filterBtnActive : ''}`}
                    onClick={() => setFilterType(ft)}
                  >
                    {ft === 'all' ? t('tx.all') : ft === 'income' ? t('form.income') : t('form.expense')}
                  </button>
                ))}
              </div>
            )}

            {!selectMode && (
              <select
                className={styles.categorySelect}
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                aria-label={t('form.category')}
              >
                <option value="all">{t('tx.allCategories')}</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{t(`cat.${c}`, c)}</option>)}
              </select>
            )}

            {!selectMode && accounts.length > 0 && (
              <select
                className={styles.categorySelect}
                value={filterAccount}
                onChange={(e) => setFilterAccount(e.target.value)}
                aria-label={t('form.account')}
              >
                <option value="all">{t('tx.allAccounts')}</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}
          </div>

          {/* ── Column headers ──────────────────────────────────────── */}
          <div className={styles.tableHeader}>
            <span className={styles.th}>{t('tx.merchantCol')}</span>
            <span className={styles.th}>{t('form.category')}</span>
            <span className={styles.th}>{t('tx.dateCol')}</span>
            <span className={`${styles.th} ${styles.thRight}`}>{t('tx.amountCol')}</span>
            {user && <span className={styles.th} />}
          </div>

          {/* ── Loading skeletons ────────────────────────────────────── */}
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonTableRow key={i} />)
          ) : filtered.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>{hasFilters ? '⊘' : '⊘'}</span>
              <span className={styles.emptyText}>
                {hasFilters ? t('tx.noResults') : t('tx.none')}
              </span>
              {hasFilters ? (
                <button className={styles.emptyAction} onClick={() => { setSearch(''); setFilterType('all'); setFilterCategory('all'); setFilterAccount('all') }}>
                  {t('tx.clearFilters')}
                </button>
              ) : user && (
                <button className={styles.emptyAction} onClick={() => setDrawerOpen(true)}>
                  {t('tx.addFirst')}
                </button>
              )}
            </div>
          ) : (
            <>
            <StaggerReveal stagger={0.04} delay={0.05}>
              {filtered.map((tx) => {
                const isSelected = selected.has(tx.id)
                return (
                  <StaggerItem key={tx.id}>
                    <motion.div
                      className={[
                        styles.row,
                        selectMode  ? styles.rowSelectMode  : '',
                        isSelected  ? styles.rowSelected    : '',
                        deletingId === tx.id ? styles.rowDeleting : '',
                      ].filter(Boolean).join(' ')}
                      onClick={selectMode ? () => toggleSelect(tx.id) : undefined}
                      whileHover={{ x: selectMode ? 0 : 2 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <div className={`${styles.rowAccent} ${isSelected ? styles.rowAccentSelected : ''}`} />
                      <div className={styles.merchant}>
                        <div className={`${styles.merchantIcon} ${isSelected ? styles.merchantIconSelected : ''}`}>
                          {selectMode ? (isSelected ? '✓' : '') : getInitial(tx.merchant)}
                        </div>
                        <div>
                          <div className={styles.merchantName}>{tx.merchant}</div>
                          {tx.note && <div className={styles.merchantNote}>{tx.note}</div>}
                        </div>
                      </div>
                      <span className={`${styles.badge} ${CATEGORY_BADGE_MAP[tx.category] ?? ''}`}>
                        {t(`cat.${tx.category}`, tx.category)}
                      </span>
                      <span className={styles.date}>{fmtDate(tx.date)}</span>
                      <span className={`${styles.amount} ${tx.amount > 0 ? styles.amountIncome : styles.amountExpense}`}>
                        {fmtTx(tx.amount)}
                      </span>
                      {user && !selectMode && (
                        <div className={styles.rowActions}>
                          <button
                            className={styles.editBtn}
                            onClick={() => handleEdit(tx)}
                            aria-label="Edit transaction"
                          >
                            ✎
                          </button>
                          {confirmDeleteId === tx.id ? (
                            <>
                              <button
                                className={styles.deleteConfirmBtn}
                                onClick={() => handleDelete(tx.id)}
                                disabled={deletingId === tx.id}
                                aria-label="Confirm delete"
                                title="Confirm delete"
                              >
                                ✓
                              </button>
                              <button
                                className={styles.deleteCancelBtn}
                                onClick={() => setConfirmDeleteId(null)}
                                aria-label="Cancel delete"
                              >
                                ✕
                              </button>
                            </>
                          ) : (
                            <button
                              className={styles.deleteBtn}
                              onClick={() => requestDelete(tx.id)}
                              disabled={deletingId === tx.id}
                              aria-label="Delete transaction"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      )}
                    </motion.div>
                  </StaggerItem>
                )
              })}
            </StaggerReveal>

            {/* ── Bulk action bar ──────────────────────────────────────── */}
            {selectMode && selected.size > 0 && (
              <div className={styles.bulkBar}>
                <span className={styles.bulkCount}>{selected.size} {t('tx.selected')}</span>
                <div className={styles.bulkActions}>
                  <select
                    className={styles.bulkCategorySelect}
                    defaultValue=""
                    onChange={async (e) => {
                      const cat = e.target.value
                      if (!user || !cat) return
                      for (const id of Array.from(selected)) {
                        await updateTransaction(user.uid, id, { category: cat })
                      }
                      toast(t('toast.txUpdated'), 'success')
                      exitSelectMode()
                      e.target.value = ''
                    }}
                  >
                    <option value="" disabled>{t('tx.recategorize')}</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{t(`cat.${c}`, c)}</option>)}
                  </select>
                  <button
                    className={styles.bulkDeleteBtn}
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting}
                  >
                    {bulkDeleting ? t('toast.deleting') : `${t('toast.deleteN')} ${selected.size}`}
                  </button>
                </div>
              </div>
            )}

            {/* ── Load more ────────────────────────────────────────────── */}
            {!loading && !selectMode && transactions.length >= txLimit && (
              <div className={styles.loadMore}>
                <button
                  className={styles.loadMoreBtn}
                  onClick={() => setTxLimit((l) => l + 50)}
                >
                  {t('tx.loadMore')}
                </button>
              </div>
            )}
            </>
          )}
        </div>
      </FadeReveal>

      {/* ── Recurring Transactions Drawer ────────────────────────────── */}
      <RecurringDrawer isOpen={recurringOpen} onClose={() => setRecurringOpen(false)} />

      {/* ── Import CSV Drawer ─────────────────────────────────────────── */}
      <ImportDrawer isOpen={importOpen} onClose={() => setImportOpen(false)} />

      {/* ── Add / Edit Transaction Drawer ────────────────────────────── */}
      <Drawer
        isOpen={drawerOpen}
        onClose={resetAndClose}
        title={editingTx ? t('tx.editTitle') : t('tx.newTitle')}
      >
        <form onSubmit={handleSubmit}>
          {/* Type toggle */}
          <div className="form-field">
            <label className="form-label">{t('form.type')}</label>
            <div className="form-toggle">
              <button
                type="button"
                className={'form-toggle-btn' + (form.type === 'income' ? ' active-income' : '')}
                onClick={() => set('type', 'income')}
              >
                {t('form.income')}
              </button>
              <button
                type="button"
                className={'form-toggle-btn' + (form.type === 'expense' ? ' active-expense' : '')}
                onClick={() => set('type', 'expense')}
              >
                {t('form.expense')}
              </button>
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">{t('form.merchant')}</label>
            <input
              className="form-input"
              placeholder="e.g. Whole Foods"
              value={form.merchant}
              onChange={(e) => set('merchant', e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-field">
            <label className="form-label">{t('form.amount')}</label>
            <input
              className="form-input"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label">{t('form.category')}</label>
            <select
              className="form-select"
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{t(`cat.${c}`, c)}</option>)}
            </select>
          </div>

          {accounts.length > 0 && (
            <div className="form-field">
              <label className="form-label">{t('form.account')}</label>
              <select
                className="form-select"
                value={form.accountId}
                onChange={(e) => set('accountId', e.target.value)}
              >
                <option value="">{t('form.noAccount')}</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}

          <div className="form-field">
            <label className="form-label">{t('form.date')}</label>
            <input
              className="form-input"
              type="date"
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label">{t('form.status')}</label>
            <div className="form-toggle">
              <button
                type="button"
                className={'form-toggle-btn' + (form.status === 'completed' ? ' active-neutral' : '')}
                onClick={() => set('status', 'completed')}
              >
                {t('form.completed')}
              </button>
              <button
                type="button"
                className={'form-toggle-btn' + (form.status === 'pending' ? ' active-neutral' : '')}
                onClick={() => set('status', 'pending')}
              >
                {t('form.pending')}
              </button>
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">{t('form.note')}</label>
            <textarea
              className="form-textarea"
              placeholder={t('form.notePlaceholder')}
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <button className="form-submit" type="submit" disabled={submitting}>
            {submitting
              ? t('common.saving')
              : (editingTx ? t('form.saveChanges') : t('tx.saveTransaction'))
            }
          </button>
        </form>
      </Drawer>
    </section>
  )
}

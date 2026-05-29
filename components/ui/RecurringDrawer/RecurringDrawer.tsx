'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Drawer } from '@/components/ui/Drawer/Drawer'
import { useRecurrences, useCategories } from '@/hooks/useFirestore'
import { addRecurring, updateRecurring, deleteRecurring } from '@/lib/firestore'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useCurrency } from '@/hooks/useCurrency'
import { useT } from '@/hooks/useT'
import type { RecurringTransaction, RecurringFrequency } from '@/lib/types'
import styles from './RecurringDrawer.module.scss'

const FREQ_KEY: Record<RecurringFrequency, string> = {
  daily: 'freq.daily', weekly: 'freq.weekly', biweekly: 'freq.biweekly',
  monthly: 'freq.monthly', yearly: 'freq.yearly',
}
const FREQ_ORDER: RecurringFrequency[] = ['daily', 'weekly', 'biweekly', 'monthly', 'yearly']

const makeBlank = () => ({
  type:      'expense' as 'income' | 'expense',
  merchant:  '',
  category:  'Subscriptions',
  amount:    '',
  frequency: 'monthly' as RecurringFrequency,
  startDate: new Date().toISOString().slice(0, 10),
  note:      '',
})

interface Props { isOpen: boolean; onClose: () => void }

export function RecurringDrawer({ isOpen, onClose }: Props) {
  const { user }            = useAuth()
  const { toast }           = useToast()
  const { fmt, fmtTx }      = useCurrency()
  const t                   = useT()
  const { recurrences }     = useRecurrences()
  const { categories: CATEGORIES } = useCategories()

  const [view, setView]           = useState<'list' | 'add' | 'edit'>('list')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm]           = useState(makeBlank)
  const [saving, setSaving]       = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const resetToList = () => { setView('list'); setForm(makeBlank()); setEditingId(null) }

  const openEdit = (rec: RecurringTransaction) => {
    setEditingId(rec.id)
    setForm({
      type:      rec.amount > 0 ? 'income' : 'expense',
      merchant:  rec.merchant,
      category:  rec.category,
      amount:    String(Math.abs(rec.amount)),
      frequency: rec.frequency,
      startDate: rec.startDate,
      note:      rec.note ?? '',
    })
    setView('edit')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !form.merchant.trim() || !form.amount) return
    const amt = parseFloat(form.amount)
    if (isNaN(amt) || amt <= 0) return
    setSaving(true)
    try {
      const payload = {
        merchant:    form.merchant.trim(),
        category:    form.category,
        amount:      form.type === 'income' ? amt : -amt,
        frequency:   form.frequency,
        startDate:   form.startDate,
        nextDue:     form.startDate,
        lastCreated: null,
        active:      true,
        note:        form.note.trim() || null,
      }
      if (view === 'edit' && editingId) {
        await updateRecurring(user.uid, editingId, payload)
        toast('Recurrence updated', 'success')
      } else {
        await addRecurring(user.uid, payload)
        toast('Recurrence created', 'success')
      }
      resetToList()
    } catch { toast('Failed to save', 'error') }
    finally { setSaving(false) }
  }

  const handleToggle = async (rec: RecurringTransaction) => {
    if (!user) return
    await updateRecurring(user.uid, rec.id, { active: !rec.active })
    toast(rec.active ? 'Paused' : 'Resumed', 'info')
  }

  const handleDelete = async (id: string) => {
    if (!user) return
    setDeletingId(id)
    try {
      await deleteRecurring(user.uid, id)
      toast('Recurrence deleted', 'info')
    } finally { setDeletingId(null) }
  }

  const drawerTitle =
    view === 'list' ? `${t('rec.title')} (${recurrences.length})` :
    view === 'add'  ? t('rec.newTitle') : t('rec.editTitle')

  return (
    <Drawer
      isOpen={isOpen}
      onClose={() => { resetToList(); onClose() }}
      title={drawerTitle}
    >
      {/* ── List view ────────────────────────────────────────── */}
      {view === 'list' && (
        <div className={styles.listView}>
          <button
            className={styles.addBtn}
            onClick={() => setView('add')}
          >
            <span>＋</span> {t('rec.add')}
          </button>

          {recurrences.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>↺</span>
              <p className={styles.emptyText}>{t('rec.none')}</p>
              <p className={styles.emptySub}>{t('rec.noneSub')}</p>
            </div>
          ) : (
            <div className={styles.recList}>
              {recurrences.map((rec) => (
                <div
                  key={rec.id}
                  className={`${styles.recItem} ${!rec.active ? styles.recItemPaused : ''} ${deletingId === rec.id ? styles.recItemDeleting : ''}`}
                >
                  <div className={styles.recTop}>
                    <div className={styles.recInfo}>
                      <span className={styles.recMerchant}>{rec.merchant}</span>
                      <span className={styles.recFreq}>{t(FREQ_KEY[rec.frequency])}</span>
                    </div>
                    <span className={`${styles.recAmount} ${rec.amount > 0 ? styles.recIncome : styles.recExpense}`}>
                      {fmtTx(rec.amount)}
                    </span>
                  </div>

                  <div className={styles.recMeta}>
                    <span className={styles.recCategory}>{t(`cat.${rec.category}`, rec.category)}</span>
                    <span className={styles.recNext}>
                      {t('rec.next')}: {format(parseISO(rec.nextDue), 'MMM d, yyyy')}
                    </span>
                  </div>

                  <div className={styles.recActions}>
                    <button
                      className={`${styles.recActionBtn} ${rec.active ? styles.pauseBtn : styles.resumeBtn}`}
                      onClick={() => handleToggle(rec)}
                    >
                      {rec.active ? t('rec.pause') : t('rec.resume')}
                    </button>
                    <button className={styles.recActionBtn} onClick={() => openEdit(rec)}>
                      {t('common.edit')}
                    </button>
                    <button
                      className={`${styles.recActionBtn} ${styles.deleteBtn}`}
                      onClick={() => handleDelete(rec.id)}
                      disabled={deletingId === rec.id}
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Add / Edit form ───────────────────────────────────── */}
      {(view === 'add' || view === 'edit') && (
        <form onSubmit={handleSubmit}>
          <button type="button" className={styles.backLink} onClick={resetToList}>
            ← {t('rec.back')}
          </button>

          <div className="form-field">
            <label className="form-label">{t('form.type')}</label>
            <div className="form-toggle">
              <button type="button"
                className={'form-toggle-btn' + (form.type === 'income' ? ' active-income' : '')}
                onClick={() => set('type', 'income')}>{t('form.income')}</button>
              <button type="button"
                className={'form-toggle-btn' + (form.type === 'expense' ? ' active-expense' : '')}
                onClick={() => set('type', 'expense')}>{t('form.expense')}</button>
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">{t('form.merchant')}</label>
            <input className="form-input" placeholder="e.g. Netflix, Salary"
              value={form.merchant} onChange={(e) => set('merchant', e.target.value)}
              required autoFocus />
          </div>

          <div className="form-field">
            <label className="form-label">{t('form.amount')}</label>
            <input className="form-input" type="number" min="0.01" step="0.01" placeholder="0.00"
              value={form.amount} onChange={(e) => set('amount', e.target.value)} required />
          </div>

          <div className="form-field">
            <label className="form-label">{t('form.category')}</label>
            <select className="form-select" value={form.category}
              onChange={(e) => set('category', e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{t(`cat.${c}`, c)}</option>)}
            </select>
          </div>

          <div className="form-field">
            <label className="form-label">{t('rec.frequency')}</label>
            <select className="form-select" value={form.frequency}
              onChange={(e) => set('frequency', e.target.value)}>
              {FREQ_ORDER.map((v) => (
                <option key={v} value={v}>{t(FREQ_KEY[v])}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label className="form-label">{t('rec.startDate')}</label>
            <input className="form-input" type="date"
              value={form.startDate} onChange={(e) => set('startDate', e.target.value)} required />
          </div>

          <div className="form-field">
            <label className="form-label">{t('form.note')}</label>
            <textarea className="form-textarea" placeholder={t('form.notePlaceholder')}
              value={form.note} onChange={(e) => set('note', e.target.value)} />
          </div>

          <button className="form-submit" type="submit" disabled={saving}>
            {saving ? t('common.saving') : view === 'edit' ? t('form.saveChanges') : t('rec.create')}
          </button>
        </form>
      )}
    </Drawer>
  )
}

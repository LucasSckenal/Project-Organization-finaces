'use client'

import { useState } from 'react'
import { FadeReveal, StaggerReveal, StaggerItem } from '@/components/motion/FadeReveal'
import { useAccounts } from '@/hooks/useFirestore'
import { addAccount, updateAccount, deleteAccount, transferBetweenAccounts } from '@/lib/firestore'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useCurrency } from '@/hooks/useCurrency'
import { Drawer } from '@/components/ui/Drawer/Drawer'
import { useT } from '@/hooks/useT'
import type { Account, AccountType } from '@/lib/types'
import styles from './AccountsSection.module.scss'

const ACCOUNT_TYPES: { type: AccountType; label: string; glyph: string; color: string }[] = [
  { type: 'checking',   label: 'Checking',   glyph: '◇', color: '#6a9c7a' },
  { type: 'savings',    label: 'Savings',    glyph: '◈', color: '#c4a882' },
  { type: 'card',       label: 'Card',       glyph: '▭', color: '#c07070' },
  { type: 'cash',       label: 'Cash',       glyph: '○', color: '#857e74' },
  { type: 'investment', label: 'Investment', glyph: '△', color: '#7a9c8a' },
]

const ACCT_TYPE_KEY: Record<AccountType, string> = {
  checking: 'acctype.checking', savings: 'acctype.savings', card: 'acctype.card',
  cash: 'acctype.cash', investment: 'acctype.investment',
}

const typeMeta = (t: AccountType) => ACCOUNT_TYPES.find((x) => x.type === t) ?? ACCOUNT_TYPES[0]

const makeBlank = () => ({ name: '', type: 'checking' as AccountType, balance: '' })

export function AccountsSection() {
  const { user }     = useAuth()
  const { toast }    = useToast()
  const { fmt }      = useCurrency()
  const { accounts, totalBalance } = useAccounts()
  const t = useT()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing,    setEditing]    = useState<Account | null>(null)
  const [form,       setForm]       = useState(makeBlank)
  const [saving,     setSaving]     = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Transfer state
  const [transferOpen, setTransferOpen] = useState(false)
  const [fromId, setFromId] = useState('')
  const [toId,   setToId]   = useState('')
  const [transferAmt, setTransferAmt] = useState('')
  const [transferring, setTransferring] = useState(false)

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const openAdd = () => { setEditing(null); setForm(makeBlank()); setDrawerOpen(true) }
  const openEdit = (a: Account) => {
    setEditing(a)
    setForm({ name: a.name, type: a.type, balance: String(a.balance) })
    setDrawerOpen(true)
  }
  const closeDrawer = () => { setDrawerOpen(false); setEditing(null); setForm(makeBlank()) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !form.name.trim()) return
    setSaving(true)
    try {
      const payload = {
        name:    form.name.trim(),
        type:    form.type,
        balance: parseFloat(form.balance) || 0,
        color:   typeMeta(form.type).color,
      }
      if (editing) {
        await updateAccount(user.uid, editing.id, payload)
        toast('Account updated', 'success')
      } else {
        await addAccount(user.uid, payload)
        toast('Account added', 'success')
      }
      closeDrawer()
    } catch { toast('Failed to save', 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!user) return
    setDeletingId(id)
    try {
      await deleteAccount(user.uid, id)
      toast('Account deleted', 'info')
    } finally { setDeletingId(null) }
  }

  const openTransfer = () => {
    setFromId(accounts[0]?.id ?? '')
    setToId(accounts[1]?.id ?? '')
    setTransferAmt('')
    setTransferOpen(true)
  }

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const from = accounts.find((a) => a.id === fromId)
    const to   = accounts.find((a) => a.id === toId)
    const amt  = parseFloat(transferAmt)
    if (!from || !to || from.id === to.id || isNaN(amt) || amt <= 0) {
      toast('Pick two different accounts and a valid amount', 'error'); return
    }
    setTransferring(true)
    try {
      await transferBetweenAccounts(user.uid, from, to, amt, new Date().toISOString().slice(0, 10))
      toast(`Transferred ${fmt(amt)}`, 'success')
      setTransferOpen(false)
    } catch { toast('Transfer failed', 'error') }
    finally { setTransferring(false) }
  }

  if (!user) return null

  return (
    <section className={styles.section} id="accounts">
      <FadeReveal variant="rise">
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <span className={styles.sectionTag}>{t('nav.accounts')}</span>
            <h2 className={styles.sectionTitle}>{t('accounts.title')}</h2>
          </div>
          <div className={styles.headerActions}>
            {accounts.length >= 2 && (
              <button className={styles.ghostBtn} onClick={openTransfer}>⇄ {t('accounts.transfer')}</button>
            )}
            <button className={styles.addBtn} onClick={openAdd}><span>＋</span> {t('accounts.add')}</button>
          </div>
        </div>
      </FadeReveal>

      {accounts.length === 0 ? (
        <FadeReveal variant="rise" delay={0.05}>
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>◫</span>
            <span className={styles.emptyText}>{t('accounts.empty')}</span>
            <span className={styles.emptySub}>{t('accounts.emptySub')}</span>
            <button className={styles.emptyAction} onClick={openAdd}>{t('accounts.emptyAction')}</button>
          </div>
        </FadeReveal>
      ) : (
        <StaggerReveal stagger={0.06} delay={0.05}>
          <div className={styles.grid}>
            {accounts.map((a) => {
              const meta = typeMeta(a.type)
              return (
                <StaggerItem key={a.id}>
                  <div className={`${styles.card} ${deletingId === a.id ? styles.cardDeleting : ''}`}>
                    <div className={styles.cardTop}>
                      <span className={styles.cardGlyph} style={{ color: meta.color }}>{meta.glyph}</span>
                      <div className={styles.cardActions}>
                        <button className={styles.iconBtn} onClick={() => openEdit(a)} aria-label="Edit account">✎</button>
                        <button className={styles.iconBtn} onClick={() => handleDelete(a.id)} aria-label="Delete account">✕</button>
                      </div>
                    </div>
                    <div className={styles.cardName}>{a.name}</div>
                    <div className={styles.cardType}>{t(ACCT_TYPE_KEY[a.type], meta.label)}</div>
                    <div className={styles.cardBalance}>{fmt(a.balance)}</div>
                  </div>
                </StaggerItem>
              )
            })}

            {/* Total card */}
            <StaggerItem>
              <div className={`${styles.card} ${styles.totalCard}`}>
                <div className={styles.cardType}>{t('accounts.total')}</div>
                <div className={styles.totalValue}>{fmt(totalBalance)}</div>
                <div className={styles.cardType}>
                  {accounts.length} {accounts.length !== 1 ? t('accounts.countPlural') : t('accounts.countOne')}
                </div>
              </div>
            </StaggerItem>
          </div>
        </StaggerReveal>
      )}

      {/* ── Add / Edit Drawer ──────────────────────────────────────── */}
      <Drawer isOpen={drawerOpen} onClose={closeDrawer} title={editing ? t('acct.editTitle') : t('acct.newTitle')}>
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label">{t('acct.name')}</label>
            <input className="form-input" placeholder="e.g. Nubank, Main Checking"
              value={form.name} onChange={(e) => set('name', e.target.value)} required autoFocus />
          </div>
          <div className="form-field">
            <label className="form-label">{t('form.type')}</label>
            <select className="form-select" value={form.type} onChange={(e) => set('type', e.target.value)}>
              {ACCOUNT_TYPES.map((at) => <option key={at.type} value={at.type}>{t(ACCT_TYPE_KEY[at.type], at.label)}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">{t('acct.balance')}</label>
            <input className="form-input" type="number" step="0.01" placeholder="0.00"
              value={form.balance} onChange={(e) => set('balance', e.target.value)} />
          </div>
          <button className="form-submit" type="submit" disabled={saving}>
            {saving ? t('common.saving') : editing ? t('form.saveChanges') : t('accounts.add')}
          </button>
        </form>
      </Drawer>

      {/* ── Transfer Drawer ────────────────────────────────────────── */}
      <Drawer isOpen={transferOpen} onClose={() => setTransferOpen(false)} title={t('accounts.transfer')}>
        <form onSubmit={handleTransfer}>
          <div className="form-field">
            <label className="form-label">{t('acct.from')}</label>
            <select className="form-select" value={fromId} onChange={(e) => setFromId(e.target.value)}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} — {fmt(a.balance)}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">{t('acct.to')}</label>
            <select className="form-select" value={toId} onChange={(e) => setToId(e.target.value)}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} — {fmt(a.balance)}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">{t('form.amount')}</label>
            <input className="form-input" type="number" min="0.01" step="0.01" placeholder="0.00"
              value={transferAmt} onChange={(e) => setTransferAmt(e.target.value)} required autoFocus />
          </div>
          <button className="form-submit" type="submit" disabled={transferring}>
            {transferring ? t('acct.transferring') : t('acct.confirmTransfer')}
          </button>
        </form>
      </Drawer>
    </section>
  )
}

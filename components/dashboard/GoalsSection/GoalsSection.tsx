'use client'

import { useState } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { FadeReveal, StaggerReveal, StaggerItem } from '@/components/motion/FadeReveal'
import { useGoals } from '@/hooks/useFirestore'
import { addGoal, updateGoal, deleteGoal, addTransaction } from '@/lib/firestore'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useCurrency } from '@/hooks/useCurrency'
import { useT } from '@/hooks/useT'
import { Drawer } from '@/components/ui/Drawer/Drawer'
import styles from './GoalsSection.module.scss'

type GoalCategory = 'Security' | 'Travel' | 'Wealth' | 'Property'

const CATEGORY_PROGRESS_COLOR: Record<string, string> = {
  Security: styles.colorSecurity,
  Travel:   styles.colorTravel,
  Wealth:   styles.colorWealth,
  Property: styles.colorProperty,
}

const GOAL_CATEGORIES: GoalCategory[] = ['Security', 'Travel', 'Wealth', 'Property']

const makeBlankGoal = () => ({
  name: '', emoji: '◈', target: '', current: '0',
  deadline: new Date().toISOString().slice(0, 10),
  category: 'Security' as GoalCategory,
})

// ── Shared form fields ────────────────────────────────────────────────────────
interface FormFieldsProps {
  form:      ReturnType<typeof makeBlankGoal>
  onChange:  (k: string, v: string) => void
  autoFocus?: boolean
}

function GoalFormFields({ form, onChange, autoFocus = true }: FormFieldsProps) {
  const t = useT()
  return (
    <>
      <div className="form-field">
        <label className="form-label">{t('goals.name')}</label>
        <input className="form-input" placeholder="e.g. Emergency Fund"
          value={form.name} onChange={(e) => onChange('name', e.target.value)}
          required autoFocus={autoFocus} />
      </div>
      <div className="form-field">
        <label className="form-label">{t('goals.emoji')}</label>
        <input className="form-input" placeholder="◈" maxLength={2}
          value={form.emoji} onChange={(e) => onChange('emoji', e.target.value)} />
      </div>
      <div className="form-field">
        <label className="form-label">{t('form.category')}</label>
        <select className="form-select" value={form.category}
          onChange={(e) => onChange('category', e.target.value)}>
          {GOAL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label className="form-label">{t('goals.target')}</label>
        <input className="form-input" type="number" min="1" step="1" placeholder="10000"
          value={form.target} onChange={(e) => onChange('target', e.target.value)} required />
      </div>
      <div className="form-field">
        <label className="form-label">{t('goals.current')}</label>
        <input className="form-input" type="number" min="0" step="1" placeholder="0"
          value={form.current} onChange={(e) => onChange('current', e.target.value)} />
      </div>
      <div className="form-field">
        <label className="form-label">{t('goals.deadline')}</label>
        <input className="form-input" type="date"
          value={form.deadline} onChange={(e) => onChange('deadline', e.target.value)} required />
      </div>
    </>
  )
}

export function GoalsSection() {
  const { user }        = useAuth()
  const { toast }       = useToast()
  const { fmt }         = useCurrency()
  const t = useT()
  const { goals }       = useGoals()

  // ── Drawer state ─────────────────────────────────────────────────────────
  const [addOpen,     setAddOpen]     = useState(false)
  const [editGoal,    setEditGoal]    = useState<typeof goals[0] | null>(null)
  const [depositGoal, setDepositGoal] = useState<typeof goals[0] | null>(null)
  const [depositAmt,  setDepositAmt]  = useState('')
  const [depositing,  setDepositing]  = useState(false)

  const [form,      setForm]      = useState(makeBlankGoal)
  const [saving,    setSaving]    = useState(false)
  const [deletingId,setDeletingId]= useState<string | null>(null)
  const [error,     setError]     = useState('')

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  // ── Helpers ───────────────────────────────────────────────────────────────
  const closeAdd  = () => { setAddOpen(false);  setForm(makeBlankGoal()); setError('') }
  const closeEdit = () => { setEditGoal(null);   setForm(makeBlankGoal()); setError('') }

  const openEdit = (goal: typeof goals[0]) => {
    setEditGoal(goal)
    setForm({
      name:     goal.name,
      emoji:    goal.emoji,
      category: goal.category as GoalCategory,
      target:   String(goal.target),
      current:  String(goal.current),
      deadline: goal.deadline,
    })
  }

  // ── Validate + build payload ──────────────────────────────────────────────
  const buildPayload = () => {
    const target  = parseFloat(form.target)
    const current = parseFloat(form.current)
    if (isNaN(target) || target <= 0) { setError('Enter a valid target amount'); return null }
    if (!form.name.trim())            { setError('Goal name is required');        return null }
    const safeCurrentRaw = isNaN(current) || current < 0 ? 0 : current
    return {
      name:     form.name.trim(),
      emoji:    form.emoji || '◈',
      target,
      current:  safeCurrentRaw,
      deadline: form.deadline,
      category: form.category,
      progress: Math.min(100, Math.round((safeCurrentRaw / target) * 100)),
    }
  }

  // ── Add ───────────────────────────────────────────────────────────────────
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const payload = buildPayload()
    if (!payload) return
    setSaving(true); setError('')
    try {
      await addGoal(user.uid, payload)
      toast(t('goals.createGoal'), 'success')
      closeAdd()
    } catch { setError('Failed to save') }
    finally { setSaving(false) }
  }

  // ── Edit (full) ───────────────────────────────────────────────────────────
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !editGoal) return
    const payload = buildPayload()
    if (!payload) return
    setSaving(true); setError('')
    try {
      await updateGoal(user.uid, editGoal.id, payload)
      toast('Goal updated', 'success')
      closeEdit()
    } catch { setError('Failed to save') }
    finally { setSaving(false) }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!user) return
    setDeletingId(id)
    try {
      await deleteGoal(user.uid, id)
      toast('Goal deleted', 'info')
    } finally { setDeletingId(null) }
  }

  // ── Deposit ───────────────────────────────────────────────────────────────
  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !depositGoal) return
    const amt = parseFloat(depositAmt)
    if (isNaN(amt) || amt <= 0) return
    setDepositing(true)
    try {
      const newCurrent = depositGoal.current + amt
      await Promise.all([
        addTransaction(user.uid, {
          merchant: `Deposit — ${depositGoal.name}`,
          category: 'Investment',
          amount:   -amt,
          date:     new Date().toISOString().slice(0, 10),
          status:   'completed',
          note:     `Goal deposit: ${depositGoal.name}`,
        }),
        updateGoal(user.uid, depositGoal.id, { current: newCurrent }),
      ])
      toast(`${fmt(amt)} added to ${depositGoal.name}`, 'success')
      setDepositGoal(null)
      setDepositAmt('')
    } catch { toast('Failed to deposit', 'error') }
    finally { setDepositing(false) }
  }

  return (
    <section className={styles.section} id="goals">
      <FadeReveal variant="rise">
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <span className={styles.sectionTag}>{t('sec.goals.tag')}</span>
            <h2 className={styles.sectionTitle}>{t('sec.goals.title')}</h2>
          </div>
          {user && (
            <button className={styles.addBtn} onClick={() => setAddOpen(true)}>
              <span>＋</span> {t('goals.add')}
            </button>
          )}
        </div>
      </FadeReveal>

      {goals.length === 0 ? (
        <FadeReveal variant="rise" delay={0.1}>
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>◈</span>
            <span className={styles.emptyText}>{t('goals.none')}</span>
            <span className={styles.emptySubtext}>{t('goals.noneSub')}</span>
            {user && (
              <button className={styles.emptyAction} onClick={() => setAddOpen(true)}>
                {t('goals.setFirst')}
              </button>
            )}
          </div>
        </FadeReveal>
      ) : (
        <StaggerReveal stagger={0.08} delay={0.1}>
          <div className={styles.grid}>
            {goals.map((goal) => {
              const remaining  = formatDistanceToNow(parseISO(goal.deadline), { addSuffix: false })
              const colorClass = CATEGORY_PROGRESS_COLOR[goal.category] ?? styles.colorWealth
              const isDeleting = deletingId === goal.id

              return (
                <StaggerItem key={goal.id}>
                  <div className={`${styles.card} ${isDeleting ? styles.cardDeleting : ''}`}>
                    <div className={styles.cardTop}>
                      <div className={styles.emojiArea}>
                        <span className={styles.emoji}>{goal.emoji}</span>
                        <div className={styles.goalInfo}>
                          <span className={styles.goalName}>{goal.name}</span>
                          <span className={styles.goalCategory}>{goal.category}</span>
                        </div>
                      </div>
                      <div className={styles.cardActions}>
                        <span className={styles.progressPercent}>{goal.progress}%</span>
                        {user && (
                          <>
                            <button
                              className={styles.editBtn}
                              onClick={() => openEdit(goal)}
                              title="Edit goal"
                              aria-label="Edit goal"
                            >
                              ✎
                            </button>
                            <button
                              className={styles.deleteCardBtn}
                              onClick={() => handleDelete(goal.id)}
                              title="Delete goal"
                              aria-label="Delete goal"
                            >
                              ✕
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className={styles.progressSection}>
                      <div className={styles.progressTrack}>
                        <div
                          className={`${styles.progressFill} ${colorClass}`}
                          style={{ width: `${goal.progress}%` }}
                        />
                      </div>
                      <div className={styles.progressAmounts}>
                        <span className={styles.amountCurrent}>{fmt(goal.current, true)}</span>
                        <span className={styles.amountTarget}>/ {fmt(goal.target, true)}</span>
                      </div>
                    </div>

                    <div className={styles.deadline}>
                      <span className={styles.deadlineIcon}>◷</span>
                      <span className={styles.deadlineText}>{t('goals.deadlineLabel')}</span>
                      <span className={styles.deadlineRemaining}>{remaining}</span>
                    </div>

                    {user && goal.progress < 100 && (
                      <button
                        className={styles.depositBtn}
                        onClick={() => { setDepositGoal(goal); setDepositAmt('') }}
                        title={t('goals.deposit')}
                      >
                        ＋ {t('goals.deposit')}
                      </button>
                    )}
                  </div>
                </StaggerItem>
              )
            })}
          </div>
        </StaggerReveal>
      )}

      {/* ── Deposit Drawer ─────────────────────────────────────────── */}
      <Drawer
        isOpen={!!depositGoal}
        onClose={() => { setDepositGoal(null); setDepositAmt('') }}
        title={`${t('goals.depositTo')} ${depositGoal?.name ?? ''}`}
      >
        {depositGoal && (
          <form onSubmit={handleDeposit}>
            <p className="form-section-title">
              {t('goals.current2')}: {fmt(depositGoal.current)} / {fmt(depositGoal.target)}
            </p>
            <div className="form-field">
              <label className="form-label">{t('goals.amountDeposit')}</label>
              <input
                className="form-input"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={depositAmt}
                onChange={(e) => setDepositAmt(e.target.value)}
                required
                autoFocus
              />
            </div>
            <button className="form-submit" type="submit" disabled={depositing}>
              {depositing ? t('common.saving') : t('goals.addDeposit')}
            </button>
          </form>
        )}
      </Drawer>

      {/* ── Add Goal Drawer ────────────────────────────────────────── */}
      <Drawer isOpen={addOpen} onClose={closeAdd} title={t('goals.newTitle')}>
        <form onSubmit={handleAddSubmit}>
          <GoalFormFields form={form} onChange={set} autoFocus />
          {error && <p className="form-error">{error}</p>}
          <button className="form-submit" type="submit" disabled={saving}>
            {saving ? t('common.saving') : t('goals.createGoal')}
          </button>
        </form>
      </Drawer>

      {/* ── Edit Goal Drawer ───────────────────────────────────────── */}
      <Drawer isOpen={!!editGoal} onClose={closeEdit} title={t('goals.editTitle')}>
        {editGoal && (
          <form onSubmit={handleEditSubmit}>
            <GoalFormFields form={form} onChange={set} autoFocus={false} />
            {error && <p className="form-error">{error}</p>}
            <button className="form-submit" type="submit" disabled={saving}>
              {saving ? t('common.saving') : t('form.saveChanges')}
            </button>
          </form>
        )}
      </Drawer>
    </section>
  )
}

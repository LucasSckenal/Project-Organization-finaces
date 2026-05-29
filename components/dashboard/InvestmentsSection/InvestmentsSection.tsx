'use client'

import { useState } from 'react'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { FadeReveal, StaggerReveal, StaggerItem } from '@/components/motion/FadeReveal'
import { useInvestments } from '@/hooks/useFirestore'
import { addInvestment, deleteInvestment, updateInvestment } from '@/lib/firestore'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useCurrency } from '@/hooks/useCurrency'
import { useT } from '@/hooks/useT'
import { Drawer } from '@/components/ui/Drawer/Drawer'
import { authHeader } from '@/lib/authHeader'
import type { Investment } from '@/lib/types'
import styles from './InvestmentsSection.module.scss'

type InvType = 'ETF' | 'Crypto' | 'REIT' | 'Bonds' | 'Stock'
const INV_TYPES: InvType[] = ['ETF', 'Stock', 'Crypto', 'REIT', 'Bonds']
const ALLOCATION_COLORS = ['#4a7c59', '#6a9c7a', '#8b3a3a', '#c4a882', '#6b6560']

function SparkTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(13,11,9,0.9)', border: '1px solid rgba(255,249,240,0.07)',
      borderRadius: '6px', padding: '4px 8px', fontSize: '10px', color: '#f0ebe2',
    }}>
      ${payload[0].value.toLocaleString('en-US')}
    </div>
  )
}

const BLANK = { name: '', ticker: '', value: '', gain: '0', allocation: '0', type: 'ETF' as InvType, shares: '', costBasis: '' }

const TYPE_COLORS: Record<InvType, string> = {
  ETF: '#4a7c59', Stock: '#6a9c7a', Crypto: '#8b3a3a', REIT: '#c4a882', Bonds: '#6b6560',
}

export function InvestmentsSection() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { fmt } = useCurrency()
  const t = useT()
  const { investments } = useInvestments()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [form,       setForm]       = useState({ ...BLANK })
  const [saving,     setSaving]     = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error,      setError]      = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const avgGain      = investments.length > 0
    ? investments.reduce((s, i) => s + i.gain, 0) / investments.length : 0

  // How many positions support live price sync (have shares + costBasis)
  const syncable = investments.filter((i) => i.shares && i.costBasis)

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const shares     = parseFloat(form.shares)
    const costBasis  = parseFloat(form.costBasis)
    const hasShares  = !isNaN(shares) && shares > 0 && !isNaN(costBasis) && costBasis > 0
    // If shares+cost given, derive value; otherwise use the manual value field
    const value      = hasShares ? shares * costBasis : parseFloat(form.value)
    const gain       = parseFloat(form.gain)
    const allocation = parseFloat(form.allocation)
    if (isNaN(value) || value <= 0) return setError('Enter shares + cost, or a value')
    setSaving(true); setError('')
    try {
      await addInvestment(user.uid, {
        name:       form.name.trim(),
        ticker:     form.ticker.trim().toUpperCase(),
        value:      Math.round(value),
        gain:       isNaN(gain) ? 0 : gain,
        allocation: isNaN(allocation) ? 0 : allocation,
        sparkline:  [Math.round(value)],
        type:       form.type,
        color:      TYPE_COLORS[form.type],
        ...(hasShares ? { shares, costBasis } : {}),
      })
      setForm({ ...BLANK }); setDrawerOpen(false)
    } catch { setError('Failed to save') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!user) return
    setDeletingId(id)
    try { await deleteInvestment(user.uid, id) }
    finally { setDeletingId(null) }
  }

  // ── Refresh live prices ─────────────────────────────────────────────────────
  const handleRefresh = async () => {
    if (!user || syncable.length === 0) return
    setRefreshing(true)
    try {
      const tickers = Array.from(new Set(syncable.map((i) => i.ticker)))
      const res = await fetch('/api/quote', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body:    JSON.stringify({ tickers }),
      })
      if (!res.ok) throw new Error('quote failed')
      const { quotes } = await res.json() as { quotes: Record<string, { price: number }> }

      let updated = 0
      for (const inv of syncable) {
        const q = quotes[inv.ticker.toUpperCase()]
        if (!q || !inv.shares || !inv.costBasis) continue
        const newValue = Math.round(inv.shares * q.price)
        const newGain  = Math.round(((q.price - inv.costBasis) / inv.costBasis) * 1000) / 10
        const spark    = [...(inv.sparkline ?? []), newValue].slice(-12)
        await updateInvestment(user.uid, inv.id, {
          value:      newValue,
          gain:       newGain,
          sparkline:  spark,
          lastSynced: new Date().toISOString(),
        })
        updated++
      }
      toast(
        updated > 0 ? `Updated ${updated} position${updated !== 1 ? 's' : ''}` : 'No quotes found for your tickers',
        updated > 0 ? 'success' : 'info',
      )
    } catch {
      toast('Failed to fetch prices', 'error')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <section className={styles.section} id="invest">
      <FadeReveal variant="rise">
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <span className={styles.sectionTag}>{t('sec.inv.tag')}</span>
            <h2 className={styles.sectionTitle}>{t('sec.inv.title')}</h2>
          </div>
          <div className={styles.headerActions}>
            {user && syncable.length > 0 && (
              <button
                className={`${styles.refreshBtn} ${refreshing ? styles.refreshBtnSpinning : ''}`}
                onClick={handleRefresh}
                disabled={refreshing}
                title={t('inv.refresh')}
              >
                <span className={styles.refreshIcon}>⟳</span> {refreshing ? t('inv.syncing') : t('inv.refresh')}
              </button>
            )}
            {user && (
              <button className={styles.addBtn} onClick={() => setDrawerOpen(true)}>
                <span>＋</span> {t('inv.addPosition')}
              </button>
            )}
            <div className={styles.totalBadge}>
              {avgGain >= 0 ? '↑' : '↓'} {avgGain >= 0 ? '+' : ''}{avgGain.toFixed(1)}% avg
            </div>
          </div>
        </div>
      </FadeReveal>

      {investments.length === 0 ? (
        <FadeReveal variant="rise" delay={0.05}>
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>◈</span>
            <span className={styles.emptyText}>{t('inv.none')}</span>
            {user && (
              <button className={styles.emptyAction} onClick={() => setDrawerOpen(true)}>
                {t('inv.addFirst')}
              </button>
            )}
          </div>
        </FadeReveal>
      ) : (
        <>
          {/* Allocation bar */}
          <FadeReveal variant="mask" delay={0.05}>
            <div className={styles.allocationBar}>
              <span className={styles.allocationTitle}>{t('inv.allocation')}</span>
              <div className={styles.allocationTrack}>
                {investments.map((inv, i) => (
                  <div key={inv.id} className={styles.allocationSegment}
                    style={{ width: `${inv.allocation}%`, background: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length], opacity: 0.8 }} />
                ))}
              </div>
              <div className={styles.allocationLegend}>
                {investments.map((inv, i) => (
                  <div key={inv.id} className={styles.legendItem}>
                    <span className={styles.legendDot} style={{ background: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length] }} />
                    <span className={styles.legendText}>{inv.ticker} · {inv.allocation}%</span>
                  </div>
                ))}
              </div>
            </div>
          </FadeReveal>

          {/* Cards grid */}
          <StaggerReveal stagger={0.07} delay={0.1}>
            <div className={styles.grid}>
              {investments.map((inv, i) => {
                const isPos     = inv.gain >= 0
                const sparkData = inv.sparkline.map((v, j) => ({ v, i: j }))

                return (
                  <StaggerItem key={inv.id}>
                    <div className={`${styles.card} ${isPos ? styles.cardPositive : styles.cardNegative} ${deletingId === inv.id ? styles.cardDeleting : ''}`}>
                      <div className={styles.cardTop}>
                        <span className={styles.ticker}>
                          {inv.ticker}
                          {inv.shares && inv.costBasis && (
                            <span className={styles.liveDot} title={inv.lastSynced ? `Synced ${new Date(inv.lastSynced).toLocaleString()}` : 'Live price enabled'} />
                          )}
                        </span>
                        <div className={styles.cardActions}>
                          <span className={styles.typeBadge}>{inv.type}</span>
                          {user && (
                            <button className={styles.deleteCardBtn} onClick={() => handleDelete(inv.id)} title="Delete">✕</button>
                          )}
                        </div>
                      </div>

                      <div className={styles.name}>{inv.name}</div>
                      <div className={styles.value}>{fmt(inv.value, true)}</div>

                      <div className={`${styles.gain} ${isPos ? styles.gainPositive : styles.gainNegative}`}>
                        <span>{isPos ? '↑' : '↓'}</span>
                        <span>{isPos ? '+' : ''}{inv.gain}%</span>
                      </div>

                      <div className={styles.sparklineWrapper}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={sparkData}>
                            <defs>
                              <linearGradient id={'spark-' + inv.id} x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor={inv.color} stopOpacity={0.3} />
                                <stop offset="100%" stopColor={inv.color} stopOpacity={0.9} />
                              </linearGradient>
                            </defs>
                            <Line type="monotone" dataKey="v" stroke={'url(#spark-' + inv.id + ')'}
                              strokeWidth={1.5} dot={false} activeDot={{ r: 2, strokeWidth: 0, fill: inv.color }} />
                            <Tooltip content={<SparkTooltip />} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      <div className={styles.allocation}>
                        <span className={styles.allocationLabel}>Allocation</span>
                        <span className={styles.allocationValue}>{inv.allocation}%</span>
                      </div>
                    </div>
                  </StaggerItem>
                )
              })}
            </div>
          </StaggerReveal>
        </>
      )}

      {/* ── Add Investment Drawer ──────────────────────────────────── */}
      <Drawer isOpen={drawerOpen} onClose={() => { setDrawerOpen(false); setForm({ ...BLANK }); setError('') }} title={t('inv.newTitle')}>
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label">{t('inv.assetName')}</label>
            <input className="form-input" placeholder="e.g. S&P 500 Index" value={form.name}
              onChange={(e) => set('name', e.target.value)} required autoFocus />
          </div>
          <div className="form-field">
            <label className="form-label">{t('inv.ticker')}</label>
            <input className="form-input" placeholder="e.g. VOO" value={form.ticker}
              onChange={(e) => set('ticker', e.target.value)} required />
          </div>
          <div className="form-field">
            <label className="form-label">{t('form.type')}</label>
            <div className="form-toggle">
              {INV_TYPES.map((it) => (
                <button key={it} type="button"
                  className={'form-toggle-btn' + (form.type === it ? ' active-neutral' : '')}
                  onClick={() => set('type', it)}
                  style={{ flex: 'none', padding: '0 10px' }}>
                  {it}
                </button>
              ))}
            </div>
          </div>
          <p className="form-section-title">{t('inv.liveTracking')}</p>
          <p className={styles.formHint}>{t('inv.liveHint')}</p>
          <div className="form-field">
            <label className="form-label">{t('inv.shares')}</label>
            <input className="form-input" type="number" min="0" step="any" placeholder="e.g. 10"
              value={form.shares} onChange={(e) => set('shares', e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-label">{t('inv.avgCost')}</label>
            <input className="form-input" type="number" min="0" step="any" placeholder="e.g. 320.50"
              value={form.costBasis} onChange={(e) => set('costBasis', e.target.value)} />
          </div>

          <p className="form-section-title">{t('inv.orManual')}</p>
          <div className="form-field">
            <label className="form-label">{t('inv.currentValue')}</label>
            <input className="form-input" type="number" min="1" step="1" placeholder="0"
              value={form.value} onChange={(e) => set('value', e.target.value)}
              disabled={!!form.shares && !!form.costBasis} />
          </div>
          <div className="form-field">
            <label className="form-label">{t('inv.gainLoss')}</label>
            <input className="form-input" type="number" step="0.1" placeholder="12.4"
              value={form.gain} onChange={(e) => set('gain', e.target.value)}
              disabled={!!form.shares && !!form.costBasis} />
          </div>
          <div className="form-field">
            <label className="form-label">{t('inv.alloc')}</label>
            <input className="form-input" type="number" min="0" max="100" step="1" placeholder="25"
              value={form.allocation} onChange={(e) => set('allocation', e.target.value)} />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="form-submit" type="submit" disabled={saving}>
            {saving ? t('common.saving') : t('inv.addPosition')}
          </button>
        </form>
      </Drawer>
    </section>
  )
}

'use client'

import { useState, useRef, useCallback } from 'react'
import { Drawer } from '@/components/ui/Drawer/Drawer'
import { addTransaction } from '@/lib/firestore'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useT } from '@/hooks/useT'
import styles from './ImportDrawer.module.scss'

const CATEGORIES = [
  'Income', 'Housing', 'Groceries', 'Dining', 'Transport',
  'Subscriptions', 'Investment', 'Shopping', 'Utilities', 'Other',
]

// ── RFC-4180 CSV parser ───────────────────────────────────────────────────────
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  for (const line of lines) {
    if (!line.trim()) continue
    const row: string[] = []
    let cur = ''
    let inQuote = false

    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuote = !inQuote
      } else if (ch === ',' && !inQuote) {
        row.push(cur.trim()); cur = ''
      } else {
        cur += ch
      }
    }
    row.push(cur.trim())
    rows.push(row)
  }

  return rows
}

function parseDate(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slash) {
    const [, a, b, y] = slash
    // If first part > 12 it must be a day (DD/MM/YYYY), otherwise assume MM/DD/YYYY
    if (parseInt(a) > 12) return `${y}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`
    return `${y}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`
  }
  return null
}

function parseAmount(raw: string): number | null {
  let s = raw.replace(/[\s$€£¥R]/g, '').trim()
  if (!s) return null
  if (s.startsWith('(') && s.endsWith(')')) s = '-' + s.slice(1, -1)
  // Detect decimal separator: if last separator is comma → BR format
  const lastComma = s.lastIndexOf(',')
  const lastDot   = s.lastIndexOf('.')
  let n = s
  if (lastComma > lastDot) {
    n = s.replace(/\./g, '').replace(',', '.')
  } else {
    n = s.replace(/,/g, '')
  }
  const val = parseFloat(n)
  return isNaN(val) ? null : val
}

type ColKey = 'date' | 'merchant' | 'amount' | 'category' | 'note' | 'skip'

const HEADER_MAP: Record<string, ColKey> = {
  date: 'date', data: 'date', 'transaction date': 'date', 'post date': 'date',
  'value date': 'date', 'posted date': 'date', 'data lançamento': 'date',
  merchant: 'merchant', description: 'merchant', payee: 'merchant',
  name: 'merchant', memo: 'merchant', estabelecimento: 'merchant',
  descricao: 'merchant', 'descrição': 'merchant',
  amount: 'amount', valor: 'amount', debit: 'amount', credit: 'amount',
  value: 'amount', 'transaction amount': 'amount', 'valor (r$)': 'amount',
  category: 'category', categoria: 'category',
  note: 'note', notes: 'note', comment: 'note', observacao: 'note',
  status: 'skip', id: 'skip', 'transaction id': 'skip', type: 'skip',
}

function detectMapping(headers: string[]): ColKey[] {
  return headers.map((h) => HEADER_MAP[h.toLowerCase().trim()] ?? 'skip')
}

interface ParsedRow {
  idx:      number
  date:     string | null
  merchant: string
  amount:   number | null
  category: string
  note:     string | null
  valid:    boolean
}

function mapRow(raw: string[], mapping: ColKey[], idx: number): ParsedRow {
  let date: string | null = null
  let merchant = ''
  let amount: number | null = null
  let category = 'Other'
  let note: string | null = null

  raw.forEach((val, i) => {
    const key = mapping[i]
    if (!key || key === 'skip') return
    if (key === 'date')     date     = parseDate(val)
    if (key === 'merchant') merchant = val.trim()
    if (key === 'amount')   amount   = parseAmount(val)
    if (key === 'category') {
      const m = CATEGORIES.find((c) => c.toLowerCase() === val.toLowerCase())
      category = m ?? 'Other'
    }
    if (key === 'note') note = val.trim() || null
  })

  return { idx, date, merchant, amount, category, note, valid: !!date && !!merchant && amount !== null }
}

interface Props {
  isOpen:  boolean
  onClose: () => void
}

export function ImportDrawer({ isOpen, onClose }: Props) {
  const { user }  = useAuth()
  const { toast } = useToast()
  const t = useT()

  const [stage,    setStage]    = useState<'idle' | 'preview' | 'importing' | 'done'>('idle')
  const [rows,     setRows]     = useState<ParsedRow[]>([])
  const [total,    setTotal]    = useState(0)
  const [progress, setProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => { setStage('idle'); setRows([]); setTotal(0); setProgress(0) }

  const processFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast('Please upload a CSV file (.csv)', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const parsed = parseCSV(text)
      if (parsed.length < 2) { toast('CSV appears empty', 'error'); return }

      const headers  = parsed[0]
      const mapping  = detectMapping(headers)
      const dataRows = parsed.slice(1)
      const mapped   = dataRows
        .filter((r) => r.some((c) => c.trim()))
        .map((r, i) => mapRow(r, mapping, i))

      setRows(mapped)
      setTotal(mapped.filter((r) => r.valid).length)
      setStage('preview')
    }
    reader.readAsText(file, 'UTF-8')
  }, [toast])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleImport = async () => {
    if (!user) return
    const valid = rows.filter((r) => r.valid)
    setStage('importing'); setProgress(0)

    let done = 0
    for (const row of valid) {
      await addTransaction(user.uid, {
        merchant: row.merchant,
        category: row.category,
        amount:   row.amount!,
        date:     row.date!,
        status:   'completed',
        note:     row.note,
      })
      done++
      setProgress(Math.round((done / valid.length) * 100))
    }

    setStage('done')
    toast(`Imported ${valid.length} transaction${valid.length !== 1 ? 's' : ''}`, 'success')
  }

  const handleClose = () => { reset(); onClose() }

  const validRows   = rows.filter((r) => r.valid)
  const invalidRows = rows.filter((r) => !r.valid)

  return (
    <Drawer isOpen={isOpen} onClose={handleClose} title={t('imp.title')}>

      {/* ── Step 1: drop zone ─────────────────────────────────────── */}
      {stage === 'idle' && (
        <div className={styles.idle}>
          <div
            className={`${styles.dropZone} ${dragOver ? styles.dropZoneOver : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
          >
            <span className={styles.dropIcon}>↑</span>
            <p className={styles.dropTitle}>{t('imp.drop')}</p>
            <p className={styles.dropSub}>{t('imp.dropSub')}</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className={styles.fileInput}
              onChange={handleFile}
            />
          </div>

          <div className={styles.hint}>
            <p className={styles.hintTitle}>{t('imp.expected')}</p>
            <code className={styles.hintCode}>Date, Merchant, Category, Amount, Note</code>
            <p className={styles.hintNote}>{t('imp.expectedNote')}</p>
          </div>
        </div>
      )}

      {/* ── Step 2: preview ───────────────────────────────────────── */}
      {stage === 'preview' && (
        <div className={styles.preview}>
          <div className={styles.previewSummary}>
            <div className={`${styles.summaryChip} ${styles.summaryValid}`}>
              ✓ {validRows.length} {t('imp.ready')}
            </div>
            {invalidRows.length > 0 && (
              <div className={`${styles.summaryChip} ${styles.summaryInvalid}`}>
                ✕ {invalidRows.length} {t('imp.skipped')}
              </div>
            )}
          </div>

          {validRows.length === 0 ? (
            <div className={styles.noValid}>
              <p className={styles.noValidText}>{t('imp.noValid')}</p>
              <button className={styles.retryBtn} onClick={reset}>{t('imp.tryAnother')}</button>
            </div>
          ) : (
            <>
              <div className={styles.previewTable}>
                <div className={styles.previewHeader}>
                  <span>{t('tx.dateCol')}</span>
                  <span>{t('tx.merchantCol')}</span>
                  <span className={styles.colRight}>{t('tx.amountCol')}</span>
                </div>
                {validRows.slice(0, 8).map((row) => (
                  <div key={row.idx} className={styles.previewRow}>
                    <span className={styles.previewDate}>{row.date}</span>
                    <span className={styles.previewMerchant}>{row.merchant}</span>
                    <span className={`${styles.previewAmt} ${row.amount! > 0 ? styles.amtPos : styles.amtNeg}`}>
                      {row.amount! > 0 ? '+' : ''}{row.amount?.toFixed(2)}
                    </span>
                  </div>
                ))}
                {validRows.length > 8 && (
                  <div className={styles.previewMore}>+{validRows.length - 8} {t('imp.moreRows')}</div>
                )}
              </div>

              <div className={styles.previewActions}>
                <button className={styles.backBtn} onClick={reset}>← {t('imp.back')}</button>
                <button className={styles.importBtn} onClick={handleImport}>
                  {t('imp.importBtn')} {validRows.length} {validRows.length !== 1 ? t('imp.transactions') : t('imp.transaction')}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Step 3: importing ─────────────────────────────────────── */}
      {stage === 'importing' && (
        <div className={styles.importing}>
          <span className={styles.importingPct}>{progress}%</span>
          <p className={styles.importingText}>{t('imp.importing')}</p>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* ── Step 4: done ─────────────────────────────────────────── */}
      {stage === 'done' && (
        <div className={styles.done}>
          <span className={styles.doneIcon}>✓</span>
          <p className={styles.doneTitle}>{t('imp.complete')}</p>
          <p className={styles.doneSub}>
            {total} {total !== 1 ? t('imp.transactions') : t('imp.transaction')} {t('imp.added')}
          </p>
          <button className={styles.doneBtn} onClick={handleClose}>{t('common.done')}</button>
        </div>
      )}

    </Drawer>
  )
}

'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useChat, type PendingAction } from '@/hooks/useChat'
import { useTransactions, useBalances, useGoals, useInvestments, useBudgets, useAccounts } from '@/hooks/useFirestore'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useCurrency } from '@/hooks/useCurrency'
import { useT } from '@/hooks/useT'
import { addTransaction, addGoal, saveBudgets } from '@/lib/firestore'
import styles from './ChatPanel.module.scss'

// Human-readable summary of a proposed action
function describeAction(a: PendingAction, fmt: (n: number) => string): { title: string; detail: string } {
  if (a.name === 'add_transaction') {
    const type = (a.args.type as string) ?? 'expense'
    const amt  = Number(a.args.amount) || 0
    return {
      title:  `${type === 'income' ? 'Add income' : 'Add expense'}: ${a.args.merchant}`,
      detail: `${type === 'income' ? '+' : '−'}${fmt(amt)} · ${a.args.category}${a.args.date ? ` · ${a.args.date}` : ''}`,
    }
  }
  if (a.name === 'add_goal') {
    return {
      title:  `Create goal: ${a.args.name}`,
      detail: `Target ${fmt(Number(a.args.target) || 0)}${a.args.deadline ? ` by ${a.args.deadline}` : ''}`,
    }
  }
  if (a.name === 'set_budget') {
    return {
      title:  `Set ${a.args.category} budget`,
      detail: `Monthly limit ${fmt(Number(a.args.limit) || 0)}`,
    }
  }
  return { title: 'Action', detail: '' }
}

const SUGGESTION_KEYS = ['chat.s1', 'chat.s2', 'chat.s3', 'chat.s4']

interface Props {
  isOpen:  boolean
  onClose: () => void
}

export function ChatPanel({ isOpen, onClose }: Props) {
  const { messages, sendMessage, streaming, clearChat, setActionStatus } = useChat()
  const { transactions } = useTransactions()
  const { balances }     = useBalances()
  const { goals }        = useGoals()
  const { investments }  = useInvestments()
  const { budgets }      = useBudgets()
  const { accounts, totalBalance } = useAccounts()
  const { profile, user } = useAuth()
  const { toast }        = useToast()
  const { fmt }          = useCurrency()
  const t                = useT()

  const [input, setInput]   = useState('')
  const bottomRef           = useRef<HTMLDivElement>(null)
  const inputRef            = useRef<HTMLTextAreaElement>(null)
  const messagesRef         = useRef<HTMLDivElement>(null)

  // Build context from live Firestore data
  const context = {
    name:         profile?.name ?? user?.displayName ?? 'User',
    currency:     profile?.currency ?? 'USD',
    transactions: transactions.slice(0, 50).map((t) => ({
      date:     t.date,
      merchant: t.merchant,
      category: t.category,
      amount:   t.amount,
      note:     t.note,
    })),
    // Net worth is computed live: cash + investments + goal balances
    balances: (() => {
      const available = accounts.length > 0 ? totalBalance : (balances?.available || 0)
      const invested  = investments.reduce((s, i) => s + i.value, 0)
      const savings   = goals.reduce((s, g) => s + g.current, 0)
      return { total: available + invested + savings, available, invested, savings }
    })(),
    goals: goals.map((g) => ({
      name:     g.name,
      current:  g.current,
      target:   g.target,
      progress: g.progress,
      deadline: g.deadline,
    })),
  }

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 160)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  const handleSend = () => {
    if (!input.trim() || streaming) return
    sendMessage(input.trim(), context)
    setInput('')
  }

  // ── Execute a confirmed action via Firestore (authenticated client-side) ────
  const runAction = async (messageId: string, index: number, action: PendingAction) => {
    if (!user) return
    try {
      if (action.name === 'add_transaction') {
        const amt = Number(action.args.amount) || 0
        await addTransaction(user.uid, {
          merchant: String(action.args.merchant ?? 'Untitled'),
          category: String(action.args.category ?? 'Other'),
          amount:   (action.args.type === 'income' ? 1 : -1) * Math.abs(amt),
          date:     String(action.args.date ?? new Date().toISOString().slice(0, 10)),
          status:   'completed',
          note:     action.args.note ? String(action.args.note) : null,
        })
        toast('Transaction added', 'success')
      } else if (action.name === 'add_goal') {
        const target  = Number(action.args.target) || 0
        const current = Number(action.args.current) || 0
        await addGoal(user.uid, {
          name:     String(action.args.name ?? 'New Goal'),
          emoji:    '◈',
          target,
          current,
          deadline: String(action.args.deadline ?? new Date().toISOString().slice(0, 10)),
          category: (['Security', 'Travel', 'Wealth', 'Property'].includes(String(action.args.category))
                      ? action.args.category : 'Security') as 'Security' | 'Travel' | 'Wealth' | 'Property',
          progress: target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0,
        })
        toast('Goal created', 'success')
      } else if (action.name === 'set_budget') {
        const cat = String(action.args.category ?? '')
        const lim = Number(action.args.limit) || 0
        await saveBudgets(user.uid, { ...budgets, [cat]: lim })
        toast(`${cat} budget set`, 'success')
      }
      setActionStatus(messageId, index, 'done')
    } catch {
      toast('Could not apply that action', 'error')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Subtle backdrop on mobile */}
          <motion.div
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className={styles.panel}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Header */}
            <div className={styles.header}>
              <div className={styles.headerLeft}>
                <span className={styles.headerIcon}>✦</span>
                <div className={styles.headerTitles}>
                  <span className={styles.headerTitle}>Ma</span>
                  <span className={styles.headerSub}>{t('chat.assistant')}</span>
                </div>
              </div>
              <div className={styles.headerActions}>
                {messages.length > 0 && (
                  <button className={styles.iconBtn} onClick={clearChat} title={t('chat.clear')} aria-label={t('chat.clear')}>
                    ↺
                  </button>
                )}
                <button className={styles.iconBtn} onClick={onClose} aria-label="Close chat">
                  ✕
                </button>
              </div>
            </div>

            {/* Messages / Empty state */}
            <div className={styles.messages} ref={messagesRef}>
              {messages.length === 0 ? (
                <div className={styles.empty}>
                  <div className={styles.emptyGlyph}>✦</div>
                  <p className={styles.emptyTitle}>{t('chat.emptyTitle')}</p>
                  <p className={styles.emptySub}>{t('chat.emptySub')}</p>
                  <div className={styles.suggestions}>
                    {SUGGESTION_KEYS.map((key) => (
                      <button
                        key={key}
                        className={styles.suggestion}
                        onClick={() => sendMessage(t(key), context)}
                      >
                        {t(key)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`${styles.msg} ${msg.role === 'user' ? styles.msgUser : styles.msgAssistant}`}
                    >
                      {msg.role === 'assistant' && (
                        <span className={styles.msgIcon}>✦</span>
                      )}
                      <div className={styles.msgBubble}>
                        {msg.content
                          ? msg.content.split('\n').map((line, i) => (
                              <span key={i}>{line}{i < msg.content.split('\n').length - 1 && <br />}</span>
                            ))
                          : (
                            <span className={styles.typing}>
                              <span /><span /><span />
                            </span>
                          )
                        }

                        {/* Proposed actions — confirm to apply */}
                        {msg.actions && msg.actions.length > 0 && (
                          <div className={styles.actions}>
                            {msg.actions.map((a, i) => {
                              const { title, detail } = describeAction(a, fmt)
                              return (
                                <div key={i} className={`${styles.actionCard} ${a.status === 'done' ? styles.actionDone : ''} ${a.status === 'dismissed' ? styles.actionDismissed : ''}`}>
                                  <div className={styles.actionInfo}>
                                    <span className={styles.actionTitle}>{title}</span>
                                    <span className={styles.actionDetail}>{detail}</span>
                                  </div>
                                  {a.status === 'done' ? (
                                    <span className={styles.actionDoneTag}>✓ Done</span>
                                  ) : a.status === 'dismissed' ? (
                                    <span className={styles.actionDismissedTag}>{t('chat.dismissed')}</span>
                                  ) : (
                                    <div className={styles.actionBtns}>
                                      <button className={styles.actionConfirm} onClick={() => runAction(msg.id, i, a)}>
                                        {t('chat.confirm')}
                                      </button>
                                      <button className={styles.actionDismiss} onClick={() => setActionStatus(msg.id, i, 'dismissed')}>
                                        ✕
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} style={{ height: 1 }} />
                </>
              )}
            </div>

            {/* Input */}
            <div className={styles.inputArea}>
              <textarea
                ref={inputRef}
                className={styles.input}
                placeholder={t('chat.placeholder')}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={streaming}
                aria-label="Chat input"
              />
              <button
                className={styles.sendBtn}
                onClick={handleSend}
                disabled={!input.trim() || streaming}
                aria-label="Send message"
              >
                ↑
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

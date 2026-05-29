'use client'

import { useState, useCallback } from 'react'
import { authHeader } from '@/lib/authHeader'

export type ActionName = 'add_transaction' | 'add_goal' | 'set_budget'

export interface PendingAction {
  name:    ActionName
  args:    Record<string, unknown>
  status?: 'pending' | 'done' | 'dismissed'
}

export interface ChatMessage {
  id:        string
  role:      'user' | 'assistant'
  content:   string
  timestamp: Date
  actions?:  PendingAction[]
}

export interface ChatContext {
  name:         string
  currency:     string
  transactions: Array<{ date: string; merchant: string; category: string; amount: number; note?: string | null }>
  balances:     { total: number; available: number; invested: number; savings: number } | null
  goals:        Array<{ name: string; current: number; target: number; progress: number; deadline: string }>
}

export function useChat() {
  const [messages,  setMessages]  = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)

  const sendMessage = useCallback(async (text: string, context: ChatContext) => {
    if (!text.trim() || streaming) return

    const userMsg: ChatMessage = {
      id:        `u-${Date.now()}`,
      role:      'user',
      content:   text.trim(),
      timestamp: new Date(),
    }

    const assistantId = `a-${Date.now() + 1}`
    const assistantMsg: ChatMessage = {
      id:        assistantId,
      role:      'assistant',
      content:   '',
      timestamp: new Date(),
    }

    const history = [...messages, userMsg]
    setMessages([...history, assistantMsg])
    setStreaming(true)

    try {
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body:    JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          context,
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json()

      if (data.type === 'action' && Array.isArray(data.actions)) {
        const actions: PendingAction[] = data.actions.map(
          (a: { name: ActionName; args: Record<string, unknown> }) => ({ ...a, status: 'pending' as const }),
        )
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: data.message ?? 'Confirm to apply:', actions } : m,
          ),
        )
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: data.text ?? data.error ?? '…' } : m,
          ),
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `Something went wrong (${msg}). Please try again.` }
            : m,
        ),
      )
    } finally {
      setStreaming(false)
    }
  }, [messages, streaming])

  const clearChat = useCallback(() => setMessages([]), [])

  const setActionStatus = useCallback(
    (messageId: string, actionIndex: number, status: NonNullable<PendingAction['status']>) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId || !m.actions) return m
          const actions = m.actions.map((a, i) => (i === actionIndex ? { ...a, status } : a))
          return { ...m, actions }
        }),
      )
    },
    [],
  )

  return { messages, sendMessage, streaming, clearChat, setActionStatus }
}

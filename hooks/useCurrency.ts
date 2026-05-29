'use client'

import { useAuth } from '@/contexts/AuthContext'
import { getCurrencySymbol } from '@/lib/i18n'

// ── useCurrency ───────────────────────────────────────────────────────────────
// Returns formatting helpers that respect the user's profile currency.
// Falls back to USD / $ when not signed in.
export function useCurrency() {
  const { profile } = useAuth()
  const symbol = getCurrencySymbol(profile?.currency)
  const code   = profile?.currency ?? 'USD'

  // fmt — plain positive value, optional compact mode
  // e.g. fmt(1234) → "$1,234"  |  fmt(1234, true) → "$1.2k"
  const fmt = (n: number, compact = false): string => {
    const abs = Math.abs(n)
    if (compact) {
      if (abs >= 1_000_000) return symbol + (abs / 1_000_000).toFixed(1) + 'M'
      if (abs >= 1_000)     return symbol + (abs / 1_000).toFixed(1) + 'k'
      return symbol + abs.toLocaleString('en-US', { maximumFractionDigits: 0 })
    }
    return symbol + abs.toLocaleString('en-US', { maximumFractionDigits: 0 })
  }

  // fmtTx — for transaction rows: sign prefix, one decimal when compact
  // e.g. fmtTx(-1234) → "-$1.2k"  |  fmtTx(42) → "+$42"
  const fmtTx = (n: number): string => {
    const abs = Math.abs(n)
    const str = abs >= 1000
      ? symbol + (abs / 1000).toFixed(1) + 'k'
      : symbol + abs.toLocaleString('en-US')
    return n > 0 ? '+' + str : '-' + str
  }

  // fmtFull — exact two decimal places (for labels, inputs, etc.)
  // e.g. fmtFull(1234.5) → "$1,234.50"
  const fmtFull = (n: number): string =>
    symbol + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // fmtAxis — short label for chart Y-axes
  // e.g. fmtAxis(5000) → "$5k"
  const fmtAxis = (n: number): string => {
    const abs = Math.abs(n)
    if (abs >= 1_000_000) return symbol + (abs / 1_000_000).toFixed(0) + 'M'
    if (abs >= 1_000)     return symbol + (abs / 1_000).toFixed(0) + 'k'
    return symbol + abs.toFixed(0)
  }

  return { fmt, fmtTx, fmtFull, fmtAxis, symbol, code }
}

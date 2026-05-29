import { NextResponse } from 'next/server'
import { verifyRequest } from '@/lib/verifyAuth'

// ── Live quote endpoint ───────────────────────────────────────────────────────
// Uses Yahoo Finance's public chart endpoint (no API key, server-side to avoid CORS).
// For Brazilian tickers, suffix with .SA (e.g. PETR4.SA) — we auto-retry that.

interface Quote {
  ticker:        string
  price:         number
  previousClose: number
  changePercent: number
  currency:      string
}

async function fetchYahoo(symbol: string): Promise<Quote | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      // Cache for 60s to avoid hammering on repeated refreshes
      next: { revalidate: 60 },
    })
    if (!res.ok) return null

    const data   = await res.json()
    const result = data?.chart?.result?.[0]
    const meta   = result?.meta
    if (!meta?.regularMarketPrice) return null

    const price    = meta.regularMarketPrice as number
    const prevClose = (meta.chartPreviousClose ?? meta.previousClose ?? price) as number
    const changePct = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0

    return {
      ticker:        symbol,
      price,
      previousClose: prevClose,
      changePercent: Math.round(changePct * 100) / 100,
      currency:      meta.currency ?? 'USD',
    }
  } catch {
    return null
  }
}

// Try the raw ticker, then the .SA variant for BR stocks
async function resolveQuote(ticker: string): Promise<Quote | null> {
  const clean = ticker.trim().toUpperCase()
  if (!clean) return null
  const direct = await fetchYahoo(clean)
  if (direct) return { ...direct, ticker: clean }
  if (!clean.includes('.')) {
    const br = await fetchYahoo(`${clean}.SA`)
    if (br) return { ...br, ticker: clean }
  }
  return null
}

export async function POST(req: Request) {
  try {
    const authed = await verifyRequest(req)
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { tickers } = await req.json()
    if (!Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json({ error: 'No tickers provided' }, { status: 400 })
    }

    // Cap to avoid abuse
    const limited = tickers.slice(0, 30) as string[]
    const results = await Promise.all(limited.map((t) => resolveQuote(t)))

    const quotes: Record<string, Quote> = {}
    results.forEach((q) => { if (q) quotes[q.ticker] = q })

    return NextResponse.json({ quotes })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

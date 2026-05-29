import { NextResponse } from 'next/server'
import { verifyRequest } from '@/lib/verifyAuth'

// ── FX rate endpoint ──────────────────────────────────────────────────────────
// Uses frankfurter.app (free, ECB rates, no API key). Server-side to avoid CORS.

export async function GET(req: Request) {
  try {
    const authed = await verifyRequest(req)
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const from = (searchParams.get('from') ?? '').toUpperCase()
    const to   = (searchParams.get('to') ?? '').toUpperCase()

    if (!from || !to) {
      return NextResponse.json({ error: 'from and to are required' }, { status: 400 })
    }
    if (from === to) {
      return NextResponse.json({ rate: 1, from, to })
    }

    const res = await fetch(
      `https://api.frankfurter.app/latest?from=${from}&to=${to}`,
      { next: { revalidate: 3600 } },   // cache 1h
    )
    if (!res.ok) throw new Error('rate fetch failed')

    const data = await res.json()
    const rate = data?.rates?.[to]
    if (typeof rate !== 'number') {
      return NextResponse.json({ error: 'rate unavailable for this pair' }, { status: 502 })
    }

    return NextResponse.json({ rate, from, to, date: data.date })
  } catch {
    return NextResponse.json({ error: 'Could not fetch exchange rate' }, { status: 500 })
  }
}

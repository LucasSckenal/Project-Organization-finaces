'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { console.error('[Ma] Dashboard error:', error) }, [error])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh',
      background: '#1A1816', color: '#F2EFE9', gap: '16px', fontFamily: 'system-ui',
    }}>
      <span style={{ fontSize: '1.5rem', opacity: 0.25 }}>⚠</span>
      <p style={{ fontSize: '0.875rem', color: 'rgba(242,239,233,0.5)', letterSpacing: '0.04em' }}>
        Dashboard error
      </p>
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={reset}
          style={{
            height: '32px', padding: '0 16px', borderRadius: '4px',
            border: '1px solid rgba(242,239,233,0.12)', background: 'transparent',
            color: 'rgba(242,239,233,0.6)', fontSize: '0.75rem', cursor: 'pointer',
          }}
        >
          Try again
        </button>
        <Link
          href="/"
          style={{
            height: '32px', padding: '0 16px', borderRadius: '4px',
            border: '1px solid rgba(242,239,233,0.08)', background: 'transparent',
            color: 'rgba(242,239,233,0.35)', fontSize: '0.75rem', display: 'flex',
            alignItems: 'center', textDecoration: 'none',
          }}
        >
          Go home
        </Link>
      </div>
    </div>
  )
}

'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { console.error('[Ma] Global error:', error) }, [error])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh',
      background: '#1A1816', color: '#F2EFE9', gap: '16px', fontFamily: 'system-ui',
    }}>
      <span style={{ fontSize: '2rem', opacity: 0.25 }}>⚠</span>
      <p style={{ fontSize: '0.875rem', color: 'rgba(242,239,233,0.5)', letterSpacing: '0.04em' }}>
        Something went wrong
      </p>
      <button
        onClick={reset}
        style={{
          height: '32px', padding: '0 20px', borderRadius: '4px',
          border: '1px solid rgba(242,239,233,0.12)', background: 'transparent',
          color: 'rgba(242,239,233,0.6)', fontSize: '0.75rem', cursor: 'pointer',
          letterSpacing: '0.06em',
        }}
      >
        Try again
      </button>
    </div>
  )
}

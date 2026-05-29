'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/auth')
  }, [user, loading, router])

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1A1816',
        color: 'rgba(242,239,233,0.4)',
        fontFamily: 'var(--font-sans, Inter, sans-serif)',
        fontSize: '0.75rem',
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
      }}>
        Loading
      </div>
    )
  }

  if (!user) return null

  return <>{children}</>
}

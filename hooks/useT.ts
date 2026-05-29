'use client'

import { useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { translations, type Lang } from '@/lib/translations'

// useT — reactive translation hook. Reads the user's language from their profile.
// t(key) returns the translated string, falling back to English, then the key.
export function useT() {
  const { profile } = useAuth()
  const lang = (profile?.language ?? 'en') as Lang

  return useCallback(
    (key: string, fallback?: string): string => {
      const entry = translations[key]
      if (!entry) return fallback ?? key
      return entry[lang] ?? entry.en ?? fallback ?? key
    },
    [lang],
  )
}

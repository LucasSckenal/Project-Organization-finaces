'use client'

import { useState, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { OnboardingWizard } from './OnboardingWizard'

export function OnboardingGuard() {
  const { profile, loading } = useAuth()
  const [exiting,   setExiting]   = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // useRef locks the decision: once we decide to show, re-renders can't undo it.
  // Without this, any profile state change (onAuthStateChanged re-firing, etc.)
  // could flip profile.onboarded and make the wizard flash-disappear.
  const shouldShow = useRef<boolean | null>(null)

  // Set the decision exactly once, as soon as auth is resolved
  if (shouldShow.current === null && !loading && profile !== null) {
    shouldShow.current = profile.onboarded === false
  }

  if (loading || dismissed || shouldShow.current !== true) return null

  const handleComplete = () => {
    setExiting(true)
    setTimeout(() => setDismissed(true), 580)
  }

  return <OnboardingWizard exiting={exiting} onComplete={handleComplete} />
}

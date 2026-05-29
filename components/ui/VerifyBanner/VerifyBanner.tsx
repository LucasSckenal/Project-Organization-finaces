'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import styles from './VerifyBanner.module.scss'

export function VerifyBanner() {
  const { user, resendVerification } = useAuth()
  const { toast } = useToast()
  const [dismissed, setDismissed] = useState(false)
  const [sending,   setSending]   = useState(false)

  // Only for signed-in users whose email isn't verified (Google users are auto-verified)
  if (!user || user.emailVerified || dismissed) return null

  const handleResend = async () => {
    setSending(true)
    try {
      await resendVerification()
      toast('Verification email sent — check your inbox', 'success')
    } catch {
      toast('Could not send right now. Try again shortly.', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={styles.banner}>
      <span className={styles.icon}>✉</span>
      <span className={styles.text}>
        Verify your email to secure your account.
      </span>
      <div className={styles.actions}>
        <button className={styles.resendBtn} onClick={handleResend} disabled={sending}>
          {sending ? 'Sending…' : 'Resend email'}
        </button>
        <button className={styles.dismissBtn} onClick={() => setDismissed(true)} aria-label="Dismiss">
          ✕
        </button>
      </div>
    </div>
  )
}

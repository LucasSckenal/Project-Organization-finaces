'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useRouter } from 'next/navigation'
import { AmbientBackground } from '@/components/ui/AmbientBackground/AmbientBackground'
import { ease } from '@/lib/motion'
import styles from './AuthForm.module.scss'

type Mode = 'signin' | 'signup' | 'forgot'

const AUTH_ERRORS: Record<string, string> = {
  'auth/user-not-found':        'No account with that email.',
  'auth/wrong-password':        'Incorrect password.',
  'auth/invalid-credential':    'Invalid email or password.',
  'auth/email-already-in-use':  'Email already registered. Sign in instead.',
  'auth/weak-password':         'Password must be at least 6 characters.',
  'auth/invalid-email':         'Please enter a valid email address.',
  'auth/too-many-requests':     'Too many attempts. Try again later.',
  'auth/popup-closed-by-user':  'Sign-in window closed.',
  'auth/user-disabled':         'This account has been disabled.',
}

function parseError(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: string }).code
    return AUTH_ERRORS[code] ?? 'Something went wrong. Please try again.'
  }
  return 'Something went wrong. Please try again.'
}

// ── Shared logo block ─────────────────────────────────────────────────────────
function Logo() {
  return (
    <div className={styles.logoArea}>
      <span className={styles.logoKanji}>間</span>
      <span className={styles.logoTitle}>Ma Finance OS</span>
      <span className={styles.logoTagline}>Your financial reality, rendered.</span>
    </div>
  )
}

export function AuthForm() {
  const { signIn, signUp, signInGoogle } = useAuth()
  const { toast }                        = useToast()
  const router                           = useRouter()

  const [mode,       setMode]       = useState<Mode>('signin')
  const [name,       setName]       = useState('')
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [error,      setError]      = useState('')
  const [busy,       setBusy]       = useState(false)
  const [resetSent,  setResetSent]  = useState(false)

  const switchMode = (m: Mode) => {
    setMode(m)
    setError('')
    setResetSent(false)
    if (m !== 'signup') setName('')
  }

  // ── Sign in / sign up ─────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
        router.replace('/dashboard')
      } else {
        await signUp(email, password, name || email.split('@')[0])
        toast('Account created! Check your email to verify.', 'success')
        router.replace('/dashboard')
      }
    } catch (err) {
      setError(parseError(err))
    } finally {
      setBusy(false)
    }
  }

  // ── Password reset ────────────────────────────────────────────────────────
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setError('')
    setBusy(true)
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setResetSent(true)
    } catch (err) {
      setError(parseError(err))
    } finally {
      setBusy(false)
    }
  }

  // ── Google OAuth ──────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setError('')
    setBusy(true)
    try {
      await signInGoogle()
      router.replace('/dashboard')
    } catch (err) {
      setError(parseError(err))
    } finally {
      setBusy(false)
    }
  }

  // ── Forgot password view ──────────────────────────────────────────────────
  if (mode === 'forgot') {
    return (
      <div className={styles.page}>
        <AmbientBackground />
        <motion.div
          className={styles.wrap}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: ease.cinema }}
        >
          <Logo />

          <div className={styles.card}>
            <div className={styles.forgotHeader}>
              <button className={styles.backBtn} onClick={() => switchMode('signin')} type="button">
                ← Back
              </button>
              <span className={styles.forgotTitle}>Reset password</span>
            </div>

            {resetSent ? (
              <div className={styles.resetSent}>
                <span className={styles.resetIcon}>✉</span>
                <p className={styles.resetMsg}>
                  Check your inbox — we sent a reset link to <strong>{email}</strong>.
                </p>
                <button
                  className={styles.backLink}
                  onClick={() => switchMode('signin')}
                  type="button"
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleReset} className={styles.form}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="reset-email">Email</label>
                  <input
                    id="reset-email"
                    className={styles.input}
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                {error && (
                  <motion.p
                    className={styles.error}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {error}
                  </motion.p>
                )}

                <button
                  className={styles.submitBtn}
                  type="submit"
                  disabled={busy || !email.trim()}
                >
                  {busy ? '…' : 'Send reset link'}
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    )
  }

  // ── Normal sign in / sign up view ─────────────────────────────────────────
  return (
    <div className={styles.page}>
      <AmbientBackground />

      <motion.div
        className={styles.wrap}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: ease.cinema }}
      >
        <Logo />

        <div className={styles.card}>
          {/* Tabs */}
          <div className={styles.tabs}>
            {(['signin', 'signup'] as Mode[]).map((m) => (
              <button
                key={m}
                className={`${styles.tab} ${mode === m ? styles.tabActive : ''}`}
                onClick={() => switchMode(m)}
                type="button"
              >
                {m === 'signin' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            {/* Name field (signup only) */}
            <AnimatePresence mode="wait">
              {mode === 'signup' && (
                <motion.div
                  key="name"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: ease.settle }}
                  className={styles.fieldWrap}
                >
                  <label className={styles.label} htmlFor="name">Name</label>
                  <input
                    id="name"
                    className={styles.input}
                    type="text"
                    placeholder="Haruki"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">Email</label>
              <input
                id="email"
                className={styles.input}
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label className={styles.label} htmlFor="password">Password</label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    className={styles.forgotLink}
                    onClick={() => switchMode('forgot')}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                id="password"
                className={styles.input}
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            </div>

            {error && (
              <motion.p
                className={styles.error}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {error}
              </motion.p>
            )}

            <button
              className={styles.submitBtn}
              type="submit"
              disabled={busy}
            >
              {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className={styles.divider}>
            <span>or</span>
          </div>

          <button
            className={styles.googleBtn}
            type="button"
            onClick={handleGoogle}
            disabled={busy}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </div>
      </motion.div>
    </div>
  )
}

'use client'

import {
  createContext, useContext, useEffect, useState,
  type ReactNode,
} from 'react'
import {
  onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signInWithPopup,
  GoogleAuthProvider, signOut, updateProfile,
  sendEmailVerification,
  type User,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { createProfile, getProfile, updateUserPhoto, updateUserProfile } from '@/lib/firestore'
import { uploadAvatar } from '@/lib/storage'
import type { UserProfile } from '@/lib/types'
import type { CurrencyCode, LanguageCode } from '@/lib/i18n'

interface AuthContextValue {
  user:           User | null
  profile:        UserProfile | null
  loading:        boolean
  signIn:         (email: string, password: string) => Promise<void>
  signUp:         (email: string, password: string, name: string) => Promise<void>
  signInGoogle:   () => Promise<void>
  logOut:             () => Promise<void>
  updatePhoto:        (file: File) => Promise<void>
  updateSettings:     (data: { name?: string; currency?: CurrencyCode; language?: LanguageCode }) => Promise<void>
  resendVerification: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const googleProvider = new GoogleAuthProvider()

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        const p = await getProfile(u.uid)
        setProfile(p)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signUp = async (email: string, password: string, name: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName: name })
    await createProfile(cred.user.uid, name, email)
    sendEmailVerification(cred.user).catch(console.warn)
    // onAuthStateChanged already ran before createProfile finished → profile is null.
    // Force-fetch so the wizard + UI have the correct state immediately.
    const p = await getProfile(cred.user.uid)
    setProfile(p)
  }

  const signInGoogle = async () => {
    const cred     = await signInWithPopup(auth, googleProvider)
    const existing = await getProfile(cred.user.uid)
    if (!existing) {
      // New Google user — same race condition: onAuthStateChanged already ran.
      const name     = cred.user.displayName ?? 'User'
      const photoURL = cred.user.photoURL ?? null
      await createProfile(cred.user.uid, name, cred.user.email ?? '', photoURL)
      const p = await getProfile(cred.user.uid)
      setProfile(p)
    }
  }

  const logOut = async () => {
    await signOut(auth)
  }

  const updatePhoto = async (file: File) => {
    if (!user) return
    const url = await uploadAvatar(user.uid, file)
    await updateProfile(user, { photoURL: url })
    await updateUserPhoto(user.uid, url)
    setProfile((prev) => prev ? { ...prev, photoURL: url } : prev)
  }

  const updateSettings = async (data: { name?: string; currency?: CurrencyCode; language?: LanguageCode }) => {
    if (!user) return
    await updateUserProfile(user.uid, data)
    if (data.name) await updateProfile(user, { displayName: data.name })
    setProfile((prev) => prev ? { ...prev, ...data } : prev)
  }

  const resendVerification = async () => {
    if (!user) return
    await sendEmailVerification(user)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signInGoogle, logOut, updatePhoto, updateSettings, resendVerification }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useCategories } from '@/hooks/useFirestore'
import { useT } from '@/hooks/useT'
import { saveCustomCategories, exportAllData, convertAllAmounts } from '@/lib/firestore'
import { DEFAULT_CATEGORIES } from '@/lib/categories'
import { authHeader } from '@/lib/authHeader'
import { CURRENCIES, LANGUAGES } from '@/lib/i18n'
import type { CurrencyCode, LanguageCode } from '@/lib/i18n'
import styles from './ProfileSettings.module.scss'

export function ProfileSettings() {
  const { user, profile, updatePhoto, updateSettings, logOut } = useAuth()
  const { toast } = useToast()
  const { custom: customCategories } = useCategories()
  const t = useT()

  const displayName = profile?.name ?? user?.displayName ?? 'User'
  const email       = profile?.email ?? user?.email ?? ''
  const currency    = (profile?.currency ?? 'USD') as CurrencyCode
  const language    = (profile?.language ?? 'en')  as LanguageCode
  const photoURL    = profile?.photoURL ?? user?.photoURL ?? null
  const initial     = displayName[0]?.toUpperCase() ?? 'U'

  const [nameValue,   setNameValue]   = useState(displayName)
  const [nameSaving,  setNameSaving]  = useState(false)
  const [nameSaved,   setNameSaved]   = useState(false)
  const [activeCurrency, setActiveCurrency] = useState<CurrencyCode>(currency)
  const [activeLanguage, setActiveLanguage] = useState<LanguageCode>(language)
  const [uploading,   setUploading]   = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [catSaving,   setCatSaving]   = useState(false)
  const [exporting,   setExporting]   = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Full data export ────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (!user) return
    setExporting(true)
    try {
      const data = await exportAllData(user.uid)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `ma-finance-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast('Your data has been exported', 'success')
    } catch {
      toast('Export failed. Try again.', 'error')
    } finally {
      setExporting(false)
    }
  }

  // ── Custom category management ──────────────────────────────────────────────
  const handleAddCategory = async () => {
    const name = newCategory.trim()
    if (!user || !name) return
    const exists = [...DEFAULT_CATEGORIES, ...customCategories]
      .some((c) => c.toLowerCase() === name.toLowerCase())
    if (exists) { toast('That category already exists', 'info'); return }
    setCatSaving(true)
    try {
      await saveCustomCategories(user.uid, [...customCategories, name])
      toast(`Added "${name}"`, 'success')
      setNewCategory('')
    } catch { toast('Failed to add category', 'error') }
    finally { setCatSaving(false) }
  }

  const handleRemoveCategory = async (name: string) => {
    if (!user) return
    try {
      await saveCustomCategories(user.uid, customCategories.filter((c) => c !== name))
      toast(`Removed "${name}"`, 'info')
    } catch { toast('Failed to remove', 'error') }
  }

  const handleAvatarClick = () => fileInputRef.current?.click()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try { await updatePhoto(file) }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  // Currency change → ask whether to also convert existing amounts
  const [pendingCurrency, setPendingCurrency] = useState<CurrencyCode | null>(null)
  const [converting,      setConverting]      = useState(false)

  const handleCurrency = (code: CurrencyCode) => {
    if (code === activeCurrency) return
    setPendingCurrency(code)
  }

  const applyCurrency = async (convert: boolean) => {
    if (!pendingCurrency) return
    const from = activeCurrency
    const to   = pendingCurrency
    setConverting(true)
    try {
      if (convert && user) {
        const res = await fetch(`/api/fx?from=${from}&to=${to}`, { headers: await authHeader() })
        const data = await res.json()
        if (!res.ok || typeof data.rate !== 'number') throw new Error('rate')
        await convertAllAmounts(user.uid, data.rate)
        toast(`Converted amounts at ${data.rate.toFixed(4)} ${from}→${to}`, 'success')
      }
      await updateSettings({ currency: to })
      setActiveCurrency(to)
      if (!convert) toast('Currency symbol updated', 'info')
    } catch {
      toast('Could not convert. Symbol changed only.', 'error')
      await updateSettings({ currency: to })
      setActiveCurrency(to)
    } finally {
      setConverting(false)
      setPendingCurrency(null)
    }
  }

  const handleLanguage = async (code: LanguageCode) => {
    setActiveLanguage(code)
    await updateSettings({ language: code })
  }

  const handleSaveName = async () => {
    if (!nameValue.trim() || nameValue.trim() === displayName) return
    setNameSaving(true)
    try {
      await updateSettings({ name: nameValue.trim() })
      setNameSaved(true)
      setTimeout(() => setNameSaved(false), 2200)
    } finally { setNameSaving(false) }
  }

  return (
    <div className={styles.page}>

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <span className={styles.pageTag}>⚙ {t('settings.tag')}</span>
        <h1 className={styles.pageTitle}>{t('settings.title')}</h1>
      </div>

      {/* ── Two-column grid ───────────────────────────────────────────────── */}
      <div className={styles.grid}>

        {/* Left column — Profile + Account */}
        <div className={styles.col}>

          {/* Profile card */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{t('settings.profile')}</h2>
            <div className={styles.profileRow}>
              <button
                className={`${styles.avatar} ${uploading ? styles.avatarUploading : ''}`}
                onClick={handleAvatarClick}
                aria-label="Change profile photo"
                title="Change photo"
              >
                {photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoURL} alt={displayName} className={styles.avatarImg} />
                ) : (
                  <span className={styles.avatarInitial}>{uploading ? '…' : initial}</span>
                )}
                <span className={styles.avatarOverlay}>
                  <span className={styles.cameraIcon}>⊙</span>
                </span>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*"
                className={styles.fileInput} onChange={handleFileChange} />
              <div className={styles.profileMeta}>
                <div className={styles.profileName}>{displayName}</div>
                <div className={styles.profileEmail}>{email}</div>
                <div className={styles.profileSince}>
                  {t('settings.memberSince')} {profile?.createdAt
                    ? new Date(profile.createdAt).getFullYear()
                    : new Date().getFullYear()}
                </div>
              </div>
            </div>
          </section>

          {/* Account card */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{t('settings.account')}</h2>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>{t('settings.displayName')}</label>
              <div className={styles.inputRow}>
                <input
                  className={styles.input}
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName() }}
                  placeholder="Your name"
                  maxLength={64}
                />
                <motion.button
                  className={`${styles.saveBtn} ${nameSaved ? styles.saveBtnSaved : ''}`}
                  onClick={handleSaveName}
                  disabled={nameSaving || !nameValue.trim() || nameValue.trim() === displayName}
                  whileTap={{ scale: 0.97 }}
                >
                  {nameSaved ? `✓ ${t('common.save')}` : nameSaving ? '…' : t('common.save')}
                </motion.button>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>{t('settings.email')}</label>
              <input
                className={`${styles.input} ${styles.inputReadonly}`}
                value={email}
                readOnly
                tabIndex={-1}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>{t('settings.yourData')}</label>
              <button className={styles.exportBtn} onClick={handleExport} disabled={exporting}>
                <span>↓</span> {exporting ? t('settings.exporting') : t('settings.exportAll')}
              </button>
            </div>

            <div className={styles.dangerZone}>
              <button className={styles.signOutBtn} onClick={logOut}>
                <span>⏻</span> {t('settings.signOut')}
              </button>
            </div>
          </section>

        </div>{/* /left col */}

        {/* Right column — Preferences */}
        <div className={styles.col}>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{t('settings.preferences')}</h2>

            {/* Currency */}
            <div className={styles.prefGroup}>
              <div className={styles.prefHeader}>
                <span className={styles.prefLabel}>{t('settings.currency')}</span>
                <span className={styles.prefValue}>{activeCurrency}</span>
              </div>
              <div className={styles.toggleGrid}>
                {CURRENCIES.map((c) => (
                  <button
                    key={c.code}
                    className={`${styles.toggleBtn} ${activeCurrency === c.code ? styles.toggleBtnActive : ''}`}
                    onClick={() => handleCurrency(c.code as CurrencyCode)}
                  >
                    <span className={styles.toggleSymbol}>{c.symbol}</span>
                    <span className={styles.toggleCode}>{c.code}</span>
                  </button>
                ))}
              </div>

              {pendingCurrency ? (
                <div className={styles.convertPanel}>
                  <p className={styles.convertText}>
                    Switch to <strong>{pendingCurrency}</strong>. Convert all existing
                    amounts at today&apos;s rate, or just change the symbol?
                  </p>
                  <div className={styles.convertActions}>
                    <button
                      className={styles.convertPrimary}
                      onClick={() => applyCurrency(true)}
                      disabled={converting}
                    >
                      {converting ? 'Converting…' : 'Convert amounts'}
                    </button>
                    <button
                      className={styles.convertGhost}
                      onClick={() => applyCurrency(false)}
                      disabled={converting}
                    >
                      Symbol only
                    </button>
                    <button
                      className={styles.convertCancel}
                      onClick={() => setPendingCurrency(null)}
                      disabled={converting}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className={styles.prefNote}>{t('settings.currencyNote')}</p>
              )}
            </div>

            <div className={styles.prefDivider} />

            {/* Language */}
            <div className={styles.prefGroup}>
              <div className={styles.prefHeader}>
                <span className={styles.prefLabel}>{t('settings.language')}</span>
                <span className={styles.prefValue}>
                  {LANGUAGES.find((l) => l.code === activeLanguage)?.label ?? 'English'}
                </span>
              </div>
              <div className={styles.toggleRow}>
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    className={`${styles.toggleBtn} ${activeLanguage === l.code ? styles.toggleBtnActive : ''}`}
                    onClick={() => handleLanguage(l.code as LanguageCode)}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Categories card */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{t('settings.categories')}</h2>
            <p className={styles.cardSubtitle}>{t('settings.catSubtitle')}</p>

            <div className={styles.catChips}>
              {DEFAULT_CATEGORIES.map((c) => (
                <span key={c} className={`${styles.catChip} ${styles.catChipDefault}`}>{t(`cat.${c}`, c)}</span>
              ))}
              {customCategories.map((c) => (
                <span key={c} className={`${styles.catChip} ${styles.catChipCustom}`}>
                  {c}
                  <button
                    className={styles.catChipRemove}
                    onClick={() => handleRemoveCategory(c)}
                    aria-label={`Remove ${c}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>

            <div className={styles.inputRow}>
              <input
                className={styles.input}
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory() }}
                placeholder={t('settings.newCategory')}
                maxLength={24}
              />
              <button
                className={styles.saveBtn}
                onClick={handleAddCategory}
                disabled={catSaving || !newCategory.trim()}
              >
                {catSaving ? '…' : t('settings.addCat')}
              </button>
            </div>
          </section>

        </div>{/* /right col */}

      </div>{/* /grid */}
    </div>
  )
}

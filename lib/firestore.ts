// ─── Ma Finance OS — Firestore Service ───────────────────────────────────────
import {
  collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, orderBy, limit, where, onSnapshot, writeBatch,
  Timestamp, serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type {
  UserProfile, Transaction, Goal, Investment, Balances, MonthlyDataPoint,
  RecurringTransaction, RecurringFrequency, Account,
} from './types'

export const TRANSFER_CATEGORY = 'Transfer'

// ── Path helpers ──────────────────────────────────────────────────────────────
const userRef       = (uid: string) => doc(db, 'users', uid)
const txCol         = (uid: string) => collection(db, 'users', uid, 'transactions')
const goalsCol      = (uid: string) => collection(db, 'users', uid, 'goals')
const investCol     = (uid: string) => collection(db, 'users', uid, 'investments')
const balancesRef   = (uid: string) => doc(db, 'users', uid, 'meta', 'balances')
const budgetRef     = (uid: string) => doc(db, 'users', uid, 'meta', 'budget')
const categoriesRef = (uid: string) => doc(db, 'users', uid, 'meta', 'categories')
const monthlyCol    = (uid: string) => collection(db, 'users', uid, 'monthly')
const recurringCol  = (uid: string) => collection(db, 'users', uid, 'recurring')
const accountsCol   = (uid: string) => collection(db, 'users', uid, 'accounts')

// ── Profile ───────────────────────────────────────────────────────────────────
export async function createProfile(uid: string, name: string, email: string, photoURL: string | null = null) {
  await setDoc(userRef(uid), {
    uid,
    name,
    email,
    currency:   'USD',
    language:   'en',
    photoURL,
    createdAt:  serverTimestamp(),
    onboarded:  false,   // triggers onboarding wizard on first login
  })
}

export async function completeOnboarding(
  uid: string,
  currency: UserProfile['currency'],
) {
  await updateDoc(userRef(uid), { onboarded: true, currency })
}

export async function getProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(userRef(uid))
  if (!snap.exists()) return null
  const d = snap.data()
  return {
    uid:       d.uid,
    name:      d.name,
    email:     d.email,
    currency:  d.currency  ?? 'USD',
    language:  d.language  ?? 'en',
    photoURL:   d.photoURL  ?? null,
    createdAt:  (d.createdAt as Timestamp)?.toDate() ?? new Date(),
    onboarded:  d.onboarded as boolean | undefined,
  }
}

export async function updateUserPhoto(uid: string, photoURL: string) {
  await updateDoc(userRef(uid), { photoURL })
}

// ── Real-time subscriptions ───────────────────────────────────────────────────
export function subscribeTransactions(
  uid: string,
  cb: (data: Transaction[]) => void,
  txLimit = 50,
): Unsubscribe {
  const q = query(txCol(uid), orderBy('date', 'desc'), limit(txLimit))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction)))
  })
}

// All transactions ordered asc — used for monthly aggregation
// Bounded to last 13 months to keep Firestore reads reasonable
export function subscribeAllTransactions(
  uid: string,
  cb: (data: Transaction[]) => void,
): Unsubscribe {
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 13)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const q = query(txCol(uid), where('date', '>=', cutoffStr), orderBy('date', 'asc'))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction)))
  })
}

export function subscribeGoals(
  uid: string,
  cb: (data: Goal[]) => void,
): Unsubscribe {
  return onSnapshot(goalsCol(uid), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Goal)))
  })
}

export function subscribeInvestments(
  uid: string,
  cb: (data: Investment[]) => void,
): Unsubscribe {
  return onSnapshot(investCol(uid), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Investment)))
  })
}

export function subscribeBalances(
  uid: string,
  cb: (data: Balances | null) => void,
): Unsubscribe {
  return onSnapshot(balancesRef(uid), (snap) => {
    cb(snap.exists() ? (snap.data() as Balances) : null)
  })
}

export function subscribeMonthly(
  uid: string,
  cb: (data: MonthlyDataPoint[]) => void,
): Unsubscribe {
  const q = query(monthlyCol(uid), orderBy('order', 'asc'))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => d.data() as MonthlyDataPoint))
  })
}

// ── Writes ────────────────────────────────────────────────────────────────────
export async function addTransaction(uid: string, tx: Omit<Transaction, 'id'>) {
  const ref = doc(txCol(uid))
  await setDoc(ref, { ...tx, createdAt: serverTimestamp() })
  return ref.id
}

export async function updateGoalProgress(uid: string, goalId: string, current: number) {
  const ref = doc(goalsCol(uid), goalId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const target   = snap.data().target as number
  const progress = Math.min(100, Math.round((current / target) * 100))
  await updateDoc(ref, { current, progress })
}

export async function deleteTransaction(uid: string, txId: string) {
  await deleteDoc(doc(txCol(uid), txId))
}

export async function updateTransaction(
  uid: string,
  txId: string,
  data: Partial<Omit<Transaction, 'id'>>,
) {
  await updateDoc(doc(txCol(uid), txId), data as Record<string, unknown>)
}

export async function addGoal(uid: string, goal: Omit<Goal, 'id'>) {
  const ref = doc(goalsCol(uid))
  await setDoc(ref, goal)
  return ref.id
}

export async function updateGoal(uid: string, goalId: string, data: Partial<Omit<Goal, 'id'>>) {
  const current = data.current
  const target  = data.target
  if (current !== undefined && target !== undefined) {
    data.progress = Math.min(100, Math.round((current / target) * 100))
  }
  await updateDoc(doc(goalsCol(uid), goalId), data)
}

export async function deleteGoal(uid: string, goalId: string) {
  await deleteDoc(doc(goalsCol(uid), goalId))
}

export async function addInvestment(uid: string, inv: Omit<Investment, 'id'>) {
  const ref = doc(investCol(uid))
  await setDoc(ref, inv)
  return ref.id
}

export async function deleteInvestment(uid: string, invId: string) {
  await deleteDoc(doc(investCol(uid), invId))
}

export async function updateInvestment(
  uid: string,
  invId: string,
  data: Partial<Omit<Investment, 'id'>>,
) {
  await updateDoc(doc(investCol(uid), invId), data as Record<string, unknown>)
}

export async function setBalances(uid: string, data: Balances) {
  await setDoc(balancesRef(uid), data)
}

// Only persists the available-cash field — everything else is computed live
export async function setAvailableCash(uid: string, available: number) {
  await setDoc(balancesRef(uid), { available }, { merge: true })
}

export async function updateUserProfile(
  uid: string,
  data: Partial<Pick<UserProfile, 'name' | 'currency' | 'language'>>,
) {
  await updateDoc(userRef(uid), data as Record<string, unknown>)
}

// ── One-time FX conversion of all stored amounts ──────────────────────────────
// Multiplies every money field by `rate`. Used when the user switches currency
// and opts to convert existing values. Batched (Firestore 500-op limit).
export async function convertAllAmounts(uid: string, rate: number): Promise<number> {
  if (!rate || rate <= 0 || rate === 1) return 0
  const round = (n: number) => Math.round(n * rate * 100) / 100

  const [txSnap, goalsSnap, investSnap, accountsSnap, balancesSnap, budgetSnap] = await Promise.all([
    getDocs(txCol(uid)),
    getDocs(goalsCol(uid)),
    getDocs(investCol(uid)),
    getDocs(accountsCol(uid)),
    getDoc(balancesRef(uid)),
    getDoc(budgetRef(uid)),
  ])

  let batch = writeBatch(db)
  let ops = 0
  let converted = 0
  const flush = async () => { if (ops > 0) { await batch.commit(); batch = writeBatch(db); ops = 0 } }
  const bump  = async () => { ops++; converted++; if (ops >= 400) await flush() }

  for (const d of txSnap.docs) {
    const t = d.data()
    batch.update(d.ref, { amount: round(t.amount ?? 0) })
    await bump()
  }
  for (const d of goalsSnap.docs) {
    const g = d.data()
    batch.update(d.ref, { current: round(g.current ?? 0), target: round(g.target ?? 0) })
    await bump()
  }
  for (const d of investSnap.docs) {
    const i = d.data()
    const data: Record<string, unknown> = { value: round(i.value ?? 0) }
    if (typeof i.costBasis === 'number') data.costBasis = round(i.costBasis)
    if (Array.isArray(i.sparkline)) data.sparkline = i.sparkline.map((v: number) => round(v))
    batch.update(d.ref, data)
    await bump()
  }
  for (const d of accountsSnap.docs) {
    const a = d.data()
    batch.update(d.ref, { balance: round(a.balance ?? 0) })
    await bump()
  }
  if (balancesSnap.exists()) {
    const b = balancesSnap.data()
    batch.set(balancesRef(uid), {
      ...b,
      total:               round(b.total ?? 0),
      available:           round(b.available ?? 0),
      invested:            round(b.invested ?? 0),
      savings:             round(b.savings ?? 0),
      monthlyChangeAmount: round(b.monthlyChangeAmount ?? 0),
    }, { merge: true })
    await bump()
  }
  if (budgetSnap.exists()) {
    const b = budgetSnap.data() as Record<string, number>
    const conv: Record<string, number> = {}
    Object.entries(b).forEach(([k, v]) => { conv[k] = round(v) })
    batch.set(budgetRef(uid), conv)
    await bump()
  }

  await flush()
  return converted
}

// ── Budget ─────────────────────────────────────────────────────────────────────
export function subscribeBudgets(
  uid: string,
  cb: (data: Record<string, number>) => void,
): Unsubscribe {
  return onSnapshot(budgetRef(uid), (snap) => {
    cb(snap.exists() ? (snap.data() as Record<string, number>) : {})
  })
}

export async function saveBudgets(uid: string, budgets: Record<string, number>) {
  await setDoc(budgetRef(uid), budgets)
}

// ── Custom categories ──────────────────────────────────────────────────────────
export function subscribeCategories(
  uid: string,
  cb: (data: string[]) => void,
): Unsubscribe {
  return onSnapshot(categoriesRef(uid), (snap) => {
    const list = snap.exists() ? (snap.data().list as string[] | undefined) : undefined
    cb(Array.isArray(list) ? list : [])
  })
}

export async function saveCustomCategories(uid: string, list: string[]) {
  await setDoc(categoriesRef(uid), { list })
}

// ── Recurring transactions ─────────────────────────────────────────────────────
export function subscribeRecurring(
  uid: string,
  cb: (data: RecurringTransaction[]) => void,
): Unsubscribe {
  return onSnapshot(recurringCol(uid), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RecurringTransaction)))
  })
}

export async function addRecurring(
  uid: string,
  data: Omit<RecurringTransaction, 'id'>,
) {
  const ref = doc(recurringCol(uid))
  await setDoc(ref, data)
  return ref.id
}

export async function updateRecurring(
  uid: string,
  id: string,
  data: Partial<Omit<RecurringTransaction, 'id'>>,
) {
  await updateDoc(doc(recurringCol(uid), id), data as Record<string, unknown>)
}

export async function deleteRecurring(uid: string, id: string) {
  await deleteDoc(doc(recurringCol(uid), id))
}

// ── Process due recurrences — call once on login ───────────────────────────────
// Returns number of transactions created.
// Catches up ALL missed periods — if a monthly recurrence is 3 months overdue,
// it generates 3 transactions (one per missed cycle), not just one.
const MAX_CATCHUP = 120   // safety cap against runaway loops

export async function processDueRecurrences(uid: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10)
  const snap  = await getDocs(recurringCol(uid))
  let created = 0

  for (const d of snap.docs) {
    const rec = { id: d.id, ...d.data() } as RecurringTransaction
    if (!rec.active) continue

    let nextDue = rec.nextDue
    let iterations = 0

    // Generate every occurrence whose due date has already passed
    while (nextDue <= today && iterations < MAX_CATCHUP) {
      await addTransaction(uid, {
        merchant: rec.merchant,
        category: rec.category,
        amount:   rec.amount,
        date:     nextDue,
        status:   'completed',
        note:     rec.note ?? null,
      })
      nextDue = calcNextDue(nextDue, rec.frequency)
      created++
      iterations++
    }

    // Persist the advanced cursor once per recurrence
    if (iterations > 0) {
      await updateRecurring(uid, rec.id, { lastCreated: today, nextDue })
    }
  }

  return created
}

// ── Accounts ────────────────────────────────────────────────────────────────
export function subscribeAccounts(
  uid: string,
  cb: (data: Account[]) => void,
): Unsubscribe {
  return onSnapshot(accountsCol(uid), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Account)))
  })
}

export async function addAccount(uid: string, account: Omit<Account, 'id'>) {
  const ref = doc(accountsCol(uid))
  await setDoc(ref, { ...account, createdAt: serverTimestamp() })
  return ref.id
}

export async function updateAccount(uid: string, id: string, data: Partial<Omit<Account, 'id'>>) {
  await updateDoc(doc(accountsCol(uid), id), data as Record<string, unknown>)
}

export async function deleteAccount(uid: string, id: string) {
  await deleteDoc(doc(accountsCol(uid), id))
}

// Transfer between two accounts: adjusts balances + logs two neutral Transfer txs
export async function transferBetweenAccounts(
  uid: string,
  from: Account,
  to: Account,
  amount: number,
  date: string,
) {
  await Promise.all([
    updateAccount(uid, from.id, { balance: from.balance - amount }),
    updateAccount(uid, to.id,   { balance: to.balance + amount }),
    addTransaction(uid, {
      merchant: `Transfer → ${to.name}`,
      category: TRANSFER_CATEGORY,
      amount:   -Math.abs(amount),
      date,
      status:   'completed',
      note:     `Transfer to ${to.name}`,
      accountId: from.id,
    }),
    addTransaction(uid, {
      merchant: `Transfer ← ${from.name}`,
      category: TRANSFER_CATEGORY,
      amount:   Math.abs(amount),
      date,
      status:   'completed',
      note:     `Transfer from ${from.name}`,
      accountId: to.id,
    }),
  ])
}

// ── Full data export ────────────────────────────────────────────────────────
// Gathers everything under users/{uid} into a single JSON-serialisable object.
export async function exportAllData(uid: string): Promise<Record<string, unknown>> {
  const [
    profileSnap, txSnap, goalsSnap, investSnap,
    balancesSnap, budgetSnap, recurringSnap, categoriesSnap, accountsSnap,
  ] = await Promise.all([
    getDoc(userRef(uid)),
    getDocs(query(txCol(uid), orderBy('date', 'desc'))),
    getDocs(goalsCol(uid)),
    getDocs(investCol(uid)),
    getDoc(balancesRef(uid)),
    getDoc(budgetRef(uid)),
    getDocs(recurringCol(uid)),
    getDoc(categoriesRef(uid)),
    getDocs(accountsCol(uid)),
  ])

  const docsToArray = (snap: { docs: { id: string; data: () => Record<string, unknown> }[] }) =>
    snap.docs.map((d) => ({ id: d.id, ...d.data() }))

  return {
    exportedAt:   new Date().toISOString(),
    version:      1,
    profile:      profileSnap.exists() ? profileSnap.data() : null,
    transactions: docsToArray(txSnap),
    goals:        docsToArray(goalsSnap),
    investments:  docsToArray(investSnap),
    balances:     balancesSnap.exists() ? balancesSnap.data() : null,
    budgets:      budgetSnap.exists() ? budgetSnap.data() : {},
    recurring:    docsToArray(recurringSnap),
    categories:   categoriesSnap.exists() ? (categoriesSnap.data().list ?? []) : [],
    accounts:     docsToArray(accountsSnap),
  }
}

function calcNextDue(from: string, freq: RecurringFrequency): string {
  const d = new Date(from + 'T12:00:00Z')
  switch (freq) {
    case 'daily':     d.setUTCDate(d.getUTCDate() + 1);           break
    case 'weekly':    d.setUTCDate(d.getUTCDate() + 7);           break
    case 'biweekly':  d.setUTCDate(d.getUTCDate() + 14);          break
    case 'monthly':   d.setUTCMonth(d.getUTCMonth() + 1);         break
    case 'yearly':    d.setUTCFullYear(d.getUTCFullYear() + 1);   break
  }
  return d.toISOString().slice(0, 10)
}

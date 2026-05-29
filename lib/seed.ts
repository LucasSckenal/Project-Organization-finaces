// ─── Seed demo data for new users ────────────────────────────────────────────
import { doc, setDoc, writeBatch } from 'firebase/firestore'
import { db } from './firebase'
import {
  expenses, goals, investments, balances, monthlyData,
} from '@/data/mock'

export async function seedUserData(uid: string) {
  const batch = writeBatch(db)

  // Balances
  batch.set(doc(db, 'users', uid, 'meta', 'balances'), balances)

  // Transactions
  for (const tx of expenses) {
    batch.set(doc(db, 'users', uid, 'transactions', tx.id), tx)
  }

  // Goals
  for (const goal of goals) {
    batch.set(doc(db, 'users', uid, 'goals', goal.id), goal)
  }

  // Investments
  for (const inv of investments) {
    batch.set(doc(db, 'users', uid, 'investments', inv.id), inv)
  }

  // Monthly data (ordered by index)
  for (let i = 0; i < monthlyData.length; i++) {
    const point = monthlyData[i]
    batch.set(doc(db, 'users', uid, 'monthly', `${i}-${point.month}`), {
      ...point,
      order: i,
    })
  }

  await batch.commit()
}

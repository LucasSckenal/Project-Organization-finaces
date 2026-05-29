// ─── Ma Finance OS — Scheduled Cloud Functions ───────────────────────────────
// Server-side recurring transaction processing, independent of user login.
// Mirrors lib/firestore.ts processDueRecurrences but runs for ALL users daily.
//
// Requires the Firebase Blaze (pay-as-you-go) plan. See functions/README.md.

const { onSchedule } = require('firebase-functions/v2/scheduler')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')

initializeApp()
const db = getFirestore()

const MAX_CATCHUP = 120

function calcNextDue(from, freq) {
  const d = new Date(from + 'T12:00:00Z')
  switch (freq) {
    case 'daily':    d.setUTCDate(d.getUTCDate() + 1);          break
    case 'weekly':   d.setUTCDate(d.getUTCDate() + 7);          break
    case 'biweekly': d.setUTCDate(d.getUTCDate() + 14);         break
    case 'monthly':  d.setUTCMonth(d.getUTCMonth() + 1);        break
    case 'yearly':   d.setUTCFullYear(d.getUTCFullYear() + 1);  break
  }
  return d.toISOString().slice(0, 10)
}

async function processUser(uid, today) {
  const recSnap = await db.collection('users').doc(uid).collection('recurring').get()
  let created = 0

  for (const recDoc of recSnap.docs) {
    const rec = recDoc.data()
    if (!rec.active) continue

    let nextDue = rec.nextDue
    let iterations = 0
    const batch = db.batch()
    const txCol = db.collection('users').doc(uid).collection('transactions')

    while (nextDue <= today && iterations < MAX_CATCHUP) {
      batch.set(txCol.doc(), {
        merchant:  rec.merchant,
        category:  rec.category,
        amount:    rec.amount,
        date:      nextDue,
        status:    'completed',
        note:      rec.note ?? null,
        createdAt: FieldValue.serverTimestamp(),
        ...(rec.accountId ? { accountId: rec.accountId } : {}),
      })
      nextDue = calcNextDue(nextDue, rec.frequency)
      created++
      iterations++
    }

    if (iterations > 0) {
      batch.update(recDoc.ref, { lastCreated: today, nextDue })
      await batch.commit()
    }
  }

  return created
}

// Runs every day at 06:00 UTC
exports.processRecurrences = onSchedule(
  { schedule: 'every day 06:00', timeZone: 'UTC', region: 'us-central1' },
  async () => {
    const today = new Date().toISOString().slice(0, 10)
    const usersSnap = await db.collection('users').get()
    let total = 0
    for (const userDoc of usersSnap.docs) {
      total += await processUser(userDoc.id, today)
    }
    console.log(`processRecurrences: created ${total} transactions across ${usersSnap.size} users`)
  },
)

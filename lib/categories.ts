// ─── Ma Finance OS — Category system ─────────────────────────────────────────
// Default categories ship with the app; users can add custom ones (stored in
// Firestore at users/{uid}/meta/categories).

export const DEFAULT_CATEGORIES = [
  'Income', 'Housing', 'Groceries', 'Dining', 'Transport',
  'Subscriptions', 'Investment', 'Shopping', 'Utilities', 'Other',
] as const

// Categories that are NOT user expenses → excluded from budget planner
export const NON_BUDGET_CATEGORIES = ['Income', 'Investment', 'Other']

// Merge defaults with custom, de-duped, defaults first
export function mergeCategories(custom: string[]): string[] {
  const seen = new Set(DEFAULT_CATEGORIES.map((c) => c.toLowerCase()))
  const extra = custom.filter((c) => {
    const key = c.trim().toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
  return [...DEFAULT_CATEGORIES, ...extra]
}

// Budget-relevant categories (spending only) + custom
export function budgetCategories(custom: string[]): string[] {
  return mergeCategories(custom).filter((c) => !NON_BUDGET_CATEGORIES.includes(c))
}

// ─── Ma Finance OS — Firestore Types ─────────────────────────────────────────

export interface UserProfile {
  uid:        string
  name:       string
  email:      string
  currency:   'USD' | 'EUR' | 'BRL' | 'JPY' | 'GBP'
  language:   'en' | 'pt-BR'
  photoURL:   string | null
  createdAt:  Date
  onboarded?: boolean   // undefined = existing user, false = new user pre-wizard, true = done
}

export interface Transaction {
  id:         string
  merchant:   string
  category:   string
  amount:     number       // positive = income, negative = expense
  date:       string       // ISO 8601 date string "YYYY-MM-DD"
  status:     'completed' | 'pending'
  note:       string | null
  accountId?: string       // optional — which account this belongs to
}

export type AccountType = 'checking' | 'savings' | 'card' | 'cash' | 'investment'

export interface Account {
  id:        string
  name:      string
  type:      AccountType
  balance:   number        // current balance
  color:     string
  createdAt?: unknown
}

export interface Goal {
  id:        string
  name:      string
  emoji:     string
  current:   number
  target:    number
  deadline:  string       // ISO date string
  category:  'Security' | 'Travel' | 'Wealth' | 'Property'
  progress:  number       // 0–100
}

export interface Investment {
  id:         string
  name:       string
  ticker:     string
  value:      number
  gain:       number      // percentage
  allocation: number      // percentage
  sparkline:  number[]
  type:       'ETF' | 'Crypto' | 'REIT' | 'Bonds' | 'Stock'
  color:      string
  shares?:    number      // optional — enables live price recompute
  costBasis?: number      // optional — avg price paid per share
  lastSynced?: string     // ISO timestamp of last live-price refresh
}

export interface Balances {
  total:               number
  available:           number
  invested:            number
  savings:             number
  monthlyChange:       number   // percentage
  monthlyChangeAmount: number
}

export interface MonthlyDataPoint {
  month:    string
  income:   number
  expenses: number
  savings:  number
  balance:  number
}

export type RecurringFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'

export interface RecurringTransaction {
  id:          string
  merchant:    string
  category:    string
  amount:      number          // positive = income, negative = expense
  frequency:   RecurringFrequency
  startDate:   string          // ISO "YYYY-MM-DD" — first occurrence
  nextDue:     string          // ISO "YYYY-MM-DD" — next auto-creation date
  lastCreated: string | null   // ISO "YYYY-MM-DD" — last time a tx was created
  active:      boolean
  note:        string | null
}

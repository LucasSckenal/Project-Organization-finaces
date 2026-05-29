// ─── Ma Finance OS — i18n / localisation helpers ─────────────────────────────

export const CURRENCIES = [
  { code: 'USD', symbol: '$',  label: 'USD — US Dollar'        },
  { code: 'EUR', symbol: '€',  label: 'EUR — Euro'             },
  { code: 'BRL', symbol: 'R$', label: 'BRL — Real Brasileiro'  },
  { code: 'JPY', symbol: '¥',  label: 'JPY — Yen Japonês'      },
  { code: 'GBP', symbol: '£',  label: 'GBP — British Pound'    },
] as const

export const LANGUAGES = [
  { code: 'en',    label: 'English'         },
  { code: 'pt-BR', label: 'Português (BR)'  },
] as const

export type CurrencyCode = (typeof CURRENCIES)[number]['code']
export type LanguageCode  = (typeof LANGUAGES)[number]['code']

export function getCurrencySymbol(code: string | undefined): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? '$'
}

export function getCurrencyLabel(code: string | undefined): string {
  return CURRENCIES.find((c) => c.code === code)?.label ?? 'USD — US Dollar'
}

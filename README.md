# Ma Finance OS

A cinematic, Japanese-minimalist personal finance operating system.
Next.js 16 · React 19 · TypeScript · Firebase · Framer Motion · Recharts · Gemini AI.

## Features

- Dashboard with net worth, analytics, transactions, budgets, goals, investments
- Multi-account tracking with transfers
- Recurring transactions (with catch-up)
- AI assistant (Gemini) that can answer questions **and** take actions
- Live investment prices, CSV import/export, custom categories
- Proactive insights, reports, PWA (installable), i18n (EN + PT-BR)

---

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

---

## Deploy to Vercel

1. Push this repo to GitHub/GitLab.
2. On [vercel.com](https://vercel.com) → **New Project** → import the repo.
   Framework preset auto-detects **Next.js**. No build settings to change.
3. Add the **Environment Variables** (Project → Settings → Environment Variables)
   — copy the keys from `.env.example`:
   - `GEMINI_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
4. **Deploy.**

### After the first deploy

- In the **Firebase console → Authentication → Settings → Authorized domains**,
  add your Vercel domain (e.g. `your-app.vercel.app`) so Google sign-in works.

---

## Firebase setup (one-time)

Security rules live in this repo and deploy on the **free Spark plan**:

```bash
npm install -g firebase-tools
firebase login
firebase use --add          # pick your Firebase project, alias it "default"
firebase deploy --only firestore:rules,storage
```

- `firestore.rules` — each user can only read/write their own data.
- `storage.rules` — avatar uploads are owner-only, size/type checked.

### Optional: scheduled recurring transactions (requires Blaze plan)

The app already processes recurring transactions on login (with catch-up).
For server-side processing independent of login, deploy the Cloud Function:

```bash
cd functions && npm install && cd ..
firebase deploy --only functions
```

See `functions/README.md` for details.

---

## Architecture

- `app/` — routes: `/` (landing), `/dashboard`, `/auth`, `/budget`, `/reports`, `/profile`, `/api/*`
- `components/` — dashboard sections, UI, drawers, onboarding
- `lib/` — Firestore service, types, translations, auth verification, categories
- `hooks/` — Firestore subscriptions, currency, i18n (`useT`)
- `contexts/` — Auth, Theme, Sound, Toast
- `styles/` — SCSS tokens + mixins

API routes are protected by Firebase ID token verification (`lib/verifyAuth.ts`).

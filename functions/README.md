# Ma Finance OS — Cloud Functions

Server-side scheduled processing of recurring transactions, so they generate
even when the user never logs in.

## What's here

- `processRecurrences` — runs daily at 06:00 UTC, generates all due recurring
  transactions for every user (with catch-up for missed periods).

## Deploy (one-time setup)

Cloud Functions require the **Blaze (pay-as-you-go)** plan. The scheduler also
uses Cloud Scheduler + Pub/Sub (free tier covers a daily job).

```bash
# 1. Install the Firebase CLI if you don't have it
npm install -g firebase-tools

# 2. Log in
firebase login

# 3. From the project root, link your Firebase project
firebase use --add        # pick your project, alias it "default"

# 4. Install function deps
cd functions && npm install && cd ..

# 5. Deploy
firebase deploy --only functions
```

After deploy, the function appears under **Functions** in the Firebase console
and the schedule under **Cloud Scheduler**.

## Notes

- The client (`useProcessRecurrences`) still runs catch-up on login — the two
  are idempotent via the `nextDue` cursor, so running both is safe (whichever
  runs first advances the cursor; the other sees nothing due).
- Adjust the schedule/timezone in `index.js` (`onSchedule` options).

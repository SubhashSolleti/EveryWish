# EveryWish

Write one wish, choose the date and local time, and choose the places where it should arrive. For each place,
EveryWish sends it from your own WhatsApp when the clock there reaches your chosen time — midnight in India, midnight
in New York, midnight in California — and repeats it every year if you want.

## How it works

```
Next.js web app ──writes──▶ Postgres (Neon) ◀──reads/writes── worker (always on)
  wishes, preview,            wishes, deliveries,               precise timers, WhatsApp
  history, QR pairing         WhatsApp session                  (Baileys), retries, alerts
```

- **A wish is a rule** (`wishes`): message, recipient, local date + time, places, once/yearly. It never stores UTC.
- **A delivery is one send at one instant** (`deliveries`). `src/lib/schedule/plan.ts` turns a wish into deliveries
  using the IANA time zone database — daylight saving, date lines and Feb 29 are handled there. Places that reach the
  moment at the same instant (New York + Toronto) share one delivery, so nobody gets duplicate messages.
- **Never late.** The worker arms a timer for each delivery and sends it at the exact second. If it can't send within
  60 seconds (WhatsApp down, worker offline), the delivery is marked _missed_ and you're alerted — it is never sent late.
- **Checks ahead of time.** ~24h and ~1h before each delivery the worker checks that WhatsApp is linked and the number
  is on WhatsApp, and alerts you while there's still time to fix it.
- **Yearly wishes roll forward.** When this year's deliveries are done, next year's are scheduled automatically.
- **Edits** replace only deliveries that haven't been sent; sent/failed/missed history is kept.
- **Channels** implement `src/lib/channels/types.ts`; WhatsApp is the only one today.

## Setup

1. `npm install`
2. `cp .env.example .env.local` and fill it in:
   - `DATABASE_URL` — from the Neon console (Connection string, with `?sslmode=require`)
   - `APP_PASSWORD` — the password to open the app
   - `AUTH_SECRET`, `ENCRYPTION_KEY` — `openssl rand -base64 32` each
   - optional `RESEND_API_KEY` + `ALERT_EMAIL_TO` for email alerts
3. `npm run db:migrate`

No Neon yet? `npm run db:local` runs a local Postgres (PGlite, no Docker) — use the `DATABASE_URL` from `.env.example`.

## Run

```bash
npm run dev       # web app on http://localhost:3000
npm run worker    # the sender — must be running for wishes to go out
```

Open the app, go to **WhatsApp** (top right), click **Show QR code**, and scan it from your phone:
WhatsApp → Settings → Linked devices → Link a device.

To try everything without linking a phone, run `npm run worker:console` instead: messages are printed to the terminal.

## Deploy

Two processes sharing the same environment variables:

- **web:** `npm run build && npm start`
- **worker:** `npm run worker` — one instance only, always on (Railway, Fly.io, Render, a small VPS).
  Serverless/cron is not precise enough. A second worker exits immediately (Postgres advisory lock).

Run `npm run db:migrate` on each deploy that changes the schema (`npm run db:generate` after editing `schema.ts`).

## Good to know

- WhatsApp is linked through an **unofficial** client (Baileys), like WhatsApp Web. It's fine for personal volumes but
  not supported by WhatsApp. Open WhatsApp on your phone now and then — linked devices are dropped after ~14 days
  without the phone online. The app and email alerts warn you if it gets unlinked.
- The WhatsApp session is stored encrypted with `ENCRYPTION_KEY`; changing that key means re-scanning the QR code.

## Tests

`npm test` covers time zone planning (DST gaps/overlaps, date line, leap years, grouping), scheduling/editing/roll
forward, and the delivery engine (exact timing, retries, never-late, no double sends, pre-flight checks) against a real
Postgres (PGlite in memory).

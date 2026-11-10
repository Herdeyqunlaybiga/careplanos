# CarePlanOS

Voice-first care records, eMAR safety and CQC evidence for UK supported living.

This repository runs the **demo tenant**: fictional residents and staff only. Real resident data must not be entered until the DSPT, DPIA, Cyber Essentials Plus, clinical safety case (DCB0129) and penetration test are complete.

## Architecture

- React + TypeScript + Tailwind, built with Vite, hosted as a static site on Render.
- Supabase (London, eu-west-2) for auth, the event ledger and realtime sync.
- Every action is an event submitted through `submit_event`, a security-definer RPC that:
  - checks the signed-in user's role (workers cannot sign, approve, escalate or reset),
  - stamps the real author from the server (client-supplied names are overwritten),
  - rejects back-dated or future-dated actions (clock skew over 5 minutes),
  - verifies shared-handset PINs against bcrypt hashes and strips the PIN before storage, with lockout after 5 failures,
  - enforces PRN rules server-side (interval, 24-hour maximum, paracetamol across products, weight-based limit),
  - appends to an append-only, SHA-256 hash-chained ledger (updates and deletes are blocked by trigger and privilege).
- Row Level Security: signed-in members read their own tenant only. Anonymous users read nothing.
- Private tables (PIN hashes, PRN rules, invites) live in a schema the API never exposes.

## Environment

Copy `.env.example` to `.env.local` for local work. Only the Supabase URL and **publishable** key go in the frontend. Never put a service-role or secret key in this repo or in Render.

## Local development

```
npm ci
npm run dev
```

## Deploy

Render reads `render.yaml` (static site, SPA rewrite, security headers, custom domain `app.careplanos.io`). Set `VITE_SUPABASE_PUBLISHABLE_KEY` in Render when prompted.

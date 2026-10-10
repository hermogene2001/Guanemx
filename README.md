# GuanemX V1

This workspace includes a standalone `GuanemX V1 prototype.html`, which serves as a visual and product reference. It contains simulated client-side behavior and is not production infrastructure. The application in `src/` is the Next.js, TypeScript, PostgreSQL and Prisma implementation for V1. It does not yet implement production authentication email delivery, payments, market data, or wallet-payout operations. The landing chart is explicitly an illustrative preview and is not live market data.

## Local setup

1. Install Node.js 20 or later and PostgreSQL.
2. Copy `.env.example` to `.env` and set a unique `AUTH_SECRET`, `CRON_SECRET`, and a local `DATABASE_URL`.
3. Run `npm install`.
4. Run `npm run db:generate` and `npm run db:migrate`.
5. (Optional) Run `npm run db:seed`. The seed is idempotent and never fabricates robots, plans, balances, or performance data: it ensures the General community room exists and optionally promotes a registered account to `ADMIN` when `SEED_ADMIN_EMAIL` is set.
6. Run `npm run dev`.

No payment provider is selected. Funds must not be accepted until a provider is selected and the payment/webhook flow is implemented and reviewed for the deployment jurisdictions. Withdrawal approvals record accounting only; actual payouts are performed manually outside GuanemX.

## Health gates

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint .
npm test            # vitest run (unit tests, no database)
npm run test:integration  # vitest run against a real Postgres test database
npx prisma validate # schema validation (needs DATABASE_URL in env)
```

`npm test` runs the unit suites in `src/lib/*.test.ts` (no database needed).

`npm run test:integration` runs the DB-backed suites in `test/integration/` against a dedicated
PostgreSQL database named `guanemx_test`. It derives the test URL from `DATABASE_URL` in `.env`,
refuses to run against any database that is not `guanemx_test` (override with `TEST_DATABASE_URL`),
resets that database with `prisma migrate reset --force --skip-seed`, and writes the resolved URL to
`test/.env.test` (gitignored) for the test workers. The suites exercise the recharge, withdrawal, and
payout-destination routes end to end: 31 tests covering requests, idempotency, agent reviews,
referral bonuses, daily limits, refunds, and account-number encryption.

CI (`.github/workflows/ci.yml`) runs generate, validate, typecheck, lint and unit tests on Node 20, 22
and 24, plus an integration job (Node 22) that applies migrations to a Postgres service container and
runs `npm run test:integration`.

> Windows note: if PowerShell blocks the `npm.ps1` shim (execution policy), run commands through `cmd /c "npm run …"` or use the `npm.cmd` shim.

## Data model

Prisma models cover users and database-backed sessions, login rate-limit buckets, verification tokens, robots and database-priced plans, subscriptions, wallets, immutable ledger entries, transactions, payments, withdrawals, recharges, payout destinations, audit logs, and community rooms/messages. Money uses PostgreSQL `DECIMAL(18,2)` values. Ledger and transaction records are related with restrictive deletion rules. The schema is a baseline and needs migrations and operational review before production.

## Implemented in this foundation

- Public landing page with the prototype's navy, slate, and gold visual language (dark/light/system themes).
- Sign-up/sign-in with database sessions, origin checks, secure HTTP-only session cookies, and database-backed rate limits.
- Robot marketplace and detail pages (tier filters, search, plan selection) — subscription checkout is intentionally disabled.
- Account services: wallet and ledger, manual recharge requests, withdrawal requests, payout destination setup (AES-256-GCM encrypted account numbers), transactions, profile, password change, and a General community room.
- Manual recharge: a request assigns an active agent; an agent confirmation credits the Main Balance and writes the deposit transaction and ledger entry atomically. Optional configurable referral bonus on confirmed recharges.
- Manual withdrawals: gross amount reserved at request time, 10% fee, one per Kigali calendar day; an agent can approve (records net payout + fee for manual payment) or reject (returns the gross amount).
- Email verification and password reset: single-use, hashed verification tokens; `/api/auth/verify-email`, `/api/auth/forgot-password` (no account enumeration), and `/api/auth/reset-password` (revokes all sessions). Registration issues a verify-email token. Mail delivery is pluggable (`MAIL_DRIVER=log` for development; `smtp` fails loudly until configured).
- Agent operations: review queues for assigned recharge and withdrawal requests; every decision is audited.
- Administration: platform overview with audit trail, robot catalog management (create/update/status/plans), and agent access management.

## Intended server route boundaries

| Area | Route family |
| --- | --- |
| Authentication | `/api/auth/*` |
| Users and profile | `/api/users/*` |
| Robots and plans | `/api/robots/*` |
| Subscriptions | `/api/subscriptions/*` |
| Wallet and ledger | `/api/wallet/*` |
| Provider payments | `/api/payments/*` |
| Withdrawals | `/api/withdrawals/*` |
| Transactions | `/api/transactions/*` |
| Community | `/api/chat/*` |
| Administration | `/api/admin/*` |
| Market view | `/api/market/*` |
| Scheduled jobs | `/api/cron/*` |

Authorization and business rules belong in server-side services, never in client visibility alone. Future money-moving services must use database transactions, decimal arithmetic, and idempotency keys. Provider credentials and production secrets belong in deployment secret storage, never in source control.

## Not implemented yet (known gaps)

- Email verification and password-reset **UI pages** (`/verify-email`, `/reset-password`) — the API contract, tokens, and `MAIL_DRIVER=log` delivery exist, but no mail provider (SMTP) is integrated yet and account access is not blocked on verification, so existing accounts stay usable.
- Subscription checkout: `Subscription` and `Payment` models exist but nothing creates them; the robot page's Subscribe action is disabled.
- Payment provider and market-data provider integrations/webhooks; the market page only reports configuration state.
- Scheduled jobs: no `/api/cron/*` routes for subscription expiry or stuck-session/withdrawal cleanup.
- Community moderation (reporting, soft-delete admin actions) beyond the schema fields.
- Full audit instrumentation coverage and structured observability beyond the current money flows (integration tests now cover recharge, withdrawal, and payout-destination flows — see "Health gates").

## Local bootstrap notes

There is no default agent account. Promote one trusted, registered account to administrator once through the local database (or set `SEED_ADMIN_EMAIL` and run `npm run db:seed`), then sign in and use **Agent management** to enable agents. For example:

```sql
UPDATE users
SET "role" = 'ADMIN', "status" = 'ACTIVE'
WHERE "email" = lower('admin@example.com');
```

Agents must have an active account and a phone number to receive recharge assignments. Use `/agent/requests` to review the assigned recharge and withdrawal queues. Admin and agent actions are recorded in `audit_logs`.

Referral bonus: set `REFERRAL_RECHARGE_BONUS_PERCENT` in the server environment to a value from `0` to `100` (default `0` disables it). When enabled, a confirmed recharge credits the referred client in full and separately credits the bonus to their inviter.

Payout destinations: keep `AUTH_SECRET` stable while `PAYOUT_ENCRYPTION_KEY` is not configured, or configure a stable random 32-byte base64url `PAYOUT_ENCRYPTION_KEY` before real payout details are saved. Changing the active encryption key makes existing destinations unreadable.

No data or performance values are seeded or represented as production information.
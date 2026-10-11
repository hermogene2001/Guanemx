# GuanemX V1

This workspace includes a standalone `GuanemX V1 prototype.html`, which serves as a visual and product reference. It contains simulated client-side behavior and is not production infrastructure. The application in `src/` is the Next.js, TypeScript, PostgreSQL and Prisma implementation for V1. The landing chart is illustrative, not live market data. Recharge and payout transfers remain manual, and no live market feed is connected.

## Local setup

1. Install Node.js 20 or later and PostgreSQL.
2. Copy `.env.example` to `.env` and set a unique `AUTH_SECRET`, `CRON_SECRET`, and a local `DATABASE_URL`.
3. Run `npm install`.
4. Run `npm run db:generate` and `npm run db:migrate`.
5. (Optional) Run `npm run db:seed`. The seed is idempotent and never fabricates robots, plans, balances, or performance data: it ensures the General community room exists and optionally promotes a registered account to `ADMIN` when `SEED_ADMIN_EMAIL` is set.
6. Run `npm run dev`.

No payment provider is selected. Recharge confirmation and withdrawal accounting are agent-operated; no provider currently receives or sends funds. Withdrawal approvals record accounting only; actual payouts are performed manually outside GuanemX. Email uses `MAIL_DRIVER=log` locally; production must configure `MAIL_DRIVER=resend` (`RESEND_API_KEY`, `MAIL_FROM`) or `MAIL_DRIVER=smtp` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`).

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
`test/.env.test` (gitignored) for the test workers. The 55 integration tests exercise the recharge,
withdrawal, payout-destination, subscription-checkout, platform-settings, and auth-verification flows end to end:
requests, idempotency/replay, agent reviews, referral bonuses, daily limits, refunds, account-number
encryption, wallet-funded checkout with ledger entries, subscription expiry/pruning, single-use
verification tokens, and password reset with session revocation.

CI (`.github/workflows/ci.yml`) runs generate, validate, typecheck, lint and unit tests on Node 20, 22
and 24, plus an integration job (Node 22) that applies migrations to a Postgres service container and
runs `npm run test:integration`.

> Windows note: if PowerShell blocks the `npm.ps1` shim (execution policy), run commands through `cmd /c "npm run …"` or use the `npm.cmd` shim.

## Data model

Prisma models cover users and database-backed sessions, login rate-limit buckets, verification tokens, robots and database-priced plans, subscriptions, wallets, immutable ledger entries, transactions, payments, withdrawals, recharges, payout destinations, audit logs, and community rooms/messages. Money uses PostgreSQL `DECIMAL(18,2)` values. Ledger and transaction records are related with restrictive deletion rules. The schema is a baseline and needs migrations and operational review before production.

## Implemented in this foundation

- Public landing page with the prototype's navy, slate, and gold visual language (dark/light/system themes).
- Sign-up/sign-in with database sessions, origin checks, secure HTTP-only session cookies, and database-backed rate limits.
- Robot marketplace and detail pages (tier filters, search, plan selection) with wallet-funded subscription checkout, immutable ledger entries, and idempotent requests.
- Account services: wallet and ledger, manual recharge requests, withdrawal requests, payout destination setup (AES-256-GCM encrypted account numbers), transactions, profile, password change, and a General community room.
- Manual recharge: a request assigns an active agent; an agent confirmation credits the Main Balance and writes the deposit transaction and ledger entry atomically. Optional referral bonus on confirmed recharges, configured under admin **Platform settings**.
- Manual withdrawals: gross amount reserved at request time, configurable fee (default 10%), one per Kigali calendar day; an agent can approve (records net payout + fee for manual payment) or reject (returns the gross amount).
- Email verification and password reset: single-use, hashed tokens; verification and reset pages; reset revokes all sessions; login requires an active account. Delivery supports development-only `MAIL_DRIVER=log`, the Resend API via `MAIL_DRIVER=resend`, and any SMTP server (e.g. Gmail with an app password) via `MAIL_DRIVER=smtp`.
- Robot daily earnings: each plan configures a daily return percentage, snapshotted onto subscriptions at checkout. Due daily credits are posted to Main Balance with a transaction and immutable ledger entry; the scheduler catches up missed due days while a subscription and robot are active. Each day is credited atomically and idempotently.
- Subscription lifecycle: subscriptions start immediately after successful checkout and expire after their selected plan duration. `/api/cron/subscriptions` processes due robot earnings before expiring subscriptions and removes expired sessions/tokens.
- Agent operations: review queues for assigned recharge and withdrawal requests; every decision is audited.
- Administration: platform overview, recent audit activity, robot catalog management, agent access management, report/soft-delete/restore tools for community messages, a 200-event audit page, and Platform settings for the USD exchange rate, fees, and minimum deposit/withdrawal amounts.
- Deposit and withdrawal requests enforce the administrator-configured minimum amounts (defaults: $3,000 and $1,000). Setting changes apply to new requests only.
- Currency: balances and transactions are stored and displayed in US dollars (`$`). Clients and agents also see the Rwandan-franc equivalent of an amount at the configured exchange rate, since recharges and payouts settle in local cash outside the app.

## Intended server route boundaries

| Area | Route family |
| --- | --- |
| Authentication | `/api/auth/*` |
| Users, profile, and robots | `/api/users/*` |
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

## Remaining production work

- Configure a verified Resend sender and secrets for production email. Local `log` mode prints links to the server terminal and does not deliver mail.
- Select and integrate a payment provider, then implement/review payment webhooks before automating recharge or payout. Current agent workflows are intentionally manual.
- Select an authorized market-data provider and add its API integration; the application currently shows no live prices.
- For robot credits, configure an external scheduler to call `POST /api/cron/subscriptions` (or `POST /api/cron/robot-earnings`) daily (ideally 00:00 UTC) using `Authorization: Bearer $CRON_SECRET`. The earnings job records run status, counts, and errors in `cron_job_runs`.
- Configure an external scheduler to call `POST /api/cron/subscriptions` with `Authorization: Bearer $CRON_SECRET` at least daily. The endpoint does not install its own scheduler.
- `GET /api/users/robots` returns the authenticated user's subscriptions, configured daily rate, total credited, days completed/remaining, and status. `/account/my-robots` displays this account-specific data.
- Daily credits use subscription price × snapshotted daily percentage, rounded to two decimal places. The first credit is due 24 hours after checkout, then once for each 24-hour period through the plan duration. Paused robots accrue nothing during the pause; due days may catch up after reactivation while the subscription remains active. A paused period does not extend subscription expiry. Existing plans/subscriptions migrated with a 0% default do not generate credits.
- Configured daily rates are not guaranteed returns. The implementation credits the configured amount as a product rule; it does not model trading performance, investment losses, or compound/Growth Balance maturity. Review this model legally, financially, and operationally before production.
- Add production deployment monitoring, database backup/restore procedures, and broader end-to-end review. Keep production credentials in the hosting provider's secret store.

## Local bootstrap notes

There is no default agent account. Promote one trusted, registered account to administrator once through the local database (or set `SEED_ADMIN_EMAIL` and run `npm run db:seed`), then sign in and use **Agent management** to enable agents. For example:

```sql
UPDATE users
SET "role" = 'ADMIN', "status" = 'ACTIVE'
WHERE "email" = lower('admin@example.com');
```

Agents must have an active account and a phone number to receive recharge assignments. Use `/agent/requests` to review the assigned recharge and withdrawal queues. Admin and agent actions are recorded in `audit_logs`.

Currency and rates: GuanemX stores and displays balances in US dollars (`$`). Administrators configure the exchange rate used for off-platform Rwandan-franc settlement and the withdrawal and referral fee percentages under **Platform settings** (`/admin/settings`). The `USD_TO_RWF_RATE` (default `1400`), `WITHDRAWAL_FEE_PERCENT` (default `10`), and `REFERRAL_RECHARGE_BONUS_PERCENT` (default `0`) environment variables supply the initial defaults until an administrator saves explicit values; once saved, the stored setting wins.

Payout destinations: keep `AUTH_SECRET` stable while `PAYOUT_ENCRYPTION_KEY` is not configured, or configure a stable random 32-byte base64url `PAYOUT_ENCRYPTION_KEY` before real payout details are saved. Changing the active encryption key makes existing destinations unreadable.

No data or performance values are seeded or represented as production information.

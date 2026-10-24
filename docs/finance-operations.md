# Recharge and withdrawal operations

## Robot subscriptions

Clients select an active robot plan from the marketplace and pay its displayed US-dollar price from Main Balance. Checkout creates an active subscription with a fixed start and expiry time, a completed subscription transaction, and a negative Main Balance ledger entry in one serializable database transaction. The API accepts an idempotency key so retrying the same request does not charge twice. Subscription checkout does not promise returns and does not credit earnings.

`POST /api/cron/subscriptions` expires subscriptions whose expiry time has passed and deletes expired verification tokens and sessions. Call it from a deployment scheduler at least daily with `Authorization: Bearer $CRON_SECRET`. The repository does not configure a scheduler.

## Recharge

Recharge requests are manually confirmed. The app chooses an active `AGENT` account that has a phone number, assigns the pending request to that agent, and shows the client the agent's contact details. Clients can use an agent-assisted transfer or select an enabled cryptocurrency destination configured in admin **Platform settings**. A crypto request snapshots the currency, network, and address, so later wallet edits do not change existing payment instructions. Creating a request does not change any wallet balance, and the app does not automatically verify blockchain transfers. An assigned agent confirms receipt from `/agent/requests`; confirmation credits the client's Main Balance and writes the recharge transaction and wallet-ledger entry in one database transaction. Rejection does not credit a balance.

## Withdrawals

Payout destinations are owned by the client. Account numbers are encrypted with AES-256-GCM before storage; the owner sees only the last four digits. Keep `AUTH_SECRET` stable while `PAYOUT_ENCRYPTION_KEY` is not configured, or configure a stable random 32-byte base64url `PAYOUT_ENCRYPTION_KEY` before real payout details are saved. Changing the active encryption key makes existing destinations unreadable.

The app reserves the gross amount immediately from the selected Main or Growth Balance. The fee is configurable in **Platform settings** (default 10%) and the request is limited to one per Kigali calendar day. An assigned agent can approve the net amount and fee for accounting, or reject and return the entire gross amount to its original balance. An approval does not send money; the actual payout is a separate manual operation outside the app.

## Agent setup

There is no default agent account. Promote one trusted, registered account to administrator once through the local database, then sign in and use **Agent management** to enable agents. For example, run this after replacing the email with the intended administrator's registered email:

```sql
UPDATE users
SET "role" = 'ADMIN', "status" = 'ACTIVE'
WHERE "email" = lower('admin@example.com');
```

Agents must have an active account and a phone number to receive recharge assignments. Use `/agent/requests` to review the assigned recharge and withdrawal queues. Admin and agent actions are recorded in `audit_logs`.

## Currency and rates

GuanemX stores and displays every balance and transaction in US dollars (`$`). Clients and agents also see the Rwandan-franc equivalent of an amount at the configured exchange rate, because agents settle recharges and payouts in local cash outside the app.

Administrators manage these values under **Platform settings** (`/admin/settings`):

- **USD → RWF rate**: how many Rwandan francs equal one dollar (default `1400`).
- **Withdrawal fee (%)**: deducted from each new withdrawal request (default `10`).
- **Referral bonus (%)**: credited to an inviter on a confirmed recharge (default `0`, disabled).

The `USD_TO_RWF_RATE`, `WITHDRAWAL_FEE_PERCENT`, and `REFERRAL_RECHARGE_BONUS_PERCENT` environment variables only supply the starting defaults when no administrator has saved values; once saved, the stored setting wins. Changing a rate or fee never rewrites already-recorded transactions, which keep the values captured when they were created.

## Referral bonus configuration

Set the referral bonus under **Platform settings** to a value from `0` to `100`. The default is `0`, which disables bonuses; the `REFERRAL_RECHARGE_BONUS_PERCENT` environment variable only supplies the initial default. When enabled, a confirmed recharge credits the referred client in full and separately credits the bonus to their inviter, with a transaction and ledger entry. New accounts may enter an invitation code during registration; each account's code appears on its Profile page.

## Provider setup

Payout Setup accepts a category and provider name because the deployment's supported bank and mobile-money provider list was not supplied. Configure the actual allowed providers and business controls before opening withdrawals to real users. Recharge transfers and withdrawal payouts are performed outside GuanemX; no payment provider integration is active in these flows.

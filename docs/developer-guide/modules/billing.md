# Billing & Subscription (Developer)

## Overview

Subscription/billing lives under `backend/src/modules/subscription/` with a school portal page at `/billing`.

Stripe checkout is **optional**. When `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` are unset, Pay Now stays hidden and schools can still use manual/offline billing flows.

## Environment

See [Environment Variables](../environment-variables.md) for Stripe keys.

## Conventions

- API responses use `{ data }` / `{ data, meta }`
- Branch/tenant isolation applies to invoices and entitlements
- Nav feature gates may hide modules based on plan entitlements

## Related internal notes

Historical implementation write-ups may exist under `docs/internal/implementation/` — treat the code + this page as authoritative when they conflict.

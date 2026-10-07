# 💳 Billing & Subscription

## Overview

Subscription/billing lives under `backend/src/modules/subscription/` with a school portal page at `/billing`.

Ops Alma (Reach) manages Enterprise **offers** via the inbound Admin Ops API under `backend/src/modules/admin/`. Offer columns (`enterprise_*`) never activate the plan; the school accepts in Billing and live terms are stored in `current_enterprise_*`.

Stripe checkout is **optional**. When `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` are unset, Pay Now stays hidden and schools can still use manual/offline billing flows.

## Environment

| Variable | Purpose |
| --- | --- |
| `STRIPE_*` | Optional checkout |
| `ADMIN_API_KEY` | Ops Alma `x-api-key` (Reach: `ALMA_PROD_ADMIN_API_KEY`) |

See [Environment Variables](../environment-variables.md).

Prod base URL Reach calls: `https://alma.ntgapps.com`.

## Admin Ops API (Reach)

All routes require `x-api-key: <ADMIN_API_KEY>` (401 bad key, 503 if unset).

| Method | Path |
| --- | --- |
| `GET` | `/api/v1/admin/tenants` |
| `GET` | `/api/v1/admin/tenants/:tenantId/subscription` |
| `PUT` | `/api/v1/admin/tenants/:tenantId/subscription/enterprise` |
| `DELETE` | `/api/v1/admin/tenants/:tenantId/subscription/enterprise` |
| `GET`/`PUT` | `/api/v1/admin/tenants/:tenantId/assessments-lock` |
| `DELETE` | `/api/v1/admin/tenants/:tenantId` |
| `GET` | `/api/v1/admin/logs` |

Enterprise PUT is a **full replace** of offer fields only. Limits: `branches`, `students`, `storageGb`. Paid add-ons: fees, library, behavioural, uniformInventory, whiteLabel, googleClassroom (+ monthly USD).

## Catalog (Nest source of truth)

Enforced limits: **branches, students, storageMB**.

Authoritative config: `backend/src/modules/subscription/plan-config.ts`.

## Conventions

- API responses use `{ data }` / `{ data, meta }`
- Live entitlements for Enterprise read **snapshot**, never pending offer
- Assessments creation lock is enforced on `POST /api/v1/assessments`
- `api_hits` interceptor records portal traffic for Ops logs

## Related internal notes

- `docs/subscription_module.md` — Resto → Alma offer model
- `docs/internal/plans/plan_subscription_update.md` — implementation plan decisions

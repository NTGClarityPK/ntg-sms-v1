# Alma — Subscription + Ops Enterprise Offers (from Resto)

Integration guide for bringing Resto’s **Enterprise offer / Ops Reach** model into Alma, on top of Alma’s existing Free → Starter → Pro → Enterprise + Stripe billing.

**Source of truth in Resto (verify against code, not older docs):**

| Area | Path |
| --- | --- |
| Reach API contract | `backend/src/modules/admin/ADMIN_REACH.md` |
| Offer upsert / clear (shared by API + CLI) | `backend/src/modules/admin/tenant-subscription.core.ts` |
| Plan change / snapshot / gating | `backend/src/modules/subscription/subscription.service.ts` |
| Plan catalog | `backend/src/modules/subscription/plan-config.ts` |
| Plan-change behaviour | `docs/developer/subscription-plan-changes.md` |
| Stripe webhooks | `backend/src/modules/subscription/subscription-webhook.service.ts` |
| Billing UI | `frontend/src/app/portal/billing/page.tsx` |
| Header tier pill / “New offer” | `frontend/src/components/layout/Header.tsx` |
| Subscription hook / cache | `frontend/src/lib/hooks/use-subscription.ts` |
| Plan transition helpers (client) | `frontend/src/lib/utils/subscription.ts` |
| Pulse animation CSS | `frontend/src/styles/globals.css` (`.new-offer-badge-pulse`) |
| Sidebar feature locks | `frontend/src/components/layout/Sidebar.tsx` |

---

## 0. What you already have vs what to add

### Keep from Alma (do not replace)

- One subscription per **school (tenant)**
- Plans: `free` \| `starter` \| `pro` \| `enterprise`
- Alma **limits**: branches, students, staff, classes (`-1` / unlimited as today)
- Alma **feature gates**: fees, library, behavioural, inventory (+ any others you already gate)
- Self-serve Starter/Pro pricing (per-student), upgrades via Stripe, downgrades at period end, usage-limit blocks
- Your existing cron / invoice / renewal logic if you are not moving to Stripe Subscription objects yet

### Add from Resto (the gap)

1. **Offer ≠ live plan** — Ops writes a pending Enterprise offer; tenant must accept in Billing before it becomes live.
2. **Dual column sets** — `enterprise_*` (offer) vs `current_enterprise_*` (accepted snapshot).
3. **Ops Alma (Reach)** — same admin API shape as Ops Resto: GET subscription, PUT full offer, DELETE pending offer (`force` for re-offer cancel).
4. **Tenant UX** — header “New offer”, Billing Enterprise card with Start Trial / Apply new terms / Subscribe.
5. **Paid trial + setup-fee watermark + optional deferred access** (if you want parity).
6. **Optional add-ons** on Starter/Pro (Resto pattern) — only if Alma product wants them; Enterprise folds negotiated extras into the offer, not separate Stripe line items.

### Demo-prompt corrections (important)

The brief you got from Resto is right on the **mental model**, but a few names do **not** exist in Resto’s schema today:

| Mentioned in demo brief | Actual Resto |
| --- | --- |
| `offer_kind` / `current_kind` (`trial` \| `subscription`) | No such columns. Trial vs paid subscription is `enterprise_paid_trial_enabled` (+ runtime `enterprise_in_paid_trial`) |
| `first_subscription_start_date` | Does not exist. Related watermarks: `trial_started_at` (one-time free-trial), `setup_fee_paid_usd` (lifetime setup paid) |
| Ops “activates” Enterprise | **Never.** PUT only writes offer columns |

Prefer implementing the **real Resto column model** below, not inventing `offer_kind` unless Alma consciously chooses a different design.

---

## 1. Core mental model

```text
Ops Alma (Reach)
  → PUT full Enterprise OFFER into enterprise_* columns
  → Does NOT set plan_id = enterprise
  → Does NOT touch current_enterprise_*

Tenant owner
  → Header shows pulsing “New offer” → /billing
  → Sees negotiated terms on Enterprise card
  → Accepts: Start Trial | Subscribe | Apply new terms
  → On accept: copy offer → current_enterprise_* + charge (if any) + set plan_id

Live entitlements
  → Always read current_enterprise_* (when snapshot exists)
  → Never read enterprise_* for gating after accept
```

| Layer | Who writes | Who reads | Meaning |
| --- | --- | --- | --- |
| **Offer** `enterprise_*` | Ops PUT / sales script | Billing plan card, checkout pricing, `offerChanged` | What sales just sent |
| **Live** `current_enterprise_*` (+ active `access_starts_at`) | Checkout / zero-cost apply / period-end apply | Feature gates, usage limits | What the school accepted |
| **Pending self-serve change** (Starter↔Pro) | Tenant Billing | Cron / Stripe EOC | Unrelated to Ops offers |

**Rule:** Offer ≠ active plan. A school can sit on Free/Starter/Pro with a pending Enterprise offer, or already be on Enterprise with a *new* offer waiting for accept (`offerChanged`).

---

## 2. Schema to add (Alma-adapted)

Assume Alma already has something like: `subscriptions` (one row per school), `subscription_usage`, `invoices`, Stripe ids, `pending_plan_id`, period fields, plan feature/limit config.

### 2.1 Columns — identity / billing (likely already present)

Keep Alma’s existing names where they differ; align semantics.

| Column | Notes |
| --- | --- |
| `id`, `tenant_id` (UNIQUE) | One sub per school |
| `plan_id` | `free` \| `starter` \| `pro` \| `enterprise` |
| `status` | Alma: `active` / `trial` / etc. as today |
| `billing_cycle` | `monthly` \| `yearly` |
| `pending_plan_id`, `pending_billing_cycle` | Self-serve downgrades |
| `current_period_start`, `current_period_end` | |
| Stripe customer / payment method fields | As today |

### 2.2 Columns — Enterprise OFFER (`enterprise_*`)

Written **only** by Ops PUT (or CLI). Full replace every time.

**Pricing / term**

| Column | Type | Alma meaning |
| --- | --- | --- |
| `enterprise_enabled` | boolean | Offer is visible / checkoutable |
| `enterprise_price` | numeric | Recurring contract price for the full `duration` (USD) — Resto uses **price for N months**, not necessarily “monthly” |
| `enterprise_duration_months` | int | Contract length in months |
| `enterprise_setup_fee` | numeric | One-time setup when paid trial is **off** |
| `enterprise_price_monthly` / `enterprise_price_yearly` | numeric nullable | **Legacy in Resto** — modern PUT clears them to null. Alma can skip or keep null |

**Limits (NULL = unlimited)** — map to Alma resources, not Resto’s:

| Resto column | Alma equivalent (suggested) |
| --- | --- |
| `enterprise_locations_limit` | `enterprise_branches_limit` |
| `enterprise_users_limit` | `enterprise_staff_limit` (and/or users) |
| `enterprise_counters_limit` | *(no Alma equivalent — omit, or map if you have a similar resource)* |
| `enterprise_orders_month_limit` | *(omit)* → use Alma caps: `enterprise_students_limit`, `enterprise_classes_limit` |

Suggested Alma offer limits:

```text
enterprise_branches_limit
enterprise_students_limit
enterprise_staff_limit
enterprise_classes_limit
```

**Features (NULL = product default for Enterprise)** — map to Alma modules:

| Resto | Alma equivalent (suggested) |
| --- | --- |
| `enterprise_callcenter_enabled` | `enterprise_fees_enabled` |
| `enterprise_kds_enabled` | `enterprise_library_enabled` |
| `enterprise_inventory_enabled` | `enterprise_inventory_enabled` (same idea) |
| — | `enterprise_behavioural_enabled` |
| `enterprise_support_enabled` | optional Alma add-on / “priority support” if you have one |
| `enterprise_web_ordering_enabled` | optional (e.g. parent portal extras, SMS pack) — only if product needs negotiable extras |

**Paid trial (offer config + runtime)**

| Column | Role |
| --- | --- |
| `enterprise_paid_trial_enabled` | Offer is a paid trial (UI: **Start Trial**) |
| `enterprise_paid_trial_duration_days` | Trial length; required when paid trial on |
| `enterprise_pre_trial_setup_fee` | Charged at Start Trial |
| `enterprise_post_trial_setup_fee` | Charged when they **Subscribe** after trial |
| `enterprise_in_paid_trial` | Runtime: currently in paid trial |

**Deferred access (optional parity)**

| Column | Role |
| --- | --- |
| `enterprise_access_starts_at` | Offer: prepaid access begins on this date (mutually exclusive with paid trial) |
| `access_starts_at` | Active: frozen at accept; block “create student / use product” until then if you want Resto-style deferred go-live |

### 2.3 Columns — LIVE snapshot (`current_enterprise_*`)

Written **only** when the tenant accepts (checkout success, zero-cost apply, or EOC apply). Cleared when leaving Enterprise.

Mirror every negotiated field:

```text
current_enterprise_price
current_enterprise_duration_months
current_enterprise_branches_limit
current_enterprise_students_limit
current_enterprise_staff_limit
current_enterprise_classes_limit
current_enterprise_fees_enabled
current_enterprise_library_enabled
current_enterprise_behavioural_enabled
current_enterprise_inventory_enabled
(+ any other negotiated feature flags)
```

**Entitlements rule**

- If `current_enterprise_price` is set (or a dedicated `hasActiveEnterpriseTerms` check) → limits/features come from **snapshot**.
- Else if `plan_id = enterprise` but **no** snapshot → treat as **not fully subscribed** (force Accept / Subscribe), do **not** silently inherit the offer.
- Plan card / Billing always shows **offer** values for what they can accept next.

### 2.4 Setup-fee watermark

| Column | Semantics |
| --- | --- |
| `setup_fee_paid_usd` | Lifetime cumulative setup already collected. Charge `max(0, list − paid)`. **Never decreases** on downgrade. Pre-trial and post-trial fees raise the same watermark. |

### 2.5 Optional Starter/Pro add-ons (Resto pattern)

Only if Alma product wants checkbox add-ons on self-serve plans:

| Column | Notes |
| --- | --- |
| `addon_<name>_enabled` | Live add-on flags |
| `pending_addon_<name>_enabled` | EOC pending |

On Enterprise, negotiated extras live in `enterprise_*` / `current_enterprise_*` and are **not** billed as separate line items — they are included in the negotiated price.

Resto add-ons today: Operations Support ($20/mo), Web Ordering ($20/mo + 1% disclosed but not billed yet). Alma should pick its own add-ons or skip this section.

### 2.6 Related tables

Keep Alma’s `subscription_usage` counters aligned with Alma limits (students_used, staff_used, branches_used, classes_used). Resto tracks branches/users/orders/menu_items — different domain, same idea.

---

## 3. Portal UI (same stack — port these surfaces into Alma)

Resto surfaces the Enterprise offer in **two places**. Both are driven by `useSubscription()` → `GET /subscription` (`enterprisePricing.*`). Alma should mirror this on `/billing` and the global app shell header.

```text
Ops PUT offer
    │
    ▼
Header tier pill  ──tenant owner──►  pulsing “NEW OFFER”  ──►  /portal/billing
                                        (else “UPGRADE”)
    │
    ▼
Billing page
    ├── Current plan card  →  blue pulsing “New offer” badge (next to plan name)
    └── Plan grid
            └── Enterprise card  →  negotiated price/limits/features + CTA
                    Start Trial | Select/Upgrade | Apply new terms | Subscribe | Contact sales
```

### 3.1 Where the offer appears (confirmed in code)

| Surface | File | Who sees it | What shows |
| --- | --- | --- | --- |
| **Top bar (header)** | `Header.tsx` | **Tenant owners only** (interactive). Other roles may see plan name read-only, **without** Upgrade/New offer action. | Pill: `★ {Plan}` \| sparkles + **NEW OFFER** (or **UPGRADE**) → links to `/portal/billing` |
| **Billing → Current plan card** | `billing/page.tsx` | Anyone who can open Billing | Pulsing blue Badge **“New offer”** beside “Current plan: …” |
| **Billing → Enterprise plan card** | same | Same | Full negotiated offer: price for N months, limits, feature ticks/crosses, setup/trial copy, primary CTA |

There is **no** separate “offers inbox”. The header is the discovery nudge; Billing is where acceptance happens.

### 3.2 Header tier pill (top bar) — detailed behaviour

**Location:** App shell header, right side (with branding / account actions). Class: `header-tier-plan-group`.

**Contents of the pill**

1. Star icon + current plan display name (Free / Starter / Pro / Enterprise)
2. If an action is shown: thin divider + sparkles icon + uppercase label

**When “New offer” vs “Upgrade”**

```ts
hasEnterpriseOffer =
  enterprisePricing.enabled &&
  (planId !== 'enterprise' || enterprisePricing.offerChanged)

planActionLabel = hasEnterpriseOffer ? 'New offer' : 'Upgrade'

showPlanAction =
  isTenantOwner &&
  subscription exists &&
  (hasEnterpriseOffer || planId !== 'enterprise')
```

| State | Owner sees | Non-owner sees |
| --- | --- | --- |
| Free/Starter/Pro, no offer | `★ Starter \| ✨ UPGRADE` (click → Billing) | `★ Starter` only (not a link) |
| Free/Starter/Pro, offer enabled | `★ Starter \| ✨ NEW OFFER` **with pulse** → Billing | Plan name only |
| Enterprise, offer unchanged | Plan name only (no Upgrade/New offer) | Plan name only |
| Enterprise, `offerChanged` | `★ Enterprise \| ✨ NEW OFFER` **with pulse** → Billing | Plan name only |

**Pulse:** CSS class `new-offer-badge-pulse` — soft opacity animation (~2.4s). Applied to sparkles + “NEW OFFER” text when `hasEnterpriseOffer`. Respects `prefers-reduced-motion`.

**Mobile:** Label is visually hidden; sparkles still pulse so the nudge remains.

**Alma mapping:** Same pill on school portal header; gate the *action* to **school admin** (Alma’s equivalent of `tenant_owner`). Teachers/staff keep feature gating only.

### 3.3 Billing page layout

Route: `/portal/billing` (Alma: keep your existing `/billing`).

Typical sections (top → bottom):

1. **Page title** “Billing” + refresh  
2. **Current plan card** — plan · cycle, status badge, period dates, pending-downgrade badge, **New offer badge**, trial/access alerts, Stripe portal / pay actions as today  
3. **Usage** — progress against limits (Resto: locations/users/…; Alma: students/staff/…)  
4. **Choose a plan** — cycle toggle (Monthly/Yearly) for self-serve; grid of **Free | Starter | Pro | Enterprise** cards  
5. **Invoices / billing history**

### 3.4 “New offer” on the Current plan card

Shown when:

```text
enterprisePricing.enabled
  AND (
    planId !== enterprise
    OR (on Enterprise AND not trial-expired AND offer differs —
        offerChanged OR access-start day differs OR duration differs)
  )
```

UI: Mantine `Badge` color `blue` variant `light` + `new-offer-badge-pulse`, label `billing.newOfferBadge` → **“New offer”**.

Also show status lines such as:

- Trial expired — subscribe to continue  
- Paid — access starts {date}  
- In paid trial  
- Active / Past due / Cancelled  

Large status badges on the right: `TRIAL EXPIRED`, `ACCESS PENDING`, `TRIAL`, `ACTIVE`, etc.

### 3.5 Enterprise plan card (the acceptance surface)

This is the **main** place Ops terms are shown and accepted. Card still renders even before the school is on Enterprise.

#### When the card is “self-serve enabled”

Offer is checkoutable when:

```text
enterprisePricing.enabled
  && price > 0
  && durationMonths > 0
```

Otherwise price shows **Custom** and CTA falls through to **contact sales** / Select outline (opens contact).

#### What the card displays (from **offer**, not live snapshot)

| Block | Source | Alma remapping |
| --- | --- | --- |
| Title | “Enterprise” | same |
| “Current” badge | Only if subscribed terms match offer (`noop` and not `offerChanged`) | same logic |
| Price | `enterprisePricing.price` + `/ {N} months` | same (negotiated contract) |
| Setup line | pre-trial / post-trial / regular setup (see CTA table) | same |
| Paid trial blurb | “N-day trial…” + optional post-trial setup | same |
| Deferred access note | “Pay full contract now. Access starts {date}.” | optional |
| **Limits** | `enterpriseOfferLimits` (offer) | branches, students, staff, classes |
| **Features list** | `enterpriseFeatures` with ✓ / ✗ | fees, library, behavioural, inventory (+ extras) |
| Optional add-ons | Starter/Pro only in Resto; Enterprise shows support/web as feature rows from offer | Alma: only if you have add-ons |
| Re-offer note | If `offerChanged`: *“Your Enterprise offer was updated. Your current limits and features stay in effect until you apply the new terms.”* | copy as-is |
| Primary button | See CTA matrix below | same labels |

**Critical UI rule:** Card advertises **offer** limits/features. Live entitlements elsewhere (sidebar, creates) still use **snapshot** until accept. Do not mark Enterprise as “Current” just because an offer exists — that blocked subscribe in an earlier Resto bug.

#### CTA matrix (Enterprise card button)

| Situation | Button label | Behaviour |
| --- | --- | --- |
| No configured offer (`!enabled` or no price) | Select / Contact sales | Opens contact (or Alma sales flow) |
| Offer on, not on Enterprise, paid trial **off** | **Select** / **Upgrade** | Checkout → activate + snapshot |
| Offer on, paid trial **on**, not started, not expired | **Start Trial** | Charge pre-trial setup only |
| Currently in paid trial | Card shows “In paid trial” badge; current-plan area explains end date | Usually no second accept CTA on card |
| Trial expired while on Enterprise | **Subscribe** | Post-trial setup + start paid term |
| On Enterprise, offer price **higher** | **Upgrade** (or Apply path) | Paid upgrade checkout |
| On Enterprise, offer price **lower** | **Downgrade** | Scheduled end-of-cycle |
| On Enterprise, same price but limits/features/access/duration changed (`offerChanged` + `noop`) | **Apply new terms** | Zero-cost apply → rewrite snapshot |
| Pending self-serve change matches this card | **Scheduled** (disabled) | Waiting for period end |
| Already current, offer matches | Disabled “Current” | No button (unless add-ons dirty on Starter/Pro) |

Helpers live in `getButtonInfo()` on the billing page (`startTrial`, `applyNewTerms`, `subscribeAfterTrial` i18n keys).

### 3.6 `offerChanged` (backend flag the UI depends on)

Expose on `GET /subscription` as `enterprisePricing.offerChanged`.

True when:

1. Active snapshot exists **and** any of price / duration / limits / feature flags / deferred access day differ from the offer; **or**
2. `plan_id = enterprise` but **no** snapshot, and offer has price + duration (force explicit accept — never silently inherit Ops edits).

Billing UI may also locally compare access-start day and duration so same-price re-offers still show **Apply new terms** even if only those fields moved.

### 3.7 Feature / limit UI outside Billing (unchanged pattern)

Not offer-specific, but part of the same module UX Alma already has:

| Place | Behaviour |
| --- | --- |
| Sidebar | Gated modules visible but **disabled**; click → toast “Upgrade your plan…” (Resto: reports, inventory; Alma: fees, library, behavioural, inventory) |
| Route guard | Block deep links to locked modules |
| Create student/staff/… | API `403` `SUBSCRIPTION_LIMIT`; UI surfaces error |

After Enterprise accept, sidebar should re-read `planFeatures` from the **snapshot**. Until accept, a pending offer must **not** unlock modules.

### 3.8 Data the frontend needs from `GET /subscription`

Minimum shape (Resto `SubscriptionResponse` — rename fields for Alma limits/features):

```ts
{
  planId, billingCycle, status,
  trialEndsAt, trialExpired, billingNow,
  accessStartsAt, accessPending,
  setupFeePaidUsd,
  enterprisePricing: {
    enabled, price, durationMonths,
    currentPrice, currentDurationMonths,
    setupFee, paidTrialEnabled, paidTrialDurationDays,
    preTrialSetupFee, postTrialSetupFee,
    inPaidTrial, offerChanged,
    accessStartsAt, // offer deferred date
  },
  enterpriseLimits,       // LIVE (snapshot) — gating
  enterpriseOfferLimits,  // OFFER — Enterprise card
  enterpriseFeatures,     // OFFER — Enterprise card ticks
  planFeatures,           // LIVE — sidebar / settings
  pendingPlanId, pendingBillingCycle,
}
```

Hook: cache briefly (`useSubscription`), refresh after checkout return / plan change.

### 3.9 Alma UI checklist (portal)

- [ ] Header plan pill with Upgrade / pulsing **New offer** for school admins only  
- [ ] Billing current-plan **New offer** badge  
- [ ] Enterprise card shows **offer** price, Alma limits, Alma feature ticks/crosses  
- [ ] CTAs: Start Trial / Apply new terms / Subscribe / Upgrade / Downgrade / Contact sales  
- [ ] Re-offer helper text when `offerChanged`  
- [ ] Pulse CSS (or Alma design-system equivalent)  
- [ ] Sidebar/gates still driven by live `planFeatures`, not offer  
- [ ] i18n keys for new strings (`newOfferBadge`, `startTrial`, `applyNewTerms`, …)

Live terms stay until accept. Abandoned checkout → stay on old plan / old snapshot.

---

## 4. Ops Alma (Reach) API — mirror Ops Resto

Auth: `x-api-key: <ADMIN_API_KEY>` (server-side only). Same pattern as Resto `ADMIN_REACH.md`.

### 4.1 `GET /api/v1/admin/tenants?q=`

Tenant picker for Ops. Return id, school name, owner name/email.

### 4.2 `GET /api/v1/admin/tenants/:tenantId/subscription`

Return current plan + **offer** fields + **live** `current_*` + `setupFeePaidUsd` + notes/warnings.

`404` if school missing or no subscription row (or create-on-read free shell — Resto returns 404 until PUT creates shell).

### 4.3 `PUT /api/v1/admin/tenants/:tenantId/subscription/enterprise`

**Full replace** of the offer. All keys required (omit → 400). Use `null` where unlimited / default / clear is allowed.

Creates Free subscription shell if missing. **Does not** set `plan_id = enterprise`. **Does not** write `current_enterprise_*`.

#### Suggested Alma PUT body (all keys required)

```json
{
  "price": 4990,
  "durationMonths": 24,
  "setupFee": 0,
  "branches": null,
  "students": 2000,
  "staff": null,
  "classes": null,
  "fees": true,
  "library": true,
  "behavioural": true,
  "inventory": true,
  "paidTrial": false,
  "paidTrialDays": null,
  "preTrialSetupFee": null,
  "postTrialSetupFee": null,
  "accessStartsAt": null,
  "enterpriseEnabled": true
}
```

| Field | Type | Rules |
| --- | --- | --- |
| `price` | number | > 0 |
| `durationMonths` | int | > 0 |
| `setupFee` | number | ≥ 0 |
| `branches` / `students` / `staff` / `classes` | int \| null | > 0 or null = unlimited |
| Feature flags | boolean \| null | null = Enterprise product default |
| `paidTrial` | boolean | required |
| `paidTrialDays` | int \| null | required positive if `paidTrial`; else must be null |
| `preTrialSetupFee` / `postTrialSetupFee` | number \| null | ≥ 0 or null |
| `accessStartsAt` | ISO string \| null | future UTC, or null; **mutually exclusive** with `paidTrial=true` |
| `enterpriseEnabled` | boolean | required |

Ops UI: **Trial** tab vs **Subscription** tab is a form preset (`paidTrial` true/false), not a DB `offer_kind`.

### 4.4 `DELETE /api/v1/admin/tenants/:tenantId/subscription/enterprise`

Clear **pending offer columns only**. Does not change `plan_id`, live snapshot, Stripe ids, or `setupFeePaidUsd`.

| Case | Behaviour |
| --- | --- |
| Pending offer, not live Enterprise | Clear → `cleared: true` |
| Already on Enterprise / has `current_enterprise_price` | `409` unless `?force=true` or body `{ "force": true }` (cancel re-offer only) |
| Nothing to clear | `200` with `cleared: false` |

Clear patch (Resto-equivalent) should null/zero all `enterprise_*` offer fields including paid-trial and access-start. Do **not** clear `current_enterprise_*` or `enterprise_in_paid_trial` unless product explicitly wants that (Resto does not clear runtime trial flag on DELETE).

### 4.5 Reach prompt (Ops Alma)

```
Alma Enterprise subscription admin (same contract as Ops Resto):
GET    /api/v1/admin/tenants/:tenantId/subscription  (x-api-key)
PUT    /api/v1/admin/tenants/:tenantId/subscription/enterprise  (x-api-key)
DELETE /api/v1/admin/tenants/:tenantId/subscription/enterprise  (x-api-key)

PUT body MUST include every key (no partial merge). Alma limit keys:
  branches, students, staff, classes (null = unlimited)
Alma feature keys:
  fees, library, behavioural, inventory  (boolean | null)
Also: price, durationMonths, setupFee, paidTrial, paidTrialDays,
  preTrialSetupFee, postTrialSetupFee, accessStartsAt, enterpriseEnabled

Creates free sub shell if missing; writes OFFER only (does not activate plan).
Live terms = current_enterprise_*; tenant accepts in Alma Billing.
DELETE clears pending offer; force=true to cancel re-offer while live Enterprise remains.
Show setupFeePaidUsd (read-only lifetime setup paid).
```

---

## 5. Tenant acceptance — replicate Resto behaviour on Alma’s billing engine

Alma may keep **one-off Checkout + cron renewals** instead of Resto’s Stripe Subscription objects. That is fine: the **state machine** should still match.

### 5.1 Accept paths

| Path | What to write | What to charge |
| --- | --- | --- |
| Start Trial | `plan_id=enterprise`, snapshot from offer, `enterprise_in_paid_trial=true`, status trial | Pre-trial setup differential only |
| Subscribe (post-trial or non-trial) | Snapshot + active status; clear in-paid-trial | Post-trial setup differential + first period / recurring per Alma rules |
| Apply new terms (price up) | New snapshot after payment | Upgrade / gap payment |
| Apply new terms (price down) | Pending → apply at period end | Per Alma downgrade rules |
| Apply new terms (same price, limits/features only) | Snapshot immediately | $0 (`applyZeroCostUpgrade` equivalent) |

**Snapshot helper** (copy offer → current at accept):

```text
current_enterprise_* = enterprise_*  (resolved nulls → concrete booleans/limits)
access_starts_at     = enterprise_access_starts_at  (if deferred access)
raise setup_fee_paid_usd with GREATEST(old, amount just paid)
```

When leaving Enterprise, clear all `current_enterprise_*`.

### 5.2 Paid trial lifecycle (Resto)

1. Ops configures paid trial on offer.
2. Tenant **Start Trial** → charge pre-trial setup only; trial window starts.
3. Resto sets Stripe `cancel_at = trial_end` so recurring does **not** auto-bill.
4. Trial ends → keep Enterprise entitlements briefly / mark expired per product; clear Stripe sub id; set expired trial; **block creates** (Resto blocks orders).
5. Tenant **Subscribe** → post-trial setup differential + start paid term.

Alma adaptation: if you do not use Stripe Subscription trials, store `trial_ends_at` yourself and use the same CTAs + watermark math.

### 5.3 Setup fee formula (always)

```text
due = max(0, targetSetupListPrice − setup_fee_paid_usd)
```

After successful collect: `setup_fee_paid_usd = GREATEST(setup_fee_paid_usd, amount_now_considered_paid)`.

### 5.4 Gating after accept

| Check | Source |
| --- | --- |
| Feature gate (fees / library / …) | `current_enterprise_*` if snapshot; else plan-config for non-Enterprise |
| Usage limits (students / staff / …) | Same — snapshot overrides plan defaults |
| API | `403` + Alma’s existing `SUBSCRIPTION_FEATURE` / `SUBSCRIPTION_LIMIT` codes |
| UI | Sidebar disabled + upgrade / new-offer messaging |

Do **not** gate from `enterprise_*` offer columns for live access, or Ops re-offers will silently change production schools.

---

## 6. Self-serve Starter/Pro (unchanged intent)

Keep Alma’s existing:

- Free signup → Free plan
- Upgrade → pay now (Stripe) → apply
- Downgrade → pending at period end if usage fits
- Feature + limit enforcement

Enterprise in plan picker without an offer → **contact sales** (never self-serve catalog price).

Optional: Starter/Pro add-on checkboxes at checkout (Resto). Enterprise includes negotiated extras in offer price.

---

## 7. Implementation checklist for Alma

### Backend

- [ ] Migrations: offer columns, snapshot columns, paid-trial columns, `setup_fee_paid_usd`, optional deferred access, optional add-ons
- [ ] `plan-config.ts` (or Alma equivalent): keep Alma limits/features; add Enterprise negotiable overrides
- [ ] `enterpriseTermsSnapshotFields()` / `enterpriseOfferDiffersFromActiveTerms()` / `resolvePlanFeatures(plan, row, 'active'|'offer')`
- [ ] Admin module: API key guard, GET tenants, GET/PUT/DELETE enterprise offer (shared core callable from CLI too)
- [ ] `changePlan` / checkout / webhook or Alma payment fulfillment: on Enterprise accept, write snapshot + watermark
- [ ] Zero-cost apply path for same-price re-offers
- [ ] Guards: read **snapshot** for Enterprise entitlements
- [ ] Downgrade-to-non-enterprise: clear snapshot

### Frontend (school portal)

- [ ] `GET /subscription` returns full `enterprisePricing` + offer/live limits/features (see §3.8)
- [ ] Header tier pill: Upgrade vs pulsing **New offer**; school-admin click → `/billing` (§3.2)
- [ ] Billing current-plan card: pulsing **New offer** badge (§3.4)
- [ ] Enterprise card: offer price/limits/features + CTA matrix (§3.5)
- [ ] Re-offer note + **Apply new terms** when `offerChanged`
- [ ] Pulse CSS / reduced-motion
- [ ] Sidebar + creates still use **live** features/limits only
- [ ] Do not unlock modules until accept succeeds

### Ops Alma (Reach)

- [ ] Tenant picker → Trial | Subscription tabs
- [ ] Form maps to full PUT body (Alma limit/feature keys)
- [ ] Show live terms vs pending offer; show `setupFeePaidUsd`
- [ ] Cancel pending offer → DELETE; re-offer cancel → force
- [ ] Env: shared `ADMIN_API_KEY` / `ALMA_*_ADMIN_API_KEY` per environment

### Tests / scenarios to prove

1. Ops PUT offer on Free school → header New offer → accept → snapshot set, plan enterprise  
2. Ops re-PUT different limits while live → `offerChanged` → live limits unchanged until Apply  
3. DELETE without force on live Enterprise → 409; with force → offer cleared, live unchanged  
4. Paid trial: Start Trial charges only pre-trial; Subscribe charges post-trial differential  
5. Usage over cheaper plan still blocks self-serve downgrade  
6. Feature API still returns Alma’s `SUBSCRIPTION_FEATURE` when snapshot disables a module  

---

## 8. Alma vs Resto — quick reference

| Topic | Resto | Alma (yours) |
| --- | --- | --- |
| Tenant | Restaurant | School |
| Self-serve price | Flat $ / month | ~$ / student / month |
| Limits | locations, users, counters, orders/mo | branches, students, staff, classes |
| Hard feature gates | callcenter, kds, inventory (+ add-ons) | fees, library, behavioural, inventory |
| Enterprise sales | Ops Resto → Reach | Ops Alma → Reach (same API shape) |
| Renewals | Stripe Subscription + webhooks | Alma cron + invoices (keep unless you migrate) |
| Offer model | `enterprise_*` vs `current_enterprise_*` | **Same pattern** |
| Activation | Portal only | Portal only |

---

## 9. Minimal SQL sketch (Alma-oriented)

Illustrative — adjust types/names to Alma migrations. Do not run blindly against Resto.

```sql
-- Offer
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS enterprise_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS enterprise_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS enterprise_duration_months INTEGER,
  ADD COLUMN IF NOT EXISTS enterprise_setup_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enterprise_branches_limit INTEGER,
  ADD COLUMN IF NOT EXISTS enterprise_students_limit INTEGER,
  ADD COLUMN IF NOT EXISTS enterprise_staff_limit INTEGER,
  ADD COLUMN IF NOT EXISTS enterprise_classes_limit INTEGER,
  ADD COLUMN IF NOT EXISTS enterprise_fees_enabled BOOLEAN,
  ADD COLUMN IF NOT EXISTS enterprise_library_enabled BOOLEAN,
  ADD COLUMN IF NOT EXISTS enterprise_behavioural_enabled BOOLEAN,
  ADD COLUMN IF NOT EXISTS enterprise_inventory_enabled BOOLEAN,
  ADD COLUMN IF NOT EXISTS enterprise_paid_trial_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS enterprise_paid_trial_duration_days INTEGER,
  ADD COLUMN IF NOT EXISTS enterprise_pre_trial_setup_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enterprise_post_trial_setup_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enterprise_in_paid_trial BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS enterprise_access_starts_at TIMESTAMPTZ;

-- Live snapshot
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS current_enterprise_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS current_enterprise_duration_months INTEGER,
  ADD COLUMN IF NOT EXISTS current_enterprise_branches_limit INTEGER,
  ADD COLUMN IF NOT EXISTS current_enterprise_students_limit INTEGER,
  ADD COLUMN IF NOT EXISTS current_enterprise_staff_limit INTEGER,
  ADD COLUMN IF NOT EXISTS current_enterprise_classes_limit INTEGER,
  ADD COLUMN IF NOT EXISTS current_enterprise_fees_enabled BOOLEAN,
  ADD COLUMN IF NOT EXISTS current_enterprise_library_enabled BOOLEAN,
  ADD COLUMN IF NOT EXISTS current_enterprise_behavioural_enabled BOOLEAN,
  ADD COLUMN IF NOT EXISTS current_enterprise_inventory_enabled BOOLEAN,
  ADD COLUMN IF NOT EXISTS access_starts_at TIMESTAMPTZ;

-- Watermark
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS setup_fee_paid_usd NUMERIC(12,2) NOT NULL DEFAULT 0;
```

---

## 10. One-line summary for your boss / Ops Alma builder

**Ops writes offers into `enterprise_*` via full-replace PUT; never mutates live `current_enterprise_*` remotely; the school accepts in Billing; Reach Alma should clone Ops Resto’s GET/PUT/DELETE contract with Alma’s branch/student/staff/class limits and fees/library/behavioural/inventory features.**

---

*Derived from Resto codebase behaviour (admin Reach API, tenant-subscription.core, subscription.service, migrations 144–191). Alma limits/features intentionally remapped. Re-check Resto if those modules move again.*

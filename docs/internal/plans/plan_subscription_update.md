# Alma — Subscription update plan (Ops Alma / Reach Enterprise offers)

Planning doc for bringing Resto’s **Enterprise offer ≠ live plan** model into Alma, on top of Alma’s existing Free → Starter → Pro → Enterprise + Stripe checkout + cron renewals.

**Sources**

| Source | Path / note |
| --- | --- |
| Resto integration brief | `docs/subscription_module.md` |
| Live Alma DB (verified via MCP) | `subscriptions`, `subscription_usage`, `subscription_invoices`, `billing_payment_events` |
| Alma plan catalog | `backend/src/modules/subscription/plan-config.ts` |
| Reach pattern (outbound) | Support module → `ReachClientService` (`REACH_API_KEY` / `REACH_BASE_URL`) |
| Target Reach pattern (inbound) | Ops Alma → Alma admin API with `x-api-key` (mirror Ops Resto) |

**Status:** Implemented (Ops Alma Admin API + catalog + accept UX).  
**Locked decisions:** Limits = branches / students / storage only. Enterprise paid add-ons = fees, library, behavioural, uniform inventory, white label, Google Classroom. Free includes report cards, advanced reports, timetable & substitution. Branding / Google Classroom are Enterprise add-ons only.

---

## 1. Goal (one sentence)

Ops Alma (Reach) writes a **pending Enterprise offer**; the school **accepts in Billing**; only then do live entitlements (`current_enterprise_*`) and `plan_id = enterprise` change — same mental model as Ops Resto, with Alma’s school limits/features and Alma’s existing self-serve Starter/Pro billing engine.

---

## 2. What we keep (do not rip out)

| Keep | Why |
| --- | --- |
| One subscription row per school (`tenant_id` UNIQUE) | Already correct |
| Plans: `free` \| `starter` \| `pro` \| `enterprise` | Same ladder |
| Self-serve Starter/Pro (per-student pricing, Stripe Checkout one-off, downgrade at period end) | Working today |
| Usage table + limit asserts on create | Working today |
| Feature gates on Fees / Library / Behavioural / Inventory | Working in API + sidebar |
| Invoice + payment-events tables | Keep; extend if Enterprise checkout needs new invoice reasons |
| Cron end-of-period renewals / pending self-serve plan apply | Keep unless we later migrate to Stripe Subscriptions |
| Free bootstrap on tenant create (100-year period) | Keep |

---

## 3. What we add (the gap vs Resto)

1. **Offer ≠ live plan** — Ops PUT only fills `enterprise_*`; never sets `plan_id` / never writes `current_enterprise_*`.
2. **Dual column sets** — offer (`enterprise_*`) vs accepted snapshot (`current_enterprise_*`).
3. **Ops Alma admin API** — GET tenants, GET subscription, PUT enterprise offer (full replace), DELETE pending offer (`force` for re-offer cancel).
4. **Tenant UX** — header “New offer” pulse, Billing Enterprise card CTAs (Start Trial / Subscribe / Apply new terms / Upgrade / Downgrade / Contact sales).
5. **Paid trial + setup-fee watermark** (`setup_fee_paid_usd`) + optional deferred `access_starts_at`.
6. **Entitlement resolution** — when snapshot exists, gates/limits read **snapshot**, not offer, not static Enterprise defaults alone.

Optional (phase 2+): Starter/Pro checkbox add-ons (Resto pattern). Skip unless product wants them.

---

## 4. Current Alma schema (MCP-verified)

Live DB as of this plan — **no** `enterprise_*` / `current_enterprise_*` / `setup_fee_paid_usd` yet.

### 4.1 `subscriptions`

| Column | Present |
| --- | --- |
| `id`, `tenant_id` (unique), `plan_id`, `billing_cycle`, `status` | ✅ |
| `current_period_start`, `current_period_end`, `trial_ends_at` | ✅ |
| `pending_plan_id`, `pending_billing_cycle` | ✅ (self-serve only) |
| `cancelled_at`, `notes`, timestamps | ✅ |
| `payment_provider`, `stripe_customer_id`, `stripe_subscription_id` | ✅ |
| All `enterprise_*` offer columns | ❌ missing |
| All `current_enterprise_*` snapshot columns | ❌ missing |
| `setup_fee_paid_usd`, `access_starts_at` | ❌ missing |

### 4.2 `subscription_usage`

| Metric | Present |
| --- | --- |
| `branches_used`, `students_used`, `staff_used`, `classes_used` | ✅ |
| `storage_used_mb`, `reports_this_month`, `sms_this_month` | ✅ |
| `last_reset_at`, timestamps | ✅ |

### 4.3 Related

- `subscription_invoices` — includes Stripe checkout + `pending_upgrade_*` columns ✅  
- `billing_payment_events` ✅  

### 4.4 Live plan mix (MCP count)

~74 subscriptions: mostly Free; a few Pro / Enterprise already (Enterprise today = contact-sales / manual, **not** offer/snapshot driven).

---

## 5. Reach direction (important)

| Integration | Direction | Auth today |
| --- | --- | --- |
| **Support** (exists) | Alma Nest → Reach Support API | `REACH_API_KEY` outbound |
| **Ops Alma Enterprise offers** (new) | **Reach Ops → Alma Nest** admin routes | `x-api-key` inbound (new `ADMIN_API_KEY` / env name TBD) |

Support is **not** reused for offers. Ops Alma will call Alma the same way Ops Resto calls Resto. Alma must expose admin endpoints; Reach stores the Alma base URL + admin key per environment.

---

## 6. Target architecture

```text
Ops Alma (Reach UI)
  → PUT /api/v1/admin/tenants/:tenantId/subscription/enterprise
  → Writes OFFER columns only (enterprise_*)
  → Does NOT set plan_id = enterprise
  → Does NOT touch current_enterprise_*

School admin (Alma portal)
  → Header “New offer” → /billing
  → Enterprise card shows OFFER terms
  → Accept (Start Trial / Subscribe / Apply new terms / …)
  → Alma writes SNAPSHOT (current_enterprise_*) + plan_id + charges (if any)

Live gates / limits
  → Read current_enterprise_* when snapshot exists
  → Else read plan-config for Free/Starter/Pro
  → Never gate from pending offer columns
```

### 6.1 Admin API (mirror Resto contract)

| Method | Path | Behaviour |
| --- | --- | --- |
| `GET` | `/api/v1/admin/tenants?q=` | Tenant picker (id, school name, owner email) |
| `GET` | `/api/v1/admin/tenants/:tenantId/subscription` | Plan + offer + live snapshot + `setupFeePaidUsd` |
| `PUT` | `.../subscription/enterprise` | **Full replace** offer; all keys required; create Free shell if missing |
| `DELETE` | `.../subscription/enterprise` | Clear offer only; `409` if live Enterprise unless `force` |

Auth: API key guard, server-side only. No JWT school-user auth.

### 6.2 Acceptance paths (tenant Billing)

| Path | Effect |
| --- | --- |
| Start Trial | `plan_id=enterprise`, snapshot, `enterprise_in_paid_trial=true`; charge pre-trial setup differential |
| Subscribe (non-trial or post-trial) | Snapshot + active; clear in-paid-trial; charge post-trial/setup + period per Alma rules |
| Apply new terms (price up) | After payment → new snapshot |
| Apply new terms (price down) | Schedule → apply at period end |
| Apply new terms (same price, limits/features only) | Zero-cost immediate snapshot rewrite |
| Leave Enterprise | Clear all `current_enterprise_*` |

Setup fee watermark: `due = max(0, listPrice − setup_fee_paid_usd)`; watermark never decreases.

---

## 7. Schema to add (migration sketch)

Aligned with `docs/subscription_module.md` §9 — Alma names. Final limit/feature columns depend on §8 / §9 decisions.

### 7.1 Always add (core offer/snapshot plumbing)

```text
-- Offer
enterprise_enabled
enterprise_price
enterprise_duration_months
enterprise_setup_fee
enterprise_paid_trial_enabled
enterprise_paid_trial_duration_days
enterprise_pre_trial_setup_fee
enterprise_post_trial_setup_fee
enterprise_in_paid_trial
enterprise_access_starts_at          -- optional deferred go-live on offer

-- Live
current_enterprise_price
current_enterprise_duration_months
access_starts_at                     -- frozen at accept if deferred

-- Watermark
setup_fee_paid_usd
```

### 7.2 Negotiable limit columns (pick from §8)

Pattern per chosen limit:

```text
enterprise_<metric>_limit          -- offer (NULL = unlimited)
current_enterprise_<metric>_limit  -- snapshot
```

### 7.3 Negotiable feature columns (pick from §9)

Pattern per chosen feature:

```text
enterprise_<feature>_enabled         -- offer (NULL = Enterprise product default)
current_enterprise_<feature>_enabled -- snapshot
```

### 7.4 What we will **not** invent (unless Alma consciously differs)

- No `offer_kind` / `current_kind` columns (Resto uses `enterprise_paid_trial_enabled` instead).
- No Ops “activate Enterprise” remote write — portal accept only.

---

## 8. DECISION — Possible **Limits** options

### 8.1 Already in Alma (usage + plan-config)

| Limit key | Tracked in usage? | Enforced on create today? | Recommended for Enterprise offer? |
| --- | --- | --- | --- |
| **branches** | ✅ | ✅ | **Yes — core** |
| **students** | ✅ | ✅ | **Yes — core** |
| **staff** | ✅ | ✅ | **Yes — core** |
| **classes** | ✅ | ✅ | **Yes — core** |
| **storageMB** | ✅ | ❌ (tracked / downgrade check) | **Optional** — useful for large schools |
| **monthlyReports** | ✅ | ❌ soft | **Optional** — or fold into “unlimited reports on Enterprise” |
| **monthlySMS** | ✅ | ❌ soft | **Optional** — good sales lever if SMS is billed/bundled |

### 8.2 Possible new limits (not in plan-config / usage today)

| Limit idea | Meaning | Effort | Recommend? |
| --- | --- | --- | --- |
| **guardians / parents** | Max linked parent users | Medium (new counter + asserts) | Maybe later |
| **academic years** | Concurrent years | Low–med | Rarely needed |
| **class sections** (vs “classes”) | If “classes” is ambiguous | Clarify naming only | Prefer keep `classes` = class-sections as today |
| **Google Classroom syncs / month** | API quota | Med | Phase 2 |
| **support minutes** | Already Reach-side | Low (don’t duplicate) | Prefer Reach Support limits, not Alma sub |
| **certificates / ID cards / month** | Doc generation | Med | Optional |
| **data export jobs / day** | Abuse control | Low | Optional ops control, not sales offer |
| **branches with fee module** | Partial unlock | High | Avoid — prefer feature flags |

### 8.3 Suggested decision packages

**Package A — Minimal (match Resto brief remapping)**  
Offer negotiates: `branches`, `students`, `staff`, `classes` only.  
Storage / reports / SMS stay on static Enterprise plan-config defaults (or unlimited).

**Package B — Recommended**  
Package A + `storageMB` + `monthlySMS` as negotiable.  
Reports stay unlimited on Enterprise unless sales asks.

**Package C — Full soft-usage**  
Package B + `monthlyReports` (+ later guardians if product wants).

**Please pick A / B / C (or a custom list).** Default recommendation if undecided: **Package B**.

---

## 9. DECISION — Possible **Features** options

### 9.1 Already defined in `plan-config.ts`

| Feature flag | Gated in API/UI today? | On Free | Starter | Pro | Enterprise default | Offer-negotiable? |
| --- | --- | --- | --- | --- | --- | --- |
| `hasFeeManagement` | ✅ Fees | ❌ | ✅ | ✅ | ✅ | **Yes — core** |
| `hasLibraryManagement` | ✅ Library | ❌ | ❌ | ✅ | ✅ | **Yes — core** |
| `hasBehavioralTracking` | ✅ Behavioural | ❌ | ❌ | ✅ | ✅ | **Yes — core** |
| `hasInventoryManagement` | ✅ Inventory/uniforms | ❌ | ❌ | ✅ | ✅ | **Yes — core** |
| `hasAdvancedReports` | ❌ flag only | ❌ | ✅ | ✅ | ✅ | Optional |
| `hasResultCards` | ❌ flag only | ❌ | ✅ | ✅ | ✅ | Optional |
| `hasParentPortal` | ❌ (always on Free+) | ✅ | ✅ | ✅ | ✅ | Usually always on |
| `hasSMSNotifications` | ❌ flag only | ❌ | ✅ | ✅ | ✅ | Optional / pair with SMS limit |
| `hasTimetable` | ❌ flag only | ❌ | ✅ | ✅ | ✅ | Optional (module exists) |
| `hasMultiBranch` | Soft (branch **count** is real gate) | ❌ | ❌ | ✅ | ✅ | Prefer **branches limit**, not boolean |
| `hasCustomBranding` | ❌ flag only | ❌ | ❌ | ✅ | ✅ | Optional Enterprise sales lever |
| `hasAPIAccess` | ❌ flag only | ❌ | ❌ | ✅ | ✅ | Optional Enterprise sales lever |

### 9.2 Product modules that could become gates (not flags today)

| Module / capability | Exists in Alma? | Sensible as Enterprise negotiable? | Notes |
| --- | --- | --- | --- |
| **Timetable + Substitution** | ✅ | Optional | Flag exists for timetable; substitution not gated |
| **Assessments** | ✅ | Optional | Often considered core |
| **Attendance** | ✅ | Rarely gate | Usually Free+ |
| **Certificates** | ✅ | Optional | Docs say intentionally not gated today |
| **ID cards** | ✅ | Optional | |
| **Data export** | ✅ | Optional | Compliance / Enterprise often wants this on |
| **Google Classroom / Workspace** | ✅ | Optional | Strong Enterprise differentiator |
| **In-app Support (Reach)** | ✅ | Optional | Resto has `support` add-on; Alma may use Reach minutes instead |
| **Early departure** | ✅ | Optional / niche | |
| **Teacher substitution** | ✅ | Tie to timetable | |
| **Priority / phone support SLA** | Soft | Optional | Sales-only checkbox; may not need code gate |
| **White-label / custom domain** | Partial (`hasCustomBranding`) | Optional | |
| **SSO / API** | Partial (`hasAPIAccess`) | Optional | |

### 9.3 Suggested decision packages

**Package F1 — Minimal (Resto remapping)**  
Negotiable on offer: **Fees, Library, Behavioural, Inventory** only.  
Everything else follows static Enterprise plan-config (all on).

**Package F2 — Recommended**  
F1 + negotiable: **Timetable**, **SMS**, **Custom branding**, **API access**, **Google Classroom**.  
Keep attendance / assessments / certificates always on for Enterprise (or always on from Starter+ as today).

**Package F3 — Maximal sales flexibility**  
F2 + Certificates, ID cards, Data export, Substitution/early-departure, Support SLA flag.  
Higher schema + Ops form cost; only if sales truly sells à la carte modules.

**Please pick F1 / F2 / F3 (or a custom list).** Default recommendation if undecided: **F1 for v1**, expand to **F2** once Ops Alma UI is stable.

---

## 10. Open questions (need your answers)

1. **Limits package:** A / B / C / custom?  
2. **Features package:** F1 / F2 / F3 / custom?  
3. **Paid trial:** Must-have for v1, or phase 2 after plain Subscribe/Apply?  
4. **Deferred access (`access_starts_at`):** Must-have or skip for v1?  
5. **Starter/Pro add-ons:** Skip for now? (Recommended: skip)  
6. **Admin API key env name:** e.g. `ALMA_ADMIN_API_KEY` vs shared `ADMIN_API_KEY`?  
7. **Existing Enterprise schools (2 in DB):** migrate to synthetic snapshot from plan-config defaults, or force Ops to PUT + school re-accept?  
8. **Billing engine:** Keep Alma one-off Checkout + cron (recommended), or move Enterprise to Stripe Subscriptions like Resto?  
9. **Who sees “New offer”:** school_admin only (recommended), or also other admin-like roles?  
10. **Contact sales fallback:** keep mailto / support form when no offer configured?

---

## 11. Implementation phases (proposed)

### Phase 0 — Decisions
- Lock limits + features packages (§8–§9)
- Answer open questions (§10)
- Confirm Ops Alma builder has the Reach prompt from `docs/subscription_module.md` §4.5 (updated with final keys)

### Phase 1 — Schema + entitlement core
- Migration: offer + snapshot + watermark (+ chosen limit/feature columns)
- Helpers: `enterpriseOfferDiffersFromActiveTerms`, `resolvePlanFeatures(..., 'active'|'offer')`, snapshot copy on accept
- Guards/limits: Enterprise reads snapshot when present
- Backfill strategy for existing Enterprise rows

### Phase 2 — Ops Alma admin API
- API key guard + GET tenants + GET/PUT/DELETE enterprise offer
- Shared core service (API + optional CLI)
- Developer-guide env docs + Reach prompt with final Alma keys

### Phase 3 — Tenant acceptance + Stripe
- Extend change-plan / checkout / webhook fulfillment for Enterprise accept paths
- Zero-cost apply; paid trial if in scope; setup-fee watermark math
- Downgrade off Enterprise clears snapshot

### Phase 4 — Portal UX
- Header tier pill: Upgrade vs pulsing New offer (school_admin)
- Billing: New offer badge + Enterprise card CTA matrix
- i18n + pulse CSS / reduced-motion
- Sidebar still live-only (never offer)

### Phase 5 — Docs + tests
- User-guide billing page update
- Developer-guide billing / admin Reach module
- Scenario tests from `docs/subscription_module.md` §7

---

## 12. Out of scope for this update (unless you say otherwise)

- Replacing Free/Starter/Pro catalog pricing
- Moving all renewals to Stripe Subscription objects
- Inventing `offer_kind` columns
- Letting Ops remotely force `plan_id = enterprise`
- Gating certificates (product previously chose not to)
- Duplicating Reach Support minute limits into Alma subscription

---

## 13. Suggested PUT body shape (after you pick packages)

Illustrative for **Package B limits + F1 features** (adjust after decisions):

```json
{
  "price": 4990,
  "durationMonths": 24,
  "setupFee": 0,
  "branches": null,
  "students": 2000,
  "staff": null,
  "classes": null,
  "storageMB": 102400,
  "monthlySMS": 10000,
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

---

## 14. File touch list (when we implement)

| Area | Likely paths |
| --- | --- |
| Migration | `supabase/migrations/NNN_enterprise_offer_snapshot.sql` |
| Plan / transition | `backend/src/modules/subscription/plan-config.ts`, new enterprise helpers |
| Service / Stripe | `subscription.service.ts`, `subscription-stripe.service.ts`, webhooks |
| Admin Reach | new `backend/src/modules/admin/` (or under subscription) + API key guard |
| Frontend | `useSubscription.ts`, Billing page, Header badge, types |
| Docs | `docs/user-guide/features/billing.md`, `docs/developer-guide/modules/billing.md`, env vars |
| Source brief | Keep `docs/subscription_module.md` as reference |

---

## 15. One-line summary

**Keep Alma self-serve Free/Starter/Pro; add Resto-style dual offer/snapshot Enterprise columns + inbound Ops Alma (Reach) admin API; school accepts in Billing; you still need to choose which limits/features Ops can negotiate (§8–§9).**

---

*Drafted from `docs/subscription_module.md` + live MCP schema + current Alma subscription module. Update this file when product decisions land.*

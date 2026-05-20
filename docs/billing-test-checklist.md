# Billing & subscription — test checklist

Use a **school admin** account with a branch selected. Open **Billing** (`/billing`).

## Before you start (Stripe tests)

1. `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in `backend/.env`
2. Backend restarted after env changes
3. In a separate terminal:
   ```bash
   stripe listen --forward-to localhost:3001/api/v1/subscription/webhooks/stripe
   ```
4. Copy the webhook secret from the CLI into `.env` if it changed

Test card: **4242 4242 4242 4242** (any future expiry, any CVC).

---

## 1. Who can open billing?

| Test | Steps | Expected |
|------|--------|----------|
| Non-admin | Log in as teacher/parent → go to `/billing` | Blocked or redirected |
| School admin | Log in as school admin → `/billing` | Page loads: current plan, usage, plans, history |

---

## 2. Upgrades (paid plans + Stripe on)

| Test | Steps | Expected |
|------|--------|----------|
| Upgrade with payment | Free → **Starter** (or Pro), monthly | **Stripe Checkout opens** — plan does **not** change yet |
| Pay successfully | Complete checkout with 4242… | Brief loading on billing → success toast; plan upgraded; invoice **PAID** (one payment only) |
| Cancel checkout | Start upgrade → cancel on Stripe | Back to billing; plan **unchanged**; invoice may stay **OPEN** (no **Pay now** on upgrade invoices — click upgrade again to retry) |
| Webhook running | Same as pay successfully with `stripe listen` on | Invoice paid once; plan upgraded (check terminal for webhook) |

**Important:** If you upgraded **before** this flow existed, your tenant may already be on the new plan with a stray invoice. Reset plan to **free** and void old invoices in Supabase, or use a **new school** to test cleanly.

---

## 3. Upgrades without Stripe (or $0)

| Test | Steps | Expected |
|------|--------|----------|
| Stripe off | Remove Stripe keys, restart backend → upgrade | Plan changes **immediately** (no Checkout) |
| Zero amount | School with **0 students** → upgrade to Starter | Immediate upgrade, no Checkout (nothing to charge) |

---

## 4. Downgrades & billing cycle

| Test | Steps | Expected |
|------|--------|----------|
| Allowed downgrade | Pro → Starter when usage **fits** Starter limits | Yellow “scheduled at period end” alert |
| Cancel scheduled | Click **Keep current plan** | Alert gone; downgrade cancelled |
| Blocked downgrade | Pro → Starter when you have **too many** students/staff/etc. | Clear error with **which limits** are exceeded (not generic “failed”) |
| Same tier, yearly | Starter monthly → toggle **Annual** → upgrade | Checkout (if Stripe + amount > 0) or immediate upgrade |
| Same tier, monthly | Pro **yearly** → switch to **monthly** | Downgrade **scheduled** (not immediate) |
| Enterprise | Click **Enterprise** | Opens contact/sales page |

---

## 5. Billing history & invoices

| Test | Steps | Expected |
|------|--------|----------|
| After paid upgrade | Check **Billing history** | Row with correct amount, period, status **PAID** |
| Download | Click **Download** on paid invoice | PDF opens |
| Empty | New school, no upgrades yet | “No invoices yet” message |
| Pay now button | **OPEN** invoice, amount > 0, Stripe on | **Pay now** visible |
| Pay now hidden | Invoice **PAID** or Stripe off | No **Pay now** |

---

## 6. Stripe extras

| Test | Steps | Expected |
|------|--------|----------|
| Manage cards | **Manage payment methods** (Stripe on) | Stripe Customer Portal; returns to billing |
| Declined card | Use **4000 0000 0000 0002** | Payment fails; plan stays unchanged |
| Already paid | **Pay now** on paid invoice | Clear error (e.g. already paid) |

---

## 7. Quick smoke (15–20 min)

1. School admin opens billing  
2. Free → Starter → **Stripe Checkout** → pay 4242… → plan + invoice updated  
3. Try blocked downgrade → readable error  
4. Schedule allowed downgrade → alert → cancel with **Keep current plan**  
5. **Manage payment methods** opens portal  

---

## 8. What “good” looks like

- **Paid upgrade** = Checkout first, then plan + paid invoice (webhook must run locally).  
- **Downgrade** = scheduled at period end, or blocked with clear reasons.  
- **Errors** = explain *why* (limits, already paid, etc.).  
- **Non-admins** never manage billing.

---

## Troubleshooting

| Problem | Check |
|---------|--------|
| No Checkout on upgrade | `payment-config` → `stripeEnabled: true`; amount > 0 students |
| Paid on Stripe but plan still old | `stripe listen` running; webhook secret matches `.env` |
| Generic “failed to change plan” | Backend message should show in notification title/detail |

# 💳 Billing & Subscription

School subscription plan, usage against limits, invoices, and Stripe checkout.

## 📋 Overview

**Path:** Sidebar → **Billing**

**School admin only** — other roles are redirected to the Dashboard.

| Plan | Typical positioning |
| --- | --- |
| **Free** | Entry limits; many modules gated |
| **Starter** | Includes e.g. Fee management |
| **Pro** | Adds e.g. Library, behavioural tracking |
| **Enterprise** | Highest limits — **Contact sales** for commercial path |

Billing cycle: **Monthly** or **Yearly** (yearly shows about **10%** saving on the UI).

Certificates are **not** hidden by subscription plan entitlements.

Modules that are not on the current plan (for example Fees on **Free**, or Library / Inventory / Behavioural on **Free** and **Starter**) still appear in the **sidebar** for roles that would normally see them, but they are **disabled**. Hover shows **Upgrade your plan to access this feature**. Matching Settings sections are **hidden**, not shown as an upgrade banner.

---

## 📦 What the page shows

- **Current Plan** and any scheduled change
- Plan cards to compare / upgrade
- **Current Usage** — Branches, Students, Staff users, Classes vs plan limits
- **Billing History** — invoices

---

## 💶 Invoices and Pay now

| Status | Meaning |
| --- | --- |
| **DRAFT** | Not final |
| **OPEN** | Payable |
| **PAID** | Settled |
| **VOID** / **UNCOLLECTIBLE** | Closed without payment |

**Pay now** appears for an open, positive-value invoice when Stripe checkout is enabled and the invoice is not already tied to a pending upgrade. Download PDF/hosted invoice where available. **Manage payment methods** opens the Stripe customer portal.

If **Pay now** is missing, online payments may be off for this deployment — contact NTG support for manual billing.

---

## 💡 Tips & Best Practices

- Watch **Current Usage** before adding branches or bulk-importing students.
- Prefer yearly billing when the saving badge matches your budget cycle.

---

## 🆘 Troubleshooting

**Billing menu missing:** Sign in as school admin.

**Features disappeared after a plan change:** Check entitlements on this page; contact support if unexpected.

**Related:** [💵 Fee Management](fee-management.md) (student challans — separate from Alma subscription billing).

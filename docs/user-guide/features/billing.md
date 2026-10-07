# 💳 Billing & Subscription

School subscription plan, usage against limits, invoices, Stripe checkout, and Enterprise offers from Ops Alma.

## 📋 Overview

**Path:** Sidebar → **Billing**

**School admin only** — other roles are redirected to the Dashboard.

| Plan | Typical positioning |
| --- | --- |
| **Free** | Core school ops, report cards, timetable & substitution; 1 branch, 25 students, 500 MB |
| **Starter** | Adds fee management, certificates / ID cards, promotion, data export |
| **Pro** | Adds library, behavioural, inventory / uniforms, multi-branch |
| **Enterprise** | Custom limits via Ops Alma offer; paid add-ons accepted in Billing |

**Limits shown and enforced:** branches, students, storage only.

Billing cycle: **Monthly** or **Yearly** (yearly shows about **10%** saving on the UI).

Certificates are **not** hidden by subscription plan entitlements.

Modules that are not on the current plan (for example Fees on **Free**, or Library / Inventory / Behavioural on **Free** and **Starter**) still appear in the **sidebar** for roles that would normally see them, but they are **disabled**. Hover shows **Upgrade your plan to access this feature**. Matching Settings sections are **hidden**, not shown as an upgrade banner.

## 🏢 Enterprise offers

When Ops Alma sends an Enterprise offer, school admins see a pulsing **New offer** cue in the header and on the Billing current-plan card. The Enterprise plan card shows negotiated price, limits, and add-ons. Accept with **Start trial**, **Subscribe**, or **Apply new terms** as appropriate. Until you accept, live features stay on your current plan.

Enterprise paid add-ons (negotiated): Fees, Library, Behavioural, Uniform Inventory, White label, Google Classroom.

## 📦 What the page shows

- **Current Plan** and any scheduled change / new offer badge
- Plan cards to compare / upgrade
- **Current Usage** — Branches, Students, Storage vs plan limits
- **Billing History** — invoices

## 💶 Invoices and Pay now

| Status | Meaning |
| --- | --- |
| **DRAFT** | Not final |
| **OPEN** | Payable |
| **PAID** | Settled |
| **VOID** / **UNCOLLECTIBLE** | Closed without payment |

**Pay now** appears for an open, positive-value invoice when Stripe checkout is enabled and the invoice is not already tied to a pending upgrade. Download PDF/hosted invoice where available. **Manage payment methods** opens the Stripe customer portal.

If **Pay now** is missing, online payments may be off for this deployment — contact NTG support for manual billing.

## 💡 Tips & Best Practices

- Watch **Current Usage** before adding branches or bulk-importing students.
- Prefer yearly billing when the saving badge matches your budget cycle.

## 🆘 Troubleshooting

**Billing menu missing:** Sign in as school admin.

**Features disappeared after a plan change:** Check entitlements on this page; contact support if unexpected.

**New offer but modules still locked:** Accept the offer on the Enterprise card — pending Ops offers do not unlock features until accepted.

**Related:** [💵 Fee Management](fee-management.md) (student challans — separate from Alma subscription billing).

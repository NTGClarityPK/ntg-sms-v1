# 🛠️ Admin Portal

Operations console for **NTG platform administrators** (`super_admin`) — not day-to-day school staff.

## 📋 Overview

**Base path:** `/adminportal` (separate shell from the school portal)

Navigation: **Dashboard**, **Assign Branch**, **Tenants**, **Unlock Academic Year**, **Payment Model**, **Audit Trail**.

---

## 🏫 Tenants

Lists **Tenant**, **Domain**, **School Admins**, **Status**, **Actions**.

Actions: refresh, deactivate / restore, scheduled hard delete with a short **Undo delete** window.

The Tenants UI does **not** create or edit tenant records and has **no** default-locale control. School default language is set in the school portal under **Settings → Business Info**.

---

## 💳 Payment Model

Subscription **override** screen for each school (route may say “payment models”).

Shows plan, status, students, branches, period end. **Edit** plan, billing cycle, and notes (saving clears pending subscription changes). **Sync usage** refreshes recorded usage counters.

School-facing checkout remains on [💳 Billing & Subscription](billing.md).

---

## 🔓 Unlock Academic Year

Unlock a locked academic year when a school needs corrections after rollover locks.

---

## 🧾 Audit Trail

Only here: `/adminportal/audit-trail`. See [🧾 Audit Trail](audit-trail.md).

---

## 🔐 Security note

Use named ops accounts with `super_admin`. Do not rely on legacy email-domain elevation in production.

---

## 🆘 Troubleshooting

**Redirected away from adminportal:** Account is not super admin.

**Looking for default locale on Tenants:** Use the school’s **Settings → Business Info** instead.

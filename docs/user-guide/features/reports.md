# 📊 Reports

Student, class, administrative, public, and revenue reports — plus a separate Fee reports page.

## 📋 Overview

**Path:** Sidebar → **Reports** (page title **Report**)

| Tab | Who typically sees it |
| --- | --- |
| **Student report** | Permitted staff |
| **Class report** | Permitted staff |
| **Public report** | In-portal, authenticated, current branch |
| **Administrative** | Teachers, school admin, principal, academic coordinator |
| **Revenue** | School admin and principal only |

Report cards / PDF generation for terms and monthly progress live under [🥇 Report Cards](results.md), not here.

**Fee reports** (`/reports/fees`) is a **separate** page (collected / pending / under review / overdue / defaulters) — not one of these tabs. See [💵 Fee Management](fee-management.md).

---

## 👤 Student report

Staff-only **360°** view of one student: academic marks, attendance, behaviour, and related sections for the selected period. Export PDF/Excel where offered.

This is **not** the parent-facing report card. Official Mid-term / Final / monthly Progress cards (and the parent monthly Academic + Attendance + Behaviour downloads) are under [🥇 Report Cards](results.md) → **My Child** after publish.

Periods: All, Year to date, This week, This month, Custom range. Configurable exports where offered.

---

## 🏫 Class report

Attendance, average grade, assignment viewing, and assignment submission. Choose a class, then export.

---

## 🗂️ Administrative

Sub-tabs: **Attendance** and **Academic**. Export **PDF** and **Excel**; some exports can also be saved for offline use.

---

## 💰 Revenue

Fee collection and ID card reprint revenue. Scope: current / combined / chosen branch. Summary or detailed; **PDF** / **Excel** export.

---

## 🌍 Public statistics (external)

- In-portal **Public report** tab: signed-in users, current branch.
- External URL: `/public/statistics/[branchCode]`.

External access does **not** use a normal Alma login, but it **is password-gated**. After the password succeeds, Alma issues a **branch token** (about one hour), stored in session storage and sent as a bearer token for statistics.

Public stats show total / male / female counts and class–section counts — **no** individual student records.

Configure public stats under **Settings → Stats** (public statistics).

---

## 🆘 Troubleshooting

**Revenue tab missing:** Restricted to school admin and principal.

**Public stats “no login” myths:** You still need the configured password (and the temporary token).

**Looking for fee defaulters:** Open `/reports/fees`, not the main Reports tabs.

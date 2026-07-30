# 💵 Fee Management

Short guide for configuring fee templates, generating challans, and verifying parent payment proofs.

## 📋 Overview

| Who | Where | What |
| --- | --- | --- |
| School admin / Principal / Super admin | **Fees** → **Challan management** / **Payment history** | Generate challans, review proofs, export |
| Parents / students | **Fees** (My Fees) | Download challan PDF, submit proof, view receipts |
| School admin / Principal / Super admin | **Settings → Fee settings** | Bank details, templates, challan style |
| School admin / Principal / Super admin | **Fee reports** (`/reports/fees`) | Collected / pending / under review / overdue, defaulters |

Fee Management requires the school plan feature **Fee management** (Starter and above; not on Free).

There is **no “Mark as Paid”** button. Payments move through **proof upload → Review → Verify or Reject**.

---

## ⚙️ Part 1: Fee settings

**Path:** **Settings → Fee settings**

### Challan settings

Configure what appears on printed challans:

- Bank name, account title, account number, branch code
- Payment instructions
- Footer notice
- Challan template style (**Minimal** / **Modern**)

### Fee templates

Templates define charges and discounts.

| Field | Options |
| --- | --- |
| **Type** | **Fee** or **Discount** |
| **Scope** | Levels, Class, Class-Section, Individual |
| **Metrics** | Named line items — absolute amount or percentage |
| **Auto-apply** | On Individual templates — e.g. staff-parent discount (`parent has staff role`) |

When more than one fee template could apply, the **most specific** wins: Individual → Class-Section → Class → Level.

Discount templates marked **Auto** can be included automatically when you generate challans. Sibling auto-discount may exist in calculation rules for linked siblings in the same branch; the create-template UI currently exposes staff-parent auto-apply, not a sibling checkbox.

---

## 📄 Part 2: Challan management

**Path:** **Fees → Challan management**

### Generate for a class and month

1. Choose **class section** and **month**.
2. Click **Generate challans**.
3. Confirm the pre-selected template and any auto discounts.
4. Confirm & generate for the roster.

### One-off individual challan

Use **Generate** on a student row when you need mid-month joins or temporary changes:

- Optional start date and due date override
- Exclude a metric or override an amount for **this challan only**
- Next month uses the normal template again

### Download

- Per student: **Download PDF**
- There is **no** bulk ZIP of challan PDFs in Fee Management today

### Challan roster statuses

| Status | Meaning |
| --- | --- |
| **No challan** | Not generated for that month |
| **Pending payment** | Issued; waiting for proof |
| **Under review** | Parent submitted proof; staff must verify |
| **Verified** | Payment accepted; receipt available |
| **Rejected** | Proof rejected (reason recorded) |
| **Cancelled** | Challan cancelled |

---

## 💳 Part 3: Payment history (admin)

**Path:** **Fees → Payment history**

### Filters

- **Class** (class section; All)
- **Status** — All / Under review / Verified / Rejected
- **Date range** (defaults to last 30 days)
- **Search student**

Summary badges: **Collected** and **Pending**.

### Review a payment

1. Find a row with status **Under review** (or **Pending review** on badges).
2. Click **Review**.
3. Open or download the proof.
4. **Verify** or **Reject** (reject requires a reason).

Verified rows offer **Receipt** (PDF). Payment methods shown in review: **Bank transfer**, **Cash**.

### Export

**Export** downloads an **Excel (.xlsx)** file (`fee-payments-history.xlsx`) — not CSV.

---

## 👨‍👩‍👧 Part 4: My Fees (parents and students)

On **Fees**, parents and students see:

| Tab | Actions |
| --- | --- |
| **Fee payment** | Pending challans — **Download PDF**, **Submit proof** (disabled while Under review) |
| **Payment history** | Past payments — **Receipt** when verified |

Submit proof fields: payment date, amount paid, method (Bank transfer / Cash), bank name, transaction reference, proof file (PNG / JPEG / PDF). Parents with several children see a **Student** column.

---

## 📊 Fee reports

**Path:** `/reports/fees` (page title **Fee reports**)

Also documented under [📊 Reports](reports.md). Not a separate sidebar item in all builds — bookmark or navigate directly.

Cards: **Collected (verified)**, **Pending**, **Under review**, **Overdue**. Table **Defaulters** lists student, challan, due date, amount.

School admin / principal / super admin; requires Fee management plan feature.

---

## 💡 Tips & Best Practices

- Set bank details and templates in **Fee settings** before the first month’s generate.
- Bulk-generate for the class; use individual generate only for exceptions.
- Process **Under review** rows promptly so parents get a receipt.
- Export XLSX for accounts reconciliation.

---

## 🆘 Troubleshooting

**Fees missing from the sidebar:** Check plan includes Fee management, and your role is allowed.

**Cannot mark paid:** Upload proof as parent, then verify under **Payment history** — there is no manual “Mark as Paid”.

**Submit proof disabled:** Challan is already **Under review** — wait for staff to verify or reject.

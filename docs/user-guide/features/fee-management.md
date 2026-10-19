# 💵 Fee Management

Short guide for fee packages, monthly fee bills (challans), cash at the desk, and bank proof verification.

## 📋 Overview

| Who | Where | What |
| --- | --- | --- |
| School admin / Principal | **Fees** → **Monthly bills** / **Payment history** / **Late fees** | Create bills, mark cash paid, review proofs, export, waive late fees |
| Parents / students | **Fees** (My Fees) | Download fee bill PDF, submit bank proof, view receipts |
| School admin / Principal | **Settings → Fee settings** | Bank details, fee packages, bill PDF style, late fee enable + package |
| School admin / Principal | **Reports → Fee reports** (or **Fees → Payment history → Overdue**) | Collected / pending / under review / overdue |

Fee Management requires the school plan feature **Fee management** (Starter and above; not on Free). On plans without it, **Fees** stays visible in the sidebar but is disabled; hovering shows an upgrade message. **Settings → Fee settings** is hidden.

### How payments work

- **Cash at the school desk:** on **Monthly bills**, use **Mark as paid** for unpaid fee bills. Creates a verified cash payment and receipt — no parent proof upload.
- **Bank transfer:** parent downloads the bill, pays, uploads proof → office **Verify** or **Reject** in **Payment history**.
- If a bill is **Under review**, finish verify/reject there before marking cash paid.

---

## ⚙️ Part 1: Fee settings

**Path:** **Settings → Fee settings**

### Bank / bill settings

Configure what appears on printed fee bills (challans):

- Bank name, account title, account number, branch code
- Payment instructions
- Footer notice
- Bill PDF style (**Minimal** / **Modern**)

Save bank details **once** here (they rarely change). They appear on every new bill PDF.

### Fee packages (templates)

Packages define monthly charges and discounts.

| Field | Options |
| --- | --- |
| **Type** | **Fee** or **Discount** |
| **Applies to** | Levels, Class, Class-Section, Individual |
| **Fee items** | Named line items — absolute amount or percentage |
| **Auto-apply** | On Individual packages — e.g. staff-parent discount |

When more than one fee package could apply, the **most specific** wins: Individual → Class-Section → Class → Level.

**Due by day of month** on the fee package sets the payment deadline for **Create monthly bills**: for August fees, **10** means due on **10 August** (not the last day of the month, and not based on when you click generate).

You can **Edit** a fee package later (name, amounts, due-by day of month, etc.). Changes apply to **new** monthly bills; existing bills keep what they already had.

If only one fee package applies, monthly generation confirms without an extra choice screen.

### Late fees setup

Under **Late fees** on the same settings page:

1. Create (or pick) an active **Fee** package whose first line item is the late charge (flat amount or %).
2. Select that package as the **Late fee package**.
3. Turn on **Enable late fees for this branch**.
4. Save bill / fee settings.

When enabled, overnight processing adds the late charge once to each unpaid bill that is past its due date (and has no payment under review). The office manages charges on **Fees → Late fees**.

---

## 📄 Part 2: Monthly bills

**Path:** **Fees → Monthly bills**

### Generate for a class and month

1. Choose **class section** and **month**.
2. Click **Generate** (creates fee bills / challans).
3. If several packages could apply, confirm which one; if only one, generation starts immediately.
4. Bills appear on the roster.

### Mark as paid (cash)

On a student row with **Pending payment** (or **Rejected**), click **Mark as paid** to record cash at the desk and prepare a receipt.

### One-off individual bill

Use **Generate** on a student row for mid-month joins or temporary changes:

- Optional start date and due date override
- Exclude a fee item or override an amount for **this bill only**
- Next month uses the normal package again

### Download

- **Create monthly bills** saves the fee bill records quickly; PDFs are **not** built at that moment.
- Per student: **Download PDF** — the first click prepares the PDF (may take a few seconds), then opens it; later clicks reuse the cached file.
- Parents and students can download their own bills the same way from **My Fees**.
- There is **no** bulk ZIP of bill PDFs today
- If you regenerate or change a pending bill, the next download builds a fresh PDF

### Roster statuses

| Status | Meaning |
| --- | --- |
| **No bill** | Not generated for that month |
| **Pending payment** | Issued; waiting for payment or cash mark-paid |
| **Under review** | Parent submitted bank proof; staff must verify |
| **Verified** | Payment accepted; receipt available |
| **Rejected** | Proof rejected (reason recorded) |
| **Cancelled** | Bill cancelled |

---

## ⏱️ Late fees (admin)

**Path:** **Fees → Late fees**

Lists late charges applied to overdue unpaid bills.

| Element | Purpose |
| --- | --- |
| Summary chips | Active count/amount; waived this month |
| Filters | Month, class, status (All / Active / Waived), student search |
| **View bill** | Open the fee bill PDF |
| **Waive** | Remove the late charge (requires a reason). Only while the bill is still pending payment |

Parents and students see an **Includes late fee** badge on My Fees when a late charge is still active. The bill PDF line shows `Late fee (N days overdue)`.

If late fees are not configured, the tab shows a link to **Settings → Fee settings**.

---

## 💳 Part 3: Payment history (admin)

**Path:** **Fees → Payment history**

### Filters

- **Class** (class section; All)
- **Status** — defaults to **Under review** for the daily verify queue (switch to All as needed)
- **Date range**
- **Search student**

Summary badges: **Collected** and **Pending**. Use **Overdue balances** to open Fee reports.

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
| **Fee payment** | Pending challans — **Download PDF**, **Submit proof** (disabled while Under review); **Includes late fee** badge when applicable |
| **Payment history** | Past payments — **Receipt** when verified |

Submit proof fields: payment date, amount paid, method (Bank transfer / Cash), bank name, transaction reference, proof file (PNG / JPEG / PDF). Parents with several children see a **Student** column.

---

## 📊 Fee reports

**Path:** `/reports/fees` (page title **Fee reports**)

Also documented under [📊 Reports](reports.md). Not a separate sidebar item in all builds — bookmark or navigate directly.

Cards: **Collected (verified)**, **Pending**, **Under review**, **Overdue**. Table **Defaulters** lists student, challan, due date, amount.

School admin / principal; requires Fee management plan feature.

---

## 💡 Tips & Best Practices

- Set bank details and templates in **Fee settings** before the first month’s generate.
- Bulk-generate for the class; use individual generate only for exceptions.
- Process **Under review** rows promptly so parents get a receipt.
- Export XLSX for accounts reconciliation.

---

## 🆘 Troubleshooting

**Fees missing from the sidebar:** Check plan includes Fee management, and your role is allowed.

**Cannot mark paid:** On **Monthly bills**, use **Mark as paid** for cash at the desk. For bank transfer, the parent uploads proof and staff verifies under **Payment history**.

**Submit proof disabled:** Challan is already **Under review** — wait for staff to verify or reject.

**Late fees not applying:** Confirm **Enable late fees** and a late fee package are saved in **Fee settings**, the bill is unpaid and past due, and overnight processing is running for the environment.

**Cannot waive late fee:** Waive is only available while the bill is **Pending payment** (not under review or verified).

# 🥇 Report Cards

Short guide for staff who generate report cards and for parents who download published ones.

## 📋 Overview

Report Cards turn **assessment marks** into official PDF cards for parents. Staff work on the **Report Cards** page; parents see **published** cards under **My Child**.

| Audience | Where | What they can do |
| --- | --- | --- |
| Teachers / coordinators / admins with edit access | **Academics → Report Cards** | Filters, draft cards, remarks, publish / unpublish, PDF / ZIP download |
| Principals and view-only roles | **Report Cards** | View and download PDFs (no draft / publish) |
| Parents / guardians | **My Child** | Download **published** cards only |

There is **no** email or SMS send from this page in the portal today. Share PDFs yourself (download, print, or WhatsApp).

---

## 📑 Report kinds

| Report kind | Controls | Typical use |
| --- | --- | --- |
| **Term report** | **Status**: Mid-term / Final | Official mid-term and final cards |
| **Progress report** | **Month** (calendar month in the academic year) | Monthly academic snapshot for parents |

**Annual** reports are no longer offered for new cards. Any older published annual cards may still appear under **My Child**.

### Interim on the PDF (not a Status choice)

Staff do **not** pick Interim. The PDF **banner** shows **Interim** until every student in the class section has grades for the relevant **mid-term** or **final** term examinations (assessment types marked as term examinations and named for mid / final). When those exam grades are complete, the banner shows **Mid-term** or **Final** to match Status.

Marks readiness on the page uses the same exam rule.

---

## 🧑‍🏫 Staff: Report Cards page

**Path:** Sidebar → **Academics → Report Cards** (`/results`)

Class teachers only see class sections they own; other staff see available sections (capped in the list).

### Filters

1. **Class section** (if more than one is available)
2. **Academic year** (active year, read-only)
3. **Report type** — Term / Progress
4. **Status** (term only) — Mid-term / Final
5. **Month** (progress only)

### What you see after selecting a class

| Section | Content |
| --- | --- |
| **Exam marks readiness** (term) | Whether every student has grades for mid/final term exams for the selected Status |
| **Top students (overall %)** | Up to three students with the highest overall percentage (month-scoped for Progress) |
| **PDF layout** | **Minimal** or **Modern** |
| **Include assessment breakdown** | Off = subject totals only; on = each assessment listed |
| **Student table** | Student, Overall %, Report card status, Actions |

Bulk ZIP (term report + edit access only): **Download all Mid-term/Final (ZIP)** — **summary** PDFs only, **maximum 60 students** per request. Not available for Progress.

---

## 📄 PDF downloads

### Per student (Actions → Download report card)

Uses the page toggle **Include assessment breakdown** and the **PDF layout** choice.

| Toggle | Notes |
| --- | --- |
| Breakdown **off** | One-page summary (subject totals) |
| Breakdown **on** | Assessment breakdown. **Mid-term** = one page (assessments up to mid-term). **Final** = up to two pages: Mid-term section, then Final section (post-mid assessments only — not a duplicated full-year dump) |

### Bulk ZIP

- Term reports only
- Summary PDFs only
- Max **60** students
- Not available for Progress or breakdown PDFs

PDFs include subject marks, overall %, letter grades, class teacher remarks when a card exists, plus **Conduct** and **Attendance** summary values for the report window:

| Report | Conduct / attendance window |
| --- | --- |
| **Mid-term** | Academic year start → mid-exam cutoff (or today if no mid exams) |
| **Final** | After mid cutoff → year end (or full year if no mid exams) |
| **Progress (month)** | That calendar month within the academic year |

Conduct comes from the Behavioural module (star average as `X.X/5`, or the nearest framework scale label). Attendance shows present/total days and percentage. If nothing is recorded for the window, the PDF shows **—**.

Progress PDFs use assessments whose due date (or created date) falls in the selected **month**.

**Staff analytics:** the fuller academic + attendance + behaviour dossier for internal use remains under [📊 Reports → Student report](reports.md). The **Report Cards** page is the official **parent publish** path.

---

## 📝 Official cards (draft → publish → unpublish)

Use cards when you want a **class teacher comment** and parent visibility on **My Child**.

| Status on table | Meaning |
| --- | --- |
| **Not generated** | No card yet — PDF still available from current marks |
| **Draft** | Card created; remarks can be edited |
| **Published** | Visible to parents; remarks locked |

### Steps

1. Actions → **Create draft card** (or **Update draft from latest marks** if a card already exists). For Progress, the card is tied to the selected **month**.
2. Actions → open remarks → enter **Class teacher comment** → Save.
3. Actions → **Publish for parents** → confirm.
4. To withdraw: Actions → **Unpublish (return to draft)** — parents lose access; remarks can be edited again.

Regenerating a card returns it to **Draft**. There is **no** bulk create/publish and **no** subject-teacher remarks field.

For **Progress**, staff still create and publish only the **academic** card. Once that month is published, parents automatically get **Attendance** and **Behaviour** downloads for the same month (live data — no separate publish step).

---

## 👨‍👩‍👧 Parents: My Child

1. Open **My Child**.
2. Under each child, open **Published report cards**.
3. **Monthly progress packs** — for each published Progress month: three downloads (**Academic**, **Attendance**, **Behaviour**). Choose Minimal / Modern for academic PDFs.
4. **Term (and older annual) cards** — single academic PDF download each (those PDFs already include Conduct and Attendance summaries).

Empty state: **No published report cards yet.**

Parents do not use the staff Report Cards page for viewing. They also do not use **Reports → Student report** (staff only).

---

## 💡 Tips & Best Practices

- Check **Exam marks readiness** before treating a term PDF as Mid-term or Final (banner still says Interim until exams are complete).
- Download a sample PDF before sharing with parents.
- Prefer **assessment breakdown** for parent–teacher meetings; use summary or ZIP for quick class packs.
- Keep comments factual — they lock after publish until you unpublish.
- Publish the Progress month when you want parents to unlock the full monthly pack (academic + attendance + behaviour).

---

## 🆘 Troubleshooting

**I cannot create or publish cards:** You need edit access (typically via assessment permissions). Principals may see Report Cards but only download.

**Parent cannot see a card:** Status must be **Published**, and the parent must be linked to that student on **Mapping**. If you unpublished, the card is draft again.

**Parent cannot download Attendance / Behaviour for a month:** A Progress card for that month must be **Published**. Those PDFs are gated by the academic Progress publish, not by a separate workflow.

**Behaviour PDF is empty:** No behavioural ratings were recorded for that month — the download still opens with an empty-state message.

**ZIP button missing:** Only for **Term report**, with edit access, and within the 60-student limit.

**PDF still says Interim:** Mid/final term examination types may be missing, misnamed, or not fully graded for every student.

**Wrong layout:** Choose **PDF layout** on the page *before* downloading. Refresh if the toggle snaps back.

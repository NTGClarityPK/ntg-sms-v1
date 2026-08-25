# 🎯 Promotion & Placement

Record year-end outcomes for students — promote, repeat, graduate, and more. This is a controlled year-close process, not an everyday mid-year edit screen.

## 📋 Overview

**Path:** Sidebar → **Promotions** (`/promotion-placement`)

Visibility uses a dedicated **Promotion & Placement** permission (not the generic Students permission). School admins and principals typically have access; parents and students do not.

The module can also be turned off entirely under **Settings → Academic → Promotion & Placement**. When disabled, the sidebar link is hidden and saving decisions is blocked.

---

## 🔐 When you can use it

Promotion saving is only allowed when the **promotion window** is open:

| Condition | Effect |
| --- | --- |
| **Near year end** | Window opens automatically a set number of days before the academic year **end date** (default **45** days; configurable in Settings) |
| **Force-open** | A school admin can turn on **Force-open promotion window now** in Settings to allow saving earlier |
| **Module disabled** | All controls are locked; decisions cannot be saved |
| **Year locked** | Decisions for that year cannot be changed |

If the window is not open, the page shows a banner with the expected open date and disables Save and bulk actions.

---

## 📌 Outcomes (six)

| Outcome | Meaning |
| --- | --- |
| **Promoted** | Moves to a **target class** and **target section** (required) |
| **Repeated** | Stays in current class and section (replaces old “Retain” wording) |
| **Graduated** | Completed schooling path |
| **Transferred out** | Left for another school |
| **Withdrawn** | Withdrawn from enrolment |
| **Inactive** | Marked inactive |

---

## ✏️ Workflow

1. Confirm the promotion window is open (or ask a school admin to force-open it).
2. Select **Academic year** and a **Class-section** (required for bulk actions).
3. Set each student’s outcome (and targets for **Promoted**).
4. Optional bulk (only after a class-section is selected):
   - **Promote all** / **Repeat all** — fill the draft for that class-section
   - **Graduate all** — requires typing the class-section name to confirm
5. Click **Save**.
   - If you used a bulk action, a confirmation summary appears before decisions are written.
   - After confirm, decisions write **immediately** and update placement for that year.

Year locking / rollover remains blocked while any active student is missing a decision.

---

## ⚙️ Admin settings

**Path:** **Settings → Academic → Promotion & Placement**

| Setting | Purpose |
| --- | --- |
| **Enable Promotion & Placement module** | Show/hide the feature and allow/block saving |
| **Days before year end to open window** | How early the automatic window opens (default 45) |
| **Force-open promotion window now** | Override the date rule so authorised staff can save immediately |

Only **school admins** can change these settings.

---

## 💡 Tips & Best Practices

- Create destination class sections under **Class** before promoting.
- Prefer working **one class-section at a time** — bulk actions stay safer that way.
- Double-check outcomes before **Save** — placement updates immediately and there is no self-service undo.
- Use **Repeated** (not “retain”) when documenting hold-back.
- Complete promotions before you **Lock** the academic year.

---

## 🆘 Troubleshooting

**Cannot see Promotions in the sidebar:** Check that your role has **Promotion & Placement** permission, and that the module is enabled in Settings.

**Controls disabled / banner says window not open:** Wait until the open date, or ask a school admin to force-open the window.

**Bulk buttons greyed out:** Select a **Class-section** first.

**Cannot lock or roll the year:** Complete outcomes for every active student in that year.

**Related:** [🎓 Students](students.md), [🧩 Class](class-sections.md), [⚙️ Settings](settings-and-configuration.md), [📅 Academic Year Logic](../user-manual/academic-year-logic.md)

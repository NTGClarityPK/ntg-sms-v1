# ⚙️ Settings & Configuration

School-wide setup for NTG Alma — two rows of category and section tabs (not a sidebar list).

## 📋 Overview

**Path:** Sidebar → **Settings**

Typically managed by school admin, principal, or academic coordinator (section-dependent).

| Category | Sections (exact labels) |
| --- | --- |
| **School setup** | **Business Info**, **Communication**, **General** |
| **Academic** | **Academic**, **Schedule**, **Result reports** * |
| **Operations** | **Inventory**, **Integrations**, **Data export** * |
| **Finance** | **Fee settings** |
| **Appearance** | **Theme**, **Stats** * |
| **Access control** | **Permissions** |

\* **Result reports** — school admin / principal / super admin only (not plan-gated).
\* **Data export** — school admin / super admin only. See [💾 Data Export](data-export.md).
\* **Stats** — school admin only (public statistics password and URL).

Certificate branding lives on [🏆 Certificates](certificates.md) → **Settings**, not here.

---

## 🚀 First-time setup

New branches may see **Start school setup**:

- **Setup wizard** — guided first-run configuration
- **Copy settings from other branch** — when your school admin account has more than one branch

---

## 🏫 Business Info

School identity: name, code, domain, contact email/phone, timezone, fiscal year start, VAT, **Default language** (English UK / US / Arabic).

Users without a personal language follow this default after login. See [🔐 Authentication & Access](authentication-and-access.md).

---

## 💬 Communication

Messaging direction rules (teacher–student, teacher–parent both ways) and **branch broadcast** delegation for principals / admin assistants. Affects [📨 Messages](messages.md).

---

## ⚙️ General

**Not** classes or subjects — those sit under **Academic** (below).

| Block | Purpose |
| --- | --- |
| Leave quota | School-day quota for [🌴 Leaves](leaves.md) |
| Library categories | Used by [📚 Library](library.md) |
| Behavioural assessment | Enable / mandatory toggle and attributes — see [⭐ Behavioural](behavioural.md) |

---

## 🎓 Academic (section tab)

This one section stacks three areas:

1. **Academic years** — create years, mark **Active**, **Locked** when finalised; rollover rules apply at year-end
2. **Academic Settings** — inner tabs: **Subjects**, **Classes**, **Sections**, **Levels**, **Subject templates**
3. **Assessment Settings** — **Assessment types** and **Grade templates**

Use **Class** ([🧩 Class](class-sections.md)) after classes and sections exist.

---

## 🕐 Schedule

School days, timing templates, class timing assignments, public holidays, and **vacations**. Feeds timetable and early-departure time dropdowns.

---

## 📄 Result reports

Default PDF style (Minimal / Modern) and progress report window settings. Used by [🥇 Results](results.md).

---

## 📦 Inventory

Uniform/inventory categories and sizes for [👕 Inventory (Uniforms)](inventory-uniforms.md).

---

## 🔌 Integrations

Google Classroom and **Rubrics** presets — see [🏫 Google Classroom](google-classroom.md) and [📐 Rubrics](rubrics.md).

---

## 💵 Fee settings

Challan appearance and fee templates — see [💵 Fee Management](fee-management.md).

---

## 🎨 Theme

Portal colours and presentation.

---

## 📊 Stats

Public statistics **password** and branch URL for `/public/statistics/[branchCode]`. See [📊 Reports](reports.md).

---

## 🛡️ Permissions

Two inner tabs:

| Tab | Purpose |
| --- | --- |
| **Assign Access** | Matrix: roles × features with **None**, **View**, **Edit** (per branch) |
| **Role Access View** | Read-only summary counts per role |

School admin and super admin bypass the matrix and are not listed as rows.

Also on **Assign Access**: **student leave request** class picker — which classes may raise their own leave requests.

**Student + Assessment** cell is disabled (students use **My Assessments**, not staff Assessments).

Sidebar visibility = permissions + role checks + plan features (`hasFeeManagement`, `hasLibraryManagement`, etc.).

See [👥 User Roles](user-roles.md).

---

## 💡 Tips & Best Practices

- Use **Copy settings from other branch** when opening a new campus with the same structure.
- Lock academic years only after promotion decisions are complete.
- Change fee templates before generating next month’s challans.

---

## 🆘 Troubleshooting

**Section missing:** Check role (Result reports, Stats, Data export are restricted).
**Classes not on General:** Open **Academic** → Academic Settings → **Classes**.
**Certificate logo missing:** Use **Certificates → Settings**, not Settings nav.

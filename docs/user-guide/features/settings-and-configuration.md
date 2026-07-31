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

\* **Result reports** — school admin / principal only (not plan-gated).
\* **Data export** — school admin only. See [💾 Data Export](data-export.md).
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

### Subject templates

**Path:** **Settings → Academic** → Academic Settings → **Subject templates**

A **subject template** is a named group of subjects for a stream or track (for example Science Group vs Commerce Group). It tells Alma which subjects belong together for timetable generation, class-template assessments, and optional per-student assignment.

| Field | Purpose |
| --- | --- |
| **Template name** | Label shown in timetables and forms (e.g. Science Group) |
| **Description** | Optional note for staff |
| **Subjects** | Subjects included in this group |
| **Assign to Classes** *or* **Assign to Levels** | Where the template applies — pick classes **or** levels, not both |

**Create:** **New Template** → fill name and subjects → assign at least one class or one level → **Create**.

**Edit / delete:** Use **Edit** or **Delete** on the template card.

#### Where it links

| Place | How it uses the template |
| --- | --- |
| [🕐 Timetable](timetable-and-schedule.md) | Optional subject-template selector; **Generate from template** / copy can scope to one group |
| [🎓 Students](students.md) | Optional **Subject Template** on the student form — places a pupil in a stream |
| [📝 Assessments](assessments.md) | **Class template** creation mode builds assessments across matching sections |
| Student **My Timetable** | Students with no assignment may see **No Subject Template Assigned** |

**Without subject templates:** Stream-based classes can still have manual timetables and single-section assessments, but generate-from-template, class-template assessments, and per-student stream assignment will not work as intended.

---

## 🕐 Schedule

**Path:** **Settings → Schedule**

Blocks on this page:

1. **School days** — which weekdays the branch teaches
2. **Timing templates** — daily clock structure (see below)
3. **Public holidays** — dates for the active academic year
4. **Vacations** — longer non-teaching ranges for the year

### Timing templates

A **timing template** defines the school day clock: start time, end time, default **period duration (minutes)**, and optional non-teaching **slots** (Assembly, Break, Lunch, and similar).

School start and end times live **here**, not on Business Info. Create at least one template before relying on timetable generation or early-departure time lists.

| Field | Purpose |
| --- | --- |
| **Template name** | e.g. Morning schedule, Primary day |
| **School start time** / **School end time** | Overall day window |
| **Period duration (minutes)** | Default lesson length used when building grids |
| **Slots** (optional) | Named blocks with their own start/end (Assembly, Break, Lunch, …) via **Add Slot** |

**Create:** **New template** → set times and period length → add slots if needed → **Save**.

**Assign to classes:** On each template card, choose **Assigned classes** → **Save assignments**.

A class can belong to **only one** timing template at a time — classes already assigned elsewhere are hidden from other cards’ pickers.

#### Where it links

| Place | How it uses the template |
| --- | --- |
| [🕐 Timetable](timetable-and-schedule.md) | Period times and framework for class grids / generate |
| [🚶 Early Departure](early-departure.md) | Departure-time dropdown from school start–end |
| Setup completeness | Branch setup expects at least one timing template with start and end times |

**Without a timing template (or without assigning classes):** Timetable generate/copy for that class has no day framework; early-departure time lists can be empty (“School hours not configured”).

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

School admin bypasses the matrix and is not listed as a row.

Also on **Assign Access**: **student leave request** class picker — which classes may raise their own leave requests.

**Student + Assessment** cell is disabled (students use **My Assessments**, not staff Assessments).

Sidebar visibility = permissions + role checks + plan features (`hasFeeManagement`, `hasLibraryManagement`, etc.).

See [👥 User Roles](user-roles.md).

---

## 💡 Tips & Best Practices

- Use **Copy settings from other branch** when opening a new campus with the same structure.
- Create **Subjects**, **Classes**, and **Levels** before subject templates that reference them.
- Create timing templates early (often one per level or shift), then assign every teaching class.
- Lock academic years only after promotion decisions are complete.
- Change fee templates before generating next month’s challans.

---

## 🆘 Troubleshooting

**Section missing:** Check role (Result reports, Stats, Data export are restricted).
**Classes not on General:** Open **Academic** → Academic Settings → **Classes**.
**Certificate logo missing:** Use **Certificates → Settings**, not Settings nav.
**Cannot assign a class to a timing template:** That class is already on another template — remove it there first, then assign.
**Subject template form blocks save:** Assign at least one class **or** one level (classes and levels cannot both be filled).
**Early departure times empty / school hours not configured:** Create a timing template with start and end under **Schedule**, and assign the student’s class.
**Student timetable: No Subject Template Assigned:** Set **Subject Template** on the student record, or create templates under Academic Settings if none exist.

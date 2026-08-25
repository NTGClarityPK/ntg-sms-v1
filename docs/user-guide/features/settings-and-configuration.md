# ⚙️ Settings & Configuration

School-wide options for NTG Alma — identity, academic structure, timetable timing, fees, look and feel, and who can access what.

## 📋 Overview

**Path:** Sidebar → **Settings**

Usually managed by a school admin, principal, or academic coordinator (some sections are limited to certain roles).

Settings uses **two rows of tabs**:

1. Choose a **category** (for example **School setup** or **Academic**).
2. Then choose a **section** inside that category (for example **Business Info** or **Schedule**).

| Category | Sections you will see |
| --- | --- |
| **School setup** | **Business Info**, **Communication**, **General** |
| **Academic** | **Academic**, **Schedule**, **Promotion & Placement** |
| **Operations** | **Inventory** \*\*, **Integrations**, **Data export** * |
| **Finance** | **Fee settings** \*\* |
| **Appearance** | **Theme**, **Stats** * |
| **Access control** | **Permissions** |

\* **Data export** — school admin only. See [💾 Data Export](data-export.md).  
\* **Stats** — school admin only (password and link for public statistics).  
\*\* **Inventory** and **Fee settings** only appear when those modules are on your plan. Library categories and behavioural assessment under **General** are also omitted when not on the plan.

Certificate branding (logos and layout for certificates) lives on [🏆 Certificates](certificates.md) → **Settings**, not under this Settings menu.

---

## 🚀 First-time setup

### When you see this

After a new school or campus is created — or when that campus’s essential configuration is still incomplete — Settings may show a prompt such as **Start school setup**.

### What the setup wizard is

The **setup wizard** is a guided, step-by-step checklist. It walks you through the first things a campus needs so you do not have to hunt through every Settings tab alone. Typical steps cover:

- Academic year
- Subjects, classes, sections, and levels
- School days and day timing
- Assessment basics
- Messaging rules
- Related essentials (such as behavioural settings, when used)

Think of it as a “getting started” tour that saves your choices as you go.

### Copy settings from another campus

If your school already has another campus set up, and you are a **school admin** on more than one campus, you may see **Copy settings from other branch**. That copies structure from the campus you already configured, instead of building everything from scratch.

### If you do not see the banner

Open **Sidebar → Settings** and configure the sections below in a sensible order. The **Tips** section at the end of this page suggests a practical sequence.

---

## 🏫 Business Info

Your school’s identity on this campus: name, code, domain, contact email and phone, timezone, fiscal year start, VAT, and **Default language** (English UK, English US, or Arabic).

People who have not chosen a personal language follow this default after login. See [🔐 Authentication & Access](authentication-and-access.md).

---

## 💬 Communication

Rules for who can message whom (for example teacher–student and teacher–parent in both directions), and whether principals or admin assistants may send **branch broadcasts**. These settings affect [📨 Messages](messages.md).

---

## ⚙️ General

This is **not** where you create classes or subjects — those sit under **Academic** (below).

| Block | What it is for |
| --- | --- |
| Leave quota | How many school days of leave apply for [🌴 Leaves](leaves.md) |
| Library categories | Shown only when your plan includes library management. Categories used by [📚 Library](library.md) |
| Behavioural assessment | Shown only when your plan includes behavioural tracking. Turn scoring on or off, choose star-based or framework-based rating, and manage attributes or framework categories — see [⭐ Behavioural](behavioural.md) |

---

## 🎓 Academic (section tab)

This category includes:

1. **Academic years** — create years, mark one **Active**, and **Lock** a year when it is finalised; year-end rollover rules then apply
2. **Schedule** — school days, timing templates, holidays, vacations
3. **Promotion & Placement** — enable the module, set how many days before year end the promotion window opens, and optionally force-open it early (school admins only). See [🎯 Promotion & Placement](promotion-and-placement.md).

**Academic Settings** (subjects, classes, sections, levels, subject templates) and **Assessment Settings** sit under the Academic years / structure area as before.

After classes and sections exist, day-to-day class lists also appear under [🧩 Class](class-sections.md).

### Words used under Academic Settings

| Term | Plain meaning |
| --- | --- |
| **Subject** | What is taught (for example Mathematics or English) |
| **Class** | A year group or form label (for example Grade 5 or Year 8) |
| **Section** | A split of a class (for example Grade 5-A and Grade 5-B) |
| **Level** | A **stage group** that bundles related classes — for example Primary, Secondary, or Foundation. Levels make it easier to apply the same subjects, fees, or templates across several classes at once |

Create subjects, classes, sections, and levels before you rely on subject templates that point at them.

### Subject templates

**Path:** **Settings → Academic** → Academic Settings → **Subject templates**

#### What and why

A **subject template** is a named group of subjects for a stream or track (for example Science Group vs Commerce Group). It tells Alma which subjects belong together for timetable tools, class-template assessments, and optional per-student stream assignment.

#### Fields

| Field | Purpose |
| --- | --- |
| **Template name** | Label shown in timetables and forms (for example Science Group) |
| **Description** | Optional note for staff |
| **Subjects** | Subjects included in this group |
| **Assign to Classes** *or* **Assign to Levels** | Where the template applies — pick classes **or** levels, not both |

**Create:** **New Template** → fill name and subjects → assign at least one class or one level → **Create**.

**Edit / delete:** Use **Edit** or **Delete** on the template card.

#### Where it is used

| Place | How it uses the template |
| --- | --- |
| [🕐 Timetable](timetable-and-schedule.md) | Optional subject-template selector; generate or copy can focus on one group |
| [🎓 Students](students.md) | Optional **Subject Template** on the student form — places a pupil in a stream |
| [📝 Assessments](assessments.md) | **Class template** mode can build assessments across matching sections |
| Student **My Timetable** | Students with no assignment may see **No Subject Template Assigned** |

**Without subject templates:** You can still build manual timetables and single-section assessments, but generate-from-template, class-template assessments, and per-student stream assignment will not work as intended.

---

## 🕐 Schedule

**Path:** **Settings → Schedule**

Blocks on this page:

1. **School days** — which weekdays this campus teaches
2. **Timing templates** — the daily clock structure (see below)
3. **Public holidays** — dates for the active academic year
4. **Vacations** — longer non-teaching date ranges for the year

### Timing templates

#### What and why

A **timing template** defines the school day clock: start time, end time, default **period duration (minutes)**, and optional non-teaching **slots** (Assembly, Break, Lunch, and similar).

School start and end times live **here**, not under Business Info. Create at least one template before you rely on timetable generation or early-departure time lists.

#### Fields

| Field | Purpose |
| --- | --- |
| **Template name** | For example Morning schedule or Primary day |
| **School start time** / **School end time** | Overall day window |
| **Period duration (minutes)** | Default lesson length when building grids |
| **Slots** (optional) | Named blocks with their own start and end (Assembly, Break, Lunch, …) via **Add Slot** |

**Create:** **New template** → set times and period length → add slots if needed → **Save**.

**Assign to classes:** On each template card, choose **Assigned classes** → **Save assignments**.

A class can belong to **only one** timing template at a time — classes already assigned elsewhere are hidden from other cards’ pickers.

#### Where it is used

| Place | How it uses the template |
| --- | --- |
| [🕐 Timetable](timetable-and-schedule.md) | Period times and framework for class grids and generate |
| [🚶 Early Departure](early-departure.md) | Departure-time list drawn from school start–end |
| Setup completeness | Branch setup expects at least one timing template with start and end times |

**Without a timing template (or without assigning classes):** Timetable generate/copy for that class has no day framework; early-departure time lists can be empty (“School hours not configured”).

---

## 📦 Inventory

Shown only when your plan includes inventory management. Uniform and inventory categories and sizes for [👕 Inventory (Uniforms)](inventory-uniforms.md).

---

## 🔌 Integrations

Google Classroom and **Rubrics** presets — see [🏫 Google Classroom](google-classroom.md) and [📐 Rubrics](rubrics.md).

---

## 💵 Fee settings

Shown only when your plan includes fee management. Challan appearance and fee templates — see [💵 Fee Management](fee-management.md).

---

## 🎨 Theme

Portal colours and presentation for this school.

- **Colour mode** — choose **Light** or **Dark** for your portal. Click **Save changes** to keep the preference on this device. You can also switch quickly with the sun/moon button in the top bar.
- **Logo** — upload the school logo shown in the header.
- **Theme colour** — set the school brand colour used across the portal.

---

## 📊 Stats

Password and link for a **public statistics page** for this campus (useful when you want to share high-level figures without full portal login). See [📊 Reports](reports.md).

---

## 🛡️ Permissions

Two inner tabs:

| Tab | What it does |
| --- | --- |
| **Assign Access** | A grid of roles × features. For each cell choose **None**, **View**, or **Edit** (per campus) |
| **Role Access View** | A simple summary of how much access each role has |

School admin is not limited by this grid and is not listed as a row.

Also on **Assign Access**: a **student leave request** class picker — which classes may raise their own leave requests.

The **Student + Assessment** cell is disabled (students use **My Assessments**, not the staff Assessments area).

What appears in the sidebar depends on permissions, role checks, and your school’s plan (some modules such as fees or library may be hidden if they are not on the plan).

See [👥 User Roles](user-roles.md).

---

## 💡 Tips & Best Practices

- Use **Copy settings from other branch** when opening a new campus with the same structure.
- Create **Subjects**, **Classes**, and **Levels** before subject templates that reference them.
- Create timing templates early (often one per level or shift), then assign every teaching class.
- Lock academic years only after promotion decisions are complete.
- Change fee templates before generating next month’s challans.
- Sensible first-pass order if you are configuring by hand: **Business Info** → **Academic** (year, then subjects/classes/sections/levels) → **Schedule** → assessments → **Permissions** → fees and other modules as needed.

---

## 🆘 Troubleshooting

**A Settings section is missing:** Check your role. Stats and Data export are restricted. Fee settings, Inventory, library categories, and behavioural assessment only appear when they are included in your plan.

**I cannot find Classes under General:** Open **Academic** → Academic Settings → **Classes**.

**Certificate logo missing:** Use **Certificates → Settings**, not this Settings menu.

**Cannot assign a class to a timing template:** That class is already on another template — remove it there first, then assign.

**Subject template will not save:** Assign at least one class **or** one level (you cannot fill both at once).

**Early departure times empty / school hours not configured:** Create a timing template with start and end under **Schedule**, and assign the student’s class.

**Student timetable: No Subject Template Assigned:** Set **Subject Template** on the student record, or create templates under Academic Settings if none exist.

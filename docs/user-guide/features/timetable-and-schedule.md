# 🕐 Timetable & Schedule

Class timetables, teacher weekly slots, and parent/student personal views.

## 📋 Overview

| View | Path | Who |
| --- | --- | --- |
| **Timetable** | `/timetable` | Staff — pick class section grid |
| **Class timetable** | `/timetable/class/{id}` | Deep link for one section |
| **My Schedule** | `/my-schedule` | Teachers — weekly slots |
| **My Timetable** | `/my-timetable` | Students (teachers redirect to My Schedule) |
| **Children Timetable** | `/children-timetable` | Parents — **own child selector** on page |
| **Conflict management** | `/conflict-management` | Admin/coordinator timetable conflicts |

Schedule settings (days, templates, holidays): **Settings → Schedule**.

Timing templates (school start/end, period length, breaks) and subject templates (subject groups / streams) are explained under [⚙️ Settings & Configuration](settings-and-configuration.md).

---

## 🗓️ Timetable (staff)

1. Open **Timetable**.
2. Select **class section** (teachers may see only their class-teacher sections; admins see all).
3. Review weekly grid.

Editors can:

- **Generate from template** — create slots from a **subject template** (optional selector on the grid; templates are defined under **Settings → Academic → Subject templates**)
- **Copy** day or **copy from another section** (copy can also scope to a subject template)
- Add/edit/remove slots
- Show **substitution (SUB)** badges when enabled on the grid

Class period times come from the **timing template** assigned to that class on **Settings → Schedule**.

---

## ⏰ My Schedule vs My Timetable

- **My Schedule** — teacher period-by-period week linked to [👨‍🏫 Staff](staff.md) assignments.
- **My Timetable** — student view; linked from [🏠 Dashboard](dashboard.md).

---

## 👨‍👩‍👧 Children Timetable (parents)

**Path:** **Children Timetable** — includes a **child dropdown** on the page (does not rely on **My Child** alone). Header child switcher still applies for other child-mode pages.

---

## ⚠️ Conflict management

Review timetable clashes surfaced for the branch — use before publishing wide changes.

Teacher substitution display: see [🔄 Teacher Substitution](teacher-substitution.md).

---

## 💡 Tips & Best Practices

- Configure [timing templates and subject templates](settings-and-configuration.md) before generating grids.
- Generate from template after **Mapping → Teacher–Class** is complete.
- Copy from a pilot section when rolling out a new year group.

---

## 🆘 Troubleshooting

**Empty timetable:** No slots — run generate or copy; confirm active academic year.
**Generate fails / no day framework:** Assign a **timing template** to the class under **Settings → Schedule**.
**Teacher sees one section only:** Expected for class teachers without admin timetable scope.
**Parent timetable wrong child:** Use the selector on **Children Timetable**.
**No Subject Template Assigned (student view):** Set the optional subject template on the student, or create templates under **Settings → Academic**.

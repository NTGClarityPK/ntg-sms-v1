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

---

## 🗓️ Timetable (staff)

1. Open **Timetable**.
2. Select **class section** (teachers may see only their class-teacher sections; admins see all).
3. Review weekly grid.

Editors can:

- **Generate from template** — create slots from subject template
- **Copy** day or **copy from another section**
- Add/edit/remove slots
- Show **substitution (SUB)** badges when enabled on the grid

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

- Generate from template after **Mapping → Teacher–Class** is complete.
- Copy from a pilot section when rolling out a new year group.

---

## 🆘 Troubleshooting

**Empty timetable:** No slots — run generate or copy; confirm active academic year.
**Teacher sees one section only:** Expected for class teachers without admin timetable scope.
**Parent timetable wrong child:** Use the selector on **Children Timetable**.

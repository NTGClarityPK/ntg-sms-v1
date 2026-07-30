# 👨‍🏫 Staff

How staff accounts, teaching assignments, and schedules work in NTG Alma.

## 📋 Overview

There is **no separate Staff list page**. Opening **Staff** sends you to **Users**, where you create and manage staff accounts. Teaching assignments and weekly timetables live elsewhere.

| Need | Where |
| --- | --- |
| Create / invite / edit staff users | **Users** |
| Assign teachers to classes and subjects | **Mapping → Teacher–Class** |
| Weekly timetable for yourself | **My Schedule** (teachers) |
| Assignment summary for one teacher | `/staff/{id}/schedule` (class teacher of / subject assignments — not a day/time grid) |

---

## 👥 Users (staff administration)

**Path:** Sidebar → **Users** (or **Staff**, which redirects here)

Use **Users** to:

- Invite and manage staff with teaching or admin roles
- Filter by role and account status
- Resend invitations when a link has expired
- Activate or deactivate accounts

Staff typically sign in with the login email shown after invitation setup (often username@school-domain). Parents use their own email accounts. Mixing parent and staff roles on one account is not allowed.

For permission levels, see [👥 User Roles](user-roles.md).

---

## 🗺️ Teacher–Class mapping

**Path:** **Mapping → Teacher–Class**

(Legacy **Teacher mapping** and **Parent associations** URLs redirect into **Mapping** tabs.)

- **List view** or **Matrix view**
- **Create assignment** to link a teacher to a subject and class section
- Matrix: fill teachers across subject × class-section cells

Class teacher vs subject teacher badges appear on the per-teacher schedule summary page.

---

## 🗓️ Schedules

### My Schedule (teachers)

**Path:** Sidebar → **My Schedule**

Shows your **weekly timetable slots** and free periods for the current branch and academic year. You need a linked staff record; otherwise the page explains that none was found.

Students use **My Timetable** instead (teachers are redirected from that route to **My Schedule**).

### Teacher schedule summary (assignments)

**Path:** `/staff/{id}/schedule` (opened from admin flows as **Teacher Schedule: {name}**)

Lists:

- **Class Teacher Of** — class and section
- **Subject Assignments** — subject and class section

This is **not** a period-by-period timetable. For day/time grids, use **My Schedule** or the main **Timetable** module.

---

## 💡 Tips & Best Practices

- Invite staff from **Users**, then assign teaching load under **Mapping** before expecting **My Schedule** to fill.
- Confirm the active academic year and branch when a schedule looks empty.
- Use timetable admin tools for conflict checks; assignment pages alone do not show period clashes.

---

## 🆘 Troubleshooting

**Staff menu opens Users:** Expected — staff records are managed on **Users**.

**My Schedule is empty:** Confirm branch, academic year, teacher mapping, and that a timetable exists for your assignments.

**I only see class/subject lists, not times:** You are on the assignment summary (`/staff/.../schedule`). Open **My Schedule** for weekly slots.

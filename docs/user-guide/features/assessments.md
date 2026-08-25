# 📝 Assessments

Create assessments, enter grades, view statistics, and export examination schedules.

## 📋 Overview

| Audience | Path | Purpose |
| --- | --- | --- |
| Staff (assessment permission) | **Assessments** | List, create, edit, grades, statistics |
| Students / parents | **My Assessments** | View class assessments, materials, examination schedule |

There is **no** standalone assessment “detail” page — use list actions → **Grades** or **Statistics**.

Assessment types and grade templates: **Settings → Academic** → Assessment Settings.

---

## 📄 Assessments list

**Tabs:** **All assessments** | **Examination schedule**

Filters: search, class section, subject, published state, assessment type, teacher, **due/exam date range**. Pagination. Row menu: view grades, statistics, edit, delete, export schedule PDF (where offered).

On **Examination schedule**, the same date range narrows the timetable and PDF export.

---

## ➕ Create assessment

**Assessments → Create** (edit permission)

Three creation modes:

| Mode | Use |
| --- | --- |
| **Single Class Section** | One class-section + subject |
| **Class template** | From a [subject template](settings-and-configuration.md) across matching sections |
| **Class Sections** | Pick multiple sections for the same class |

Fields include title, type, due date/time, total marks, publish flag, attachments (compressed on create), and Google Classroom link when integrated.

---

## 🧮 Grades and rubrics

**Grades** page: enter marks per student. Attach an Alma rubric from **Settings → Integrations** presets; expand criterion rows **after** saving the base grade. Google Classroom–linked assessments show read-only Classroom rubrics — **Pull grades** to sync.

---

## 📈 Statistics

Per-assessment summary and status indicators for class performance (open from list → **Statistics**).

---

## 📅 Examination schedule

**Examination schedule** tab: filter and **Export PDF** for the branch examination timetable.

---

## 👨‍🎓 My Assessments (students / parents)

**Path:** Sidebar → **My Assessments** (or student dashboard links)

Tabs: assessments list and examination schedule. Download attachments, update status where allowed. Parents/students in **child session** see the selected child’s assessments.

Not a teacher workload view — teachers use **Assessments** list and dashboard **Pending grading**.

---

## 🆘 Troubleshooting

**Create missing:** Assessment **Edit** permission required.
**My Assessments empty:** Wrong child context or nothing published for the class.
**Rubric row won’t expand:** Save base grade first — see [📐 Rubrics](rubrics.md).

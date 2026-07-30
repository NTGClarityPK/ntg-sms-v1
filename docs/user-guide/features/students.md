# 🎓 Students

Complete guide to student management in NTG Alma.

## 📋 Overview

Student records are used across the portal for:

- Attendance
- Assessments and results
- Timetable views
- Reports
- Parent association flows

{% @mermaid/diagram content="graph TB
A[Student Profile] --> B[Class Section]
A --> C[Attendance]
A --> D[Assessments/Grades]
A --> E[Reports]
A --> F[Parent Associations]
A --> G[Uniform Requests (if enabled)]" %}

## 👥 Student List

### Viewing students

**Steps:**

1. Go to **Students**
2. Search/filter (where available)
3. Open a student record to view details

## 🧾 Bulk Import

NTG Alma includes a bulk import entry under Students for importing student data (where enabled).

### Importing students

**Typical steps:**

1. Go to **Students → Bulk Import**
2. Download a sample/template file (if provided)
3. Fill the spreadsheet
4. Upload and import
5. Review any validation errors and retry

## 🔗 Parent Associations (Related)

To link parents to students, use the Parent Associations feature.

## 🆘 Troubleshooting

**Students page is empty:**

- Confirm you’re in the correct branch context
- Confirm an active academic year is configured
- Confirm your role has permission to view students


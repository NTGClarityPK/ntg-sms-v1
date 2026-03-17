# Attendance

Complete guide to attendance workflows in the NTG School Management System (SMS).

## 📋 Overview

Attendance in SMS supports:

- Attendance overview (by permitted scope)
- Attendance marking (role-based)
- Attendance history
- Child attendance views for parent/student context

{% @mermaid/diagram content="graph TB
A[Attendance] --> B[Overview]
A --> C[Mark Attendance]
A --> D[History]
A --> E[Child View (Parent/Student Context)]
C --> F[Save]
F --> G[Notifications (if enabled)]
D --> H[Reports]" %}

## ✅ Attendance Overview

### Viewing attendance

**Steps:**

1. Go to **Attendance**
2. Select date/class context (where applicable)
3. Review attendance status list

## ✍️ Mark Attendance

Marking is available only to roles with the relevant permission.

### Marking attendance for a class

**Steps:**

1. Go to **Attendance → Mark**
2. Select the class section (if prompted)
3. Mark attendance for students
4. Save

## 🕒 Attendance History

### Viewing history

**Steps:**

1. Go to **Attendance → History**
2. Filter by student/class/date range (where available)
3. Review historical entries

## 👨‍👩‍👧‍👦 Child Attendance (Parent/Student Context)

Parents (and student context) can view child attendance via the child-specific attendance page.

**Steps:**

1. Ensure the correct child is selected (My Children)
2. Go to **Attendance → Child**
3. Review attendance for the selected child

## 🆘 Troubleshooting

**Mark page not visible:**

- Your role may have view-only access for attendance

**Data doesn’t match expectations:**

- Confirm branch context and active academic year
- Confirm you’re viewing the correct class section/date


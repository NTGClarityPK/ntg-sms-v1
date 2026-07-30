# 👨‍👩‍👧 Parent Associations

Complete guide to linking parents/guardians to student records in NTG Alma.

## 📋 Overview

Parent associations enable parent-facing experiences:

- Selecting a child (“My Children”)
- Viewing child-specific attendance/timetable pages
- Raising leave and early departure requests for a selected child

{% @mermaid/diagram content="graph TB
A[Parent] --> B[Link to Student]
B --> C[My Children]
C --> D[Child Context]
D --> E[Child Timetable]
D --> F[Child Attendance]
D --> G[Leave Requests]
D --> H[Early Departure]" %}

## 🔗 Linking a Parent to a Student

### Create or update associations

**Steps:**

1. Go to **Parent Associations**
2. Search for the parent (or guardian user)
3. Select the student(s) to link
4. Save

### Unlinking

**Steps:**

1. Go to **Parent Associations**
2. Open the parent record
3. Remove the student link
4. Save

## 👨‍👩‍👧‍👦 My Children (Parent View)

Parents can use **My Children** to view and select a child context.

**Steps:**

1. Go to **My Children**
2. Select a child
3. Navigate to child-specific modules as needed

## 🆘 Troubleshooting

**Parent can’t see My Children or child pages:**

- Confirm the parent account has the Parent role
- Confirm the association exists for the current branch
- Confirm the parent is not currently in a restricted context


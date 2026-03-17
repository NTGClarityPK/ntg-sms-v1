# Reports & Results

Complete guide to reports and results pages in the NTG School Management System (SMS).

## 📋 Overview

Reports and results provide insights and downloadable outputs (where enabled) across academics and operations.

Portal pages include:

- Reports index
- Student reports (including student-specific route)
- Class reports (including class-specific route)
- Administrative reports
- Public reports/statistics (branch-code based route)
- Results page

{% @mermaid/diagram content="graph TB
A[Reports] --> B[Student]
A --> C[Class]
A --> D[Administrative]
A --> E[Public Statistics]
F[Results] --> G[Results Views]" %}

## 📊 Reports (Portal)

### Reports index

**Steps:**

1. Go to **Reports**
2. Select the relevant report category (student/class/administrative)

### Student Reports

Student report views can be accessed via:

- Student reports route
- Direct student report page (by student id) where permitted

### Class Reports

Class report views can be accessed via:

- Class reports list
- Direct class report page (by class section) where permitted

### Administrative Reports

Administrative reports are available to authorised roles only.

## 🌍 Public Reports / Statistics

SMS includes a public statistics route that is accessed by a branch code.

**Use cases:**

- Public, anonymised statistics (no login) depending on branch configuration

## 🏅 Results

Use **Results** to view results-related pages made available for your role.

## 🆘 Troubleshooting

**I can’t see a report type:**

- Your role may not have access
- Confirm branch context and active academic year

**Public statistics not accessible:**

- Confirm the branch code is correct


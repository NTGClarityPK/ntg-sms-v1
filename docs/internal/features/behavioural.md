# Behavioural

Complete guide to the behavioural module in the NTG School Management System (SMS).

## 📋 Overview

The behavioural module provides:

- Behavioural overview page
- Behavioural assessment entry flow (role-limited)

{% @mermaid/diagram content="graph TB
A[Behavioural] --> B[Overview]
A --> C[Assess Behaviour]
C --> D[Submit]
D --> E[Available in Reporting (where enabled)]" %}

## ⭐ Behavioural Overview

### Viewing behavioural information

**Steps:**

1. Go to **Behavioural**
2. Review behavioural summaries and available views

## ✍️ Behavioural Assessment Entry

Behavioural entry is only available to roles that can assess behaviour.

**Steps:**

1. Go to **Behavioural → Assess**
2. Select the scope (class/student) if prompted
3. Enter behavioural ratings/values as required by the form
4. Submit

## 🆘 Troubleshooting

**Assess page not visible:**

- Your role may not be permitted to assess behavioural data

**No items to assess:**

- Confirm active academic year and branch context
- Confirm behavioural settings are enabled/configured


# Inventory (Uniforms)

Complete guide to inventory and uniform-related workflows in the NTG School Management System (SMS).

## 📋 Overview

Inventory in SMS focuses on uniform-related inventory management and requests:

- Inventory dashboard entry
- Items list
- Requests list
- Issuance history
- Parent-facing uniform request page

{% @mermaid/diagram content="graph TB
A[Inventory] --> B[Items]
A --> C[Requests]
A --> D[History]
E[Parent] --> F[Uniform Request]
F --> C
C --> G{Review/Process (Staff)}
G --> H[Update Status]
H --> D" %}

## 📦 Inventory Overview

**Steps:**

1. Go to **Inventory**
2. Use the subpages to navigate:
   * Items
   * Requests
   * History

## 🧾 Items

### Viewing items

**Steps:**

1. Go to **Inventory → Items**
2. Review available items and stock information shown

## 📋 Requests

### Viewing requests

**Steps:**

1. Go to **Inventory → Requests**
2. Review incoming requests and their statuses

## 🕒 History

### Viewing issuance/history

**Steps:**

1. Go to **Inventory → History**
2. Filter by student/item/date (where available)
3. Review past issuances

## 🧍 Uniform Request (Parent)

Parents can raise uniform requests through **Uniform Request**.

**Steps:**

1. Go to **Uniform Request**
2. Select child (if prompted)
3. Choose items/sizes (as presented by the portal)
4. Submit request

## 🆘 Troubleshooting

**Uniform Request not visible:**

- Confirm your role is Parent (and not in restricted context)
- Confirm inventory is enabled for the current branch


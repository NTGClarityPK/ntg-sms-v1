# Early Departure

Complete guide to early departure request workflows in the NTG School Management System (SMS).

## 📋 Overview

Early departure requests support:

- Parent raising an early departure request for a child
- Staff reviewing and approving/rejecting requests (role-based)

{% @mermaid/diagram content="graph TB
A[Early Departure Request] --> B[Create (Parent)]
B --> C[Pending]
C --> D{Review (Staff)}
D -->|Approve| E[Approved]
D -->|Reject| F[Rejected]" %}

## ➕ Create an Early Departure Request (Parent)

**Steps:**

1. Go to **Early Departure**
2. Select your child (if prompted)
3. Click to raise a request
4. Enter:
   * Date
   * Departure time
   * Reason
   * Attachment (if enabled)
5. Submit

## ✅ Review an Early Departure Request (Staff)

**Steps:**

1. Go to **Early Departure**
2. Filter to **Pending** (where available)
3. Open the request
4. Choose **Approve** or **Reject**
5. Add review notes (if available) and confirm

## 🆘 Troubleshooting

**I can’t raise a request:**

- Confirm your child is linked and selected
- Confirm branch context

**Approve/Reject missing:**

- Your role may not have permission to review requests


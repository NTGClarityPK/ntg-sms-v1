# Leaves

Complete guide to leave request workflows in the NTG School Management System (SMS).

## 📋 Overview

Leave requests support:

- Parent raising a leave request for a child
- Staff reviewing and approving/rejecting requests (role-based)
- Parent cancelling a pending leave request (where allowed)
- Leave quota visibility (configured in Settings)

{% @mermaid/diagram content="graph TB
A[Leave Request] --> B[Create (Parent)]
B --> C[Pending]
C --> D{Review (Staff)}
D -->|Approve| E[Approved]
D -->|Reject| F[Rejected]
C -->|Cancel (Parent)| G[Cancelled]" %}

## ➕ Create a Leave Request (Parent)

**Steps:**

1. Go to **Leaves**
2. Select your child (if prompted)
3. Click **Raise a request**
4. Enter:
   * Leave date range
   * Reason
   * Attachment (if enabled)
5. Submit

## ✅ Review a Leave Request (Staff)

**Steps:**

1. Go to **Leaves**
2. Filter to **Pending** (where available)
3. Open the request
4. Choose **Approve** or **Reject**
5. Add review notes (if available) and confirm

## ❌ Cancel a Leave Request (Parent)

Cancellation is typically available only for pending, unreviewed requests.

**Steps:**

1. Go to **Leaves**
2. Find the request
3. Click **Cancel**

## 🧾 Leave Quota

Leave quota is configured in Settings and can be displayed alongside leave request creation and review.

## 🆘 Troubleshooting

**I can’t create a leave request:**

- Confirm you have a linked child
- Confirm you are in the correct branch

**Approve/Reject actions missing:**

- Your role may not have reviewer permissions


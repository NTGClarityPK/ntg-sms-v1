# 🔔 Notifications

Complete guide to notifications in NTG Alma.

## 📋 Overview

Notifications provide a unified place to track updates across the portal.

Notifications are available via:

- Notification bell (header)
- Notifications page with tabs

{% @mermaid/diagram content="graph TB
A[Notification Created] --> B[Notification Bell]
A --> C[Notifications Page]
C --> D[Tabs: All/Unread/Read/Attendance]
B --> E[Unread Count]
B --> F[Mark All Read]" %}

## 🔔 Notification Bell

The header bell shows:

- Unread count
- A quick list preview (where enabled)
- Actions such as “Mark all read” and “View all notifications”

## 📄 Notifications Page

### Viewing notifications

**Steps:**

1. Go to **Notifications**
2. Switch between tabs:
   * All
   * Unread
   * Read
   * Attendance
3. Open items as needed

### Marking notifications as read

**Steps:**

1. Use the single-item action (where available), or
2. Use **Mark all read** to clear unread items

## 🆘 Troubleshooting

**Unread count is not updating:**

- Refresh the page
- Confirm network connectivity
- Confirm branch context (some notification types are branch-scoped)


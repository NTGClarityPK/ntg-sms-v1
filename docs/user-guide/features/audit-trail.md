# 🧾 Audit Trail

Platform-level log of create / update / delete actions for NTG operations.

## 📋 Overview

**Path:** **Admin Portal → Audit Trail** (`/adminportal/audit-trail`)

**Super admin only.** Not available to school admins and not in the school portal sidebar.

---

## 🔍 Filters and table

Filters: **Username**, **Table**, **Action**, **Start Date**, **End Date**.

Actions: **Create**, **Update**, **Delete**.

Columns: Timestamp, Action, Table, Record ID, User, Branch, Details.

Detail view may include changed fields, old/new values, IP address, and user agent when recorded.

---

## 🆘 Troubleshooting

**Cannot see Audit Trail:** You need a **super admin** Admin Portal session — school portal roles never unlock this page.

# 📅 Events

School events, optional parent consent, and personal **My Events**.

## 📋 Overview

| Path | Audience |
| --- | --- |
| **Events** | Staff — list, create, edit, delete |
| **My Events** | Students, parents, staff — events relevant to you |

List filters: status (All / Upcoming / Past), **Requires consent**, date range.

Status badges: **Upcoming**, **Ongoing**, **Past**. Conflict warnings may appear when events overlap assessments or other events.

---

## 📅 Events list (staff)

1. Open **Events**.
2. Filter by status, consent flag, or dates.
3. Row actions: view, edit, delete.

**Note:** The search box is visible but **not wired** to the API in the current build — use status and date filters instead.

---

## ➕ Create and edit

**Events → Create** (edit permission): title, dates, description, audience, **Requires consent** flag, and related fields on the form.

When **Requires consent** is on, parents respond through the consent workflow (approve/decline) tied to **My Events** and notifications.

**Edit** and **Delete** are available from the event detail/list menus for permitted roles.

---

## 🙋 My Events

**Path:** Sidebar → **My Events**

Shows events for your role — including consent prompts for parents when required.

Also linked from the [🏠 Dashboard](dashboard.md) parent and teacher panels.

---

## 💡 Tips & Best Practices

- Enable **Requires consent** for trips that need a parental yes/no.
- Check conflict badges before publishing overlapping exam weeks.

---

## 🆘 Troubleshooting

**Search does nothing:** Known limitation — filter by date/status until search is connected.
**Create missing:** Events **Edit** permission.
**Parent sees no consent:** Event may not require consent, or child context is wrong.

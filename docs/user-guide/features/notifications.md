# 🔔 Notifications

In-app alerts, the header bell, and push subscription settings.

## 📋 Overview

Notifications are **per user** (not filtered by branch). You see them in the header bell and on the **Notifications** page.

| Entry point | What it does |
| --- | --- |
| Header **bell** | Unread badge (caps at **99+**), latest items, mark all read, open full page |
| **Notifications** page | Two tabs: **All notifications** and **Notification settings** |
| User menu → **Enable Notifications** | Opens **Notification settings** |

Realtime updates refresh the bell when new rows arrive for your account. Optional browser **push** is configured on the Settings tab.

---

## 🔔 Notification bell

- Bell icon when alerts are enabled; muted icon when disabled (toggle in the dropdown).
- Red badge = unread count.
- Dropdown lists the latest notifications (about five).
- **Mark all read** and **View All Notifications**.
- Shortcut to enable push if not subscribed.

Clicking a notification opens a deep link when one exists (for example attendance, leaves, events, messages, assessments, early departure).

---

## 📄 Notifications page

### All notifications

Filter chips **inside** this tab (not separate top-level tabs):

| Chip | Meaning |
| --- | --- |
| **All** | Everything |
| **Unread** | Not yet read |
| **Read** | Already read |
| **Attendance** | Attendance-related items |

Open an item to mark it read and follow its link. Use **Mark all read** to clear the unread set.

### Notification settings

Controls **push notifications** only:

- Browser support message (if unsupported)
- Permission status (granted / denied / default)
- Whether you are subscribed
- **Allow notifications** / **Disable push notifications**

There is no per-category preference matrix on this tab — only push permission and subscription.

URL hint: `/notifications?tab=settings`.

---

## 💡 Tips & Best Practices

- Enable push on devices you use for duty cover and leave approvals.
- Use the Attendance chip when chasing daily mark reminders.
- On the messages screen, some message toasts may be suppressed so chat is not interrupted.

---

## 🆘 Troubleshooting

**Unread count stuck:** Refresh; confirm you are online. Notifications are not tied to the selected branch — switching branch will not hide another user’s items (each user has their own list).

**No push prompt:** Check browser permission (especially Safari), then use **Allow notifications** on **Notification settings**.

**Bell shows IconBellOff:** Alerts were disabled in the dropdown — turn them back on there or under Settings.

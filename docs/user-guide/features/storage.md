# 🗄️ Storage

Admin view of storage usage, large files, alerts, and offline browser cache.

## 📋 Overview

**Path:** **Admin → Storage**

Storage is for administrators who need to understand how file space is used for the school and to clear old offline cache data.

| Tab | Who | Purpose |
| --- | --- | --- |
| **Overview** | Admins with Storage access | High-level usage |
| **Breakdown** | Same | Usage by category |
| **Largest files** | Same | Biggest stored objects |
| **Alerts** | Same | Storage warnings |
| **Cache** | **Super admin only** | Offline storage size and clear old documents |

Non–super-admins who open the Cache tab are sent back to **Overview**.

Uploads can be blocked when the school is over quota — free space or remove large files if uploads fail with a storage message.

---

## 📴 Offline cache (replaces Offline Documents)

The former **Offline Documents** page redirects here. Offline copies kept in the browser (report PDFs, related offline types) are summarised on **Cache**:

1. Open **Admin → Storage → Cache**.
2. Review **Offline storage used**.
3. Optionally **Clear documents older than 30 days**.

There is no separate offline documents catalogue in the shipped UI. See also [📴 Offline Documents](offline-documents.md).

---

## 💡 Tips & Best Practices

- Check **Largest files** before blaming a single module for quota pressure.
- Use **Cache** clear on shared kiosk devices so old offline PDFs do not accumulate.

---

## 🆘 Troubleshooting

**Storage not in the menu:** Restricted to roles with admin Storage access.

**Cache tab missing:** Only **super admin** can open Cache.

**Upload failed with storage error:** Free quota via Breakdown / Largest files, or ask your platform operator to raise the plan limit.

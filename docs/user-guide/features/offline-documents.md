# 📴 Offline Documents

Offline document browsing is **not a separate portal page**.

## 📋 Overview

The old **Offline Documents** menu destination now **redirects to Storage**. Client-side offline copies (for example report PDFs saved in the browser) are managed under the Storage **Cache** tab for super administrators.

| Old path | What happens |
| --- | --- |
| **Offline Documents** / `/offline-documents` | Redirects to **Admin → Storage** |

There is no standalone list of offline files for everyday teachers or parents in the current portal.

---

## 🗄️ Where to manage offline cache

**Path:** **Admin → Storage → Cache** (super admin only)

On **Cache** you can see:

- **Offline storage used** (size of documents held in the browser’s offline store)
- **Clear documents older than 30 days**

For usage quotas, largest files, and alerts, see [🗄️ Storage](storage.md).

---

## 🆘 Notes

- Offline availability still depends on the browser / PWA and what was saved on that device.
- If you bookmarked Offline Documents, update the bookmark to **Storage**.

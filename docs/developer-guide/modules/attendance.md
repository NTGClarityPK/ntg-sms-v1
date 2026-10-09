# ✅ Attendance

**Product:** NTG Alma  
**Audience:** Developers

User-facing steps live in the User Guide. This page covers the offline marking outbox and sync path.

## 📋 Overview

Mark attendance uses the existing NestJS bulk API. Offline support is a **frontend outbox** in IndexedDB — not a separate sync product, not Next.js API routes, and not Workbox API caching.

## 🧱 Offline marking architecture

```
Teacher tap
  → React state (instant)
  → IndexedDB attendance_outbox (instant)
  → if online: debounced flushOutbox()
       → POST /api/v1/attendance/bulk
  → if offline: stay pending until online / focus / Save / Retry
```

Roster for a class+date is cached in IndexedDB (`attendance_roster_cache`) after a successful online load of `GET /api/v1/attendance/class/:id/date/:date`.

### Background roster warmup

After portal login, `AttendanceRosterWarmup` quietly prefetches **today’s** rosters for **class/subject teachers** who have attendance **edit**, limited to sections where they are the class teacher (same scope as Mark Attendance).

Safe limits:
- Today only (local date)
- Max 20 sections
- Concurrency 2
- Starts ~4s after ready + `requestIdleCallback`
- Skips sections that already have a fresh cache
- Once per branch+date+staff session
- Does **not** warm school-wide lists for admins

### Key files

| File | Role |
|------|------|
| `frontend/src/lib/offline/db.ts` | Shared `ntg-sms-offline` DB (v3); documents + attendance stores |
| `frontend/src/lib/offline/attendance-outbox.ts` | Outbox + roster cache helpers |
| `frontend/src/lib/offline/attendance-sync.ts` | `flushOutbox()` → bulk API |
| `frontend/src/lib/offline/attendance-roster-warmup.ts` | Prefetch helper |
| `frontend/src/hooks/useAttendanceRosterWarmup.ts` | Portal warmup trigger |
| `frontend/src/hooks/useOfflineAttendance.ts` | Merge outbox, cache, flush triggers |
| `frontend/src/components/features/attendance/SyncStatusBar.tsx` | Offline / syncing / error / saved UI |
| `backend/.../attendance` | Unchanged for v1 — reuse `POST /bulk` |

### Constraints

- Do not re-enable Workbox `runtimeCaching` for authenticated APIs or app navigations.
- Sync runs on the **main thread** (Bearer + branch headers). No Nest calls from the service worker.
- Last-write-wins on the server (existing upsert). No schema change.
- If IndexedDB is unavailable, Save falls back to online-only bulk mutation.

### Internal design notes

Longer design notes: `docs/offline-first.md` (internal).

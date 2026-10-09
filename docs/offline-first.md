# Offline-First Attendance Marking

Internal implementation plan. Adapted for NTG Alma’s real stack — not a greenfield PWA.

## Problem

Teachers mark attendance on phones in classrooms with weak or no internet. Every tap must save instantly on the device and never be lost. Sync to the server happens in the background when the network is back.

## What we already have (do not rebuild)

| Piece | Where | Notes |
|---|---|---|
| PWA (`@ducanh2912/next-pwa`) | `frontend/next.config.js` | SW register is **manual**, portal-only; `runtimeCaching: []` on purpose (avoids stale login/shell bugs) |
| `idb` | already in `frontend/package.json` | Used by offline documents |
| IndexedDB helper | `frontend/src/lib/offline/db.ts` | DB name `ntg-sms-offline`, version 2, documents store only |
| Online detection | `frontend/src/hooks/useOnlineStatus.ts` | Reuse |
| Axios offline guard | `frontend/src/lib/api-client.ts` | Rejects when `!navigator.onLine` — outbox must write **before** any API call |
| Bulk attendance API | `POST /api/v1/attendance/bulk` | NestJS; upserts by `student_id,date,academic_year_id` |
| Marking UI | `AttendanceSheet` + `useBulkMarkAttendance` | Local state + Save button → bulk POST |

**Do not install:** Serwist, Dexie, another PWA plugin, or React Query persistence.  
**Do not add:** Next.js `app/api/...` routes for attendance (backend is NestJS).  
**Do not re-enable** broad Workbox page/API caching.

---

## Design (simple version)

```
Teacher taps Present/Absent/...
        │
        ▼
  Write / update IndexedDB outbox   ← instant, always
  Update UI state                   ← instant
        │
        ▼
  If online → flush outbox via existing bulk API
  If offline → stay pending; flush later on reconnect / focus
```

Roster for the day is also cached in IndexedDB so the student list still appears when offline. Teachers with attendance edit get **today’s** class-teacher sections warmed in the background after portal login (capped, low concurrency); opening a class online still refreshes the cache.

---

## Scope (keep small)

**In scope**
- Offline outbox for attendance marks
- Roster + existing marks cache for the selected class + date
- Main-thread sync when online / tab focused / after Save
- Small sync status strip on the marking sheet
- Light NestJS changes only if `/bulk` needs per-record outcomes (prefer extending bulk, not a parallel sync product)

**Out of scope (for now)**
- Offline grades, leaves, early departure
- Aggressive SW caching of pages or authenticated APIs
- Fancy multi-teacher conflict UI
- Background Sync API as a hard requirement (nice-to-have on Android only)

---

## Part 1 — IndexedDB (extend existing offline DB)

**File:** `frontend/src/lib/offline/db.ts` (version bump 2 → 3)  
**New helpers:** `frontend/src/lib/offline/attendance-outbox.ts`  
**Optional thin re-exports:** keep documents code untouched.

Add two stores to `ntg-sms-offline` (same DB as documents — one IDB database, less complexity):

### Store: `attendance_outbox`

- `keyPath`: `localId` (client UUID)
- Indexes: `by-status` (`syncStatus`), `by-class-date-student` (`[classSectionId, date, studentId]`)

```ts
{
  localId: string
  classSectionId: string
  studentId: string
  date: string                 // YYYY-MM-DD (session date from UI, not “now” per tap)
  status: 'present' | 'absent' | 'late' | 'excused'
  entryTime: string | null
  exitTime: string | null
  notes: string | null
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error'
  errorMessage: string | null
  createdAt: number
  updatedAt: number
  attemptCount: number
  serverRecordId: string | null
}
```

**Upsert rule:** same `classSectionId + date + studentId` → update in place (same `localId`). Re-taps do not create duplicates.

### Store: `attendance_roster_cache`

- `keyPath`: `cacheKey` (`{classSectionId}:{date}`)
- Fields: students snapshot + existing server marks + `cachedAt` / `expiresAt` (e.g. 24h)

### Exported operations

- `upsertOutbox(...)` / `getPendingRecords()` / `getOutboxForClassDate(...)`
- `markAsSyncing` / `markAsSynced` / `markAsError`
- `clearSyncedRecords(olderThanMs)` — e.g. 7 days; **never** auto-delete pending/error
- `cacheRoster` / `getCachedRoster` / `invalidateRosterCache`

Wrap every IDB call in try/catch. If IDB is unavailable (some private browsing): fall back to today’s online-only Save path and show a calm warning — no crash.

---

## Part 2 — Sync engine (main thread)

**File:** `frontend/src/lib/offline/attendance-sync.ts`

`flushOutbox()`:

1. Bail if `syncInProgress` (module flag) or empty pending set  
2. Mark fetched rows `syncing`  
3. Group by `classSectionId + date`  
4. For each group call **existing** Nest endpoint:

   `POST /api/v1/attendance/bulk`  
   body: `{ classSectionId, date, records: [...] }`  
   (same shape as `BulkMarkAttendanceInput`)

5. On success → `markAsSynced` for those local rows (map returned attendance ids by `studentId` if present)  
6. On failure → `markAsError`, bump `attemptCount`  
7. Stop auto-retry after 5 attempts; manual Retry resets and tries again  
8. `401` → refresh session once, then retry that batch; do not count as a permanent failure  
9. Clear old **synced** rows after flush

**Triggers (all main thread):**

- After writing outbox, if online → `flushOutbox()` (debounced ~500ms so rapid taps batch)
- `window` `online` event (debounce ~2s)
- `visibilitychange` / focus when online (iOS-friendly)
- Explicit Retry / Save

**Why not sync inside the Service Worker?**  
Our API needs Bearer + branch headers from the app session. Putting Nest calls in the SW is fragile. Main-thread flush is enough for classroom use. Optional later: Background Sync tag that only posts a message to open clients to call `flushOutbox()`.

**Axios note:** Do not call `apiClient` while offline — the interceptor already rejects. Outbox write is the offline path; flush only when `navigator.onLine`.

---

## Part 3 — Backend (minimal)

Prefer **reusing** `POST /api/v1/attendance/bulk`.

Today’s bulk upsert already last-writes-wins. That is acceptable for v1.

Only add a dedicated `POST /api/v1/attendance/sync` if we need per-record `{ localId, outcome, serverRecordId, error }` without changing bulk clients. If added:

- NestJS module only (`attendance.controller.ts` / service / DTO)
- Auth + branch + feature access same as bulk
- Still map to the existing `attendance` table columns — **no schema change**
- Conflict policy: keep simple — **last write wins** (matches current upsert). Skip elaborate “other teacher newer updatedAt” UI unless product asks for it later.

Do **not** invent Next.js route handlers under `app/api/`.

---

## Part 4 — Hook + UI wiring

**Hook:** `frontend/src/hooks/useOfflineAttendance.ts`  
(or fold into attendance flow used by `MarkAttendanceContent` / `AttendanceSheet`)

UI talks to this hook (or a thin wrapper), not to IndexedDB directly.

### Behaviour change vs today

Today: taps only update React state; **Save** POSTs everything.

Target:

1. Each status / time / notes change → update React state **and** `upsertOutbox` (instant).
2. While online, debounced `flushOutbox` keeps server warm; Save still flushes remaining pending and gives clear feedback.
3. While offline, Save still succeeds locally (“Saved on this device — will sync when online”).
4. On open: load roster from network if online and refresh cache; else use roster cache. Merge outbox over server marks for pending/syncing/error rows.

Reuse `useOnlineStatus`. Reuse existing attendance queries for network load when online.

### Sync status UI

**Component:** `frontend/src/components/features/attendance/SyncStatusBar.tsx`

- Mantine only, theme tokens, `useTranslations('attendance')` — no hardcoded colours/emojis as product copy
- Never disable mark controls because of sync
- States: offline / syncing N / N failed + Retry / brief “All saved” then hide
- Optional small warning icon on a student row if that row is `error`

Fit into existing `AttendanceSheet` layout; do not redesign the sheet.

---

## Part 5 — Service worker

**Leave `runtimeCaching: []` alone** unless we later prove a safe, narrow exception.

Do **not** cache authenticated `/api/v1/*` in Workbox (auth headers + stale private data). Roster offline = IndexedDB cache filled by the app, not SW HTTP cache.

Do **not** register SW on auth pages (already handled).

Optional later (Android only): Background Sync tag → message clients → `flushOutbox()`. Not required for MVP.

---

## Edge cases (must handle)

| Case | Behaviour |
|---|---|
| Re-tap / change status | Upsert same outbox row; one pending record |
| Two teachers, same class | Rare; server upsert last-write-wins (same as today) |
| Student added after cache | Accept until next online open (network refresh then) |
| Date boundary | Date fixed from UI selection / mount for that sheet session |
| Large class (60+) | Batch by class+date; IDB indexes |
| Days offline | Pending never auto-deleted |
| IDB missing | Online-only fallback + warning |
| App killed mid-mark | Outbox already has taps; reload merges them back |
| Network flicker | Debounce + `syncInProgress` guard |

---

## File map (this repo)

```
frontend/src/lib/offline/db.ts                 ← bump version, add stores
frontend/src/lib/offline/attendance-outbox.ts  ← outbox + roster cache ops
frontend/src/lib/offline/attendance-sync.ts    ← flushOutbox()
frontend/src/hooks/useOfflineAttendance.ts     ← UI-facing API
frontend/src/components/features/attendance/
  SyncStatusBar.tsx
  AttendanceSheet.tsx                          ← wire outbox + status bar
frontend/src/hooks/useAttendance.ts            ← keep bulk mutation; used by flush
backend/src/modules/attendance/                ← only if per-record sync response needed
frontend/messages/*.json                       ← sync status strings (all locales)
```

---

## Hard constraints

- Frontend → NestJS → DB (no Supabase attendance writes from the browser)
- TypeScript strict; no `any`
- Mantine + i18n for any new UI text
- Outbox/sync modules must stay free of React if we ever call them from a worker later; for MVP, main-thread-only is fine
- Do not change the `attendance` table schema
- Do not break document offline (`offline_documents` store)
- Marking must feel instant — never put a loading spinner on the status buttons for sync

---

## Implementation order

1. IDB stores + outbox helpers  
2. `flushOutbox` → existing `/api/v1/attendance/bulk`  
3. Wire `AttendanceSheet` (tap → outbox, online flush, SyncStatusBar)  
4. Roster cache on successful online load  
5. Manual QA: airplane mode mark → reconnect → verify server  
6. Docs: short note in user-guide attendance + developer attendance module when shipping  

---

## Verdict vs the original Claude draft

| Claude suggestion | Our call |
|---|---|
| Install `idb` | Already present — skip |
| Next.js `app/api/attendance/sync` | Wrong stack — NestJS `/api/v1/attendance` |
| New DB `alma-attendance` | Extend `ntg-sms-offline` instead |
| Workbox NetworkFirst for roster/pages | Skip — conflicts with deliberate empty runtime cache |
| Sync inside SW + Background Sync required | Main-thread flush; BG Sync optional later |
| Heavy conflict resolution API | Overkill for v1 — keep bulk upsert last-write-wins |
| Per-tap outbox + status bar | **Keep** — this is the core fix |
| Edge-case list | **Keep** (trimmed) |

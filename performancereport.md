## Performance Audit Report – Batch 1 (Attendance + Notifications)

This document captures the first batch of the performance audit for the School Management System, focused on **Attendance** and **Notifications** (backend, frontend hooks, and Axios timeout behaviour). No application code has been changed yet; this is purely an analysis plus remediation plan.

---

### P0 (Critical) Issues

#### Issue #1: Attendance report endpoint can fetch 10,000+ rows per request

**Location**: `backend/src/modules/attendance/attendance.service.ts:980-1037`

**Problem**:

The `generateAttendanceReport` method forces `listAttendance` to return up to **10,000 records** in a single call, bypassing the normal pagination limit:

- It calls `listAttendance({ ...query, page: 1, limit: 10000 }, branchId, academicYearId)`.
- `listAttendance` itself:
  - Fetches full rows with `select('*', { count: 'exact' })`.
  - Then performs multiple additional joins (students, profiles, class_sections, classes, sections, markedBy profiles).
- After fetching all records, it:
  - Computes summary counts (present/absent/late/excused) using `.filter(...)` in Node.
  - Derives `startDate`/`endDate` by sorting all dates in memory.

**Why It’s Slow**:

- For large branches and wide date ranges this can:
  - Perform very heavy work in Supabase/Postgres.
  - Transfer a **large payload** (thousands of hydrated rows) over the network.
  - Run multiple passes over the full dataset in Node (CPU time).
- Combined with the global **10s Axios timeout**, if this endpoint is used for wide-range reports it can easily approach or exceed the timeout under load.

**Fix (pattern)**:

- Replace the “fetch 10,000 hydrated rows” approach with a **server-side aggregation** endpoint:
  - Use a grouped query to return:
    - Counts per `status` (`present`, `absent`, `late`, `excused`).
    - Date min/max for the filtered range.
    - Optional class/section details via small lookups (one query each).
  - Only fetch full records in **paged** form, or via a streaming export endpoint if required for CSV/Excel.
- Enforce a **configurable maximum rows** for any “full list” style report (e.g. 2,000), and either:
  - Reject the request with a clear error if filters are too broad, or
  - Require the user to narrow filters (date range, class-section, etc.).

**Impact (estimate)**:

- Before:
  - Up to **10,000 hydrated attendance rows** with multiple joins.
  - End-to-end time for large datasets can reach **3–8 seconds**, especially under concurrency.
- After:
  - Single aggregated query plus 1–3 small lookups → typically **<500ms** for summaries.
  - Paged/full-record exports can be streamed or limited to smaller, more predictable chunks.
- Expected improvement: **5–10x faster** for wide-range reports, with much lower risk of hitting the 10s timeout.

**DB / Index Notes (to verify in Supabase)**:

- Recommended indexes (subject to actual schema):
  - `attendance(branch_id, academic_year_id, date, class_section_id)`
  - `attendance(student_id, branch_id, academic_year_id, date, status)`
  - These align with the main report and summary filters (branch, year, dates, status).

---

### P1 (High) Issues

#### Issue #2: Attendance summaries scan all rows instead of using aggregates

**Location**:

- `backend/src/modules/attendance/attendance.service.ts:817-899` – per-student summary.
- `backend/src/modules/attendance/attendance.service.ts:901-977` – per-class summary.

**Problem**:

- Both `getAttendanceSummaryByStudent` and `getAttendanceSummaryByClass`:
  - Fetch **all matching attendance rows** (only `status` column, which is good).
  - Compute counts for each status using multiple `.filter(...).length` passes in Node:
    - `presentDays`, `absentDays`, `lateDays`, `excusedDays`, `totalDays`.
  - Compute percentage on the Node side.

**Why It’s Slow**:

- For a full academic year or long date range:
  - The database returns **one row per day** for that student or class.
  - Node then does several passes through the entire array.
- These summary endpoints are likely used frequently (dashboards, student detail pages, parent views), so the overhead multiplies with load.

**Fix (pattern)**:

- Move the counting into the database using aggregation:
  - Use a grouped query per status, e.g. conceptually:
    - `select status, count(*) from attendance where ... group by status`.
  - Build the summary counts from the small grouped result set (at most 4 rows).
- Apply this pattern both:
  - Per student.
  - Per class-section.

**Impact (estimate)**:

- Before:
  - For a year with ~180 school days → ~180 rows per student/class summary call.
  - Multiple full-array passes in Node.
- After:
  - At most 4 grouped rows (one per status).
  - Single pass to build the DTO.
- Expected improvement:
  - **10–50x less data** transferred from DB to backend.
  - **2–5x faster** latency per call, especially under high concurrency.

**DB / Index Notes (to verify)**:

- Ensure composite indexes are present to support these queries efficiently:
  - `attendance(student_id, branch_id, academic_year_id, date, status)`
  - `attendance(class_section_id, branch_id, academic_year_id, date, status)`

---

#### Issue #3: Notifications unread-count hook performs two list queries every 30 seconds

**Location**: `frontend/src/hooks/useNotifications.ts:56-82`

**Problem**:

- `useUnreadCount` is implemented by:
  - Calling `/api/v1/notifications?limit=1` (all statuses) and reading `meta.total`.
  - Calling `/api/v1/notifications?isRead=true&limit=1` and reading `meta.total` again.
  - Subtracting to compute unread count.
- The query runs with `refetchInterval: 30000`, so **every 30 seconds**:
  - Each client runs **two full list queries** (albeit with `limit=1` but still using `count: 'exact'`).

**Why It’s Slow / Wasteful**:

- Backend `listNotifications` selects `*` with `count: 'exact'` for both calls.
- For N active users:
  - Each user triggers **2× listNotifications** every 30 seconds.
  - Load on the notifications table (and RLS checks) grows linearly with active sessions.
- The client only needs a **single integer** (unread count), but triggers two relatively heavy queries to get it.

**Fix (pattern)**:

- Backend:
  - Introduce a dedicated endpoint, e.g. `GET /api/v1/notifications/unread-count`, which:
    - Runs a single aggregate count: `count(*) where user_id = :userId and is_read = false`.
    - Returns `{ data: { unreadCount: number } }`.
- Frontend:
  - Update `useUnreadCount` to call the new endpoint:
    - One lightweight query per 30 seconds instead of two list calls.

**Impact (estimate)**:

- Before:
  - 2 count-enabled list queries per user every 30 seconds.
  - At 200 concurrent users → ~800 queries per minute just for unread counts.
- After:
  - 1 small aggregate query per user every 30 seconds.
  - ~400 much cheaper queries per minute in the same scenario.
- Expected improvement:
  - **2–4x reduction** in query load on `notifications`.
  - Lower latency and more headroom for other features.

**DB / Index Notes (to verify)**:

- Ensure index: `notifications(user_id, is_read, created_at)`.
  - Supports both unread-count and ordered listing efficiently.

---

### P2 (Medium) Issues

#### Issue #4: Attendance list & detail endpoints use sequential independent queries

**Location**:

- `backend/src/modules/attendance/attendance.service.ts:47-272` – `listAttendance`.
- `backend/src/modules/attendance/attendance.service.ts:274-423` – `getAttendanceByClassAndDate`.
- `backend/src/modules/attendance/attendance.service.ts:425-574` – `getAttendanceByStudent`.

**Problem**:

- The service methods fetch related entities (students, profiles, class_sections, classes, sections, marked_by profiles) using:
  - Multiple separate `await` calls executed **one after another**.
- Examples:
  - In `listAttendance`, once attendance rows are fetched, the code:
    - Gets students, then derives `studentUserIds`, then fetches profiles.
    - Fetches class_sections, then classes, then sections.
    - Fetches markedBy profiles.
  - In `getAttendanceByClassAndDate`, after attendance:
    - Fetches class_section details.
    - Then students in that class/section.
    - Then profiles, class, section, mostly sequentially.

**Why It’s Slower Than Necessary**:

- Many of these queries are **independent** once the relevant IDs are known.
- Executing each one sequentially incurs a **separate network round-trip** (latency) and Supabase overhead.
- On high-traffic endpoints (class/day attendance, lists) this unnecessary sequentialisation adds up.

**Fix (pattern)**:

- Refactor to use `Promise.all` for independent queries:
  - In `listAttendance`:
    - After computing `studentIds`, `classSectionIds`, `markedByIds`, run:
      - `students` and `class_sections` in parallel.
    - After getting `studentsData` and `classSectionsData`, run:
      - `profiles` (for students), `classes`, `sections`, and `markedByProfiles` in parallel.
  - In `getAttendanceByClassAndDate`:
    - After `classSectionDetails` and `studentsData` are known, call:
      - `profiles`, `class`, and `section` queries in a single `Promise.all`.

**Impact (estimate)**:

- Expected to cut **20–40%** of the latency for these endpoints:
  - Same total DB work, but less wall-clock time waiting for sequential network hops.
- Especially valuable for:
  - Class attendance fetch while marking.
  - Attendance history/list screens with pagination.

**DB / Index Notes (to verify)**:

- Confirm indexes on:
  - `students(id, branch_id, class_id, section_id, is_active)`.
  - `class_sections(id, class_id, section_id)`.
  - `profiles(id)` (primary key).

---

#### Issue #5: `updateAttendance` rehydrates a single record via a full list call

**Location**: `backend/src/modules/attendance/attendance.service.ts:749-815`

**Problem**:

- After updating a single attendance row, `updateAttendance` calls `listAttendance` with `{ page: 1, limit: 1 }` to get a hydrated DTO, and then:
  - Looks for the updated ID inside that first-page result.
- This triggers:
  - An extra paginated query with `select('*', { count: 'exact' })`.
  - All of `listAttendance`’s relation lookups and data combining work.
- There is no guarantee the updated record even appears on the first page for the current sort order, which is why extra guards are needed.

**Why It’s Inefficient**:

- For a **single** updated record, the method effectively:
  - Performs a full “list with joins” call, which was designed for paginated browsing.
  - Does not explicitly constrain the list to the updated ID.
- Every update now costs *two* DB round-trips:
  - The update itself.
  - A heavy list call to rehydrate.

**Fix (pattern)**:

- Introduce a targeted “hydrate by ID” approach:
  - After the update returns `updated`, call a dedicated helper that:
    - Starts from that single `AttendanceRow`.
    - Fetches the necessary related entities (student, profile, class_section, class, section, marked_by profile).
    - Constructs an `AttendanceDto`.
  - This is much cheaper than a generic list call and always returns the right record.

**Impact (estimate)**:

- Before:
  - Update = 1 `update` query + 1 `listAttendance` query (with joins).
- After:
  - Update = 1 `update` query + 1 lightweight “hydrate by id” query group.
- Expected improvement:
  - **2–3x faster** for single-record updates.
  - Lower DB load, especially when many updates are performed back-to-back.

---

#### Issue #6: Notifications list API always returns full payload; notifications page double-fetches

**Location**:

- Backend list: `backend/src/modules/notifications/notifications.service.ts:33-103`.
- Frontend page: `frontend/src/app/notifications/page.tsx:22-42`.

**Problem**:

- Backend:
  - `listNotifications` always does `select('*', { count: 'exact' })` which returns:
    - All columns: `id, user_id, type, title, body, data, is_read, created_at`.
    - Including potentially large `data` JSON payloads.
- Frontend:
  - Notifications page calls `useNotifications` twice:
    - Once for all notifications (`limit: 100`).
    - Once for only `type: 'attendance'` (`limit: 100`).
  - The second fetch is only used to display an attendance-only tab, but this could be derived from the already loaded full list.

**Why It’s Suboptimal**:

- Extra queries:
  - 2 identical-style list calls per page view instead of 1.
- Over-fetching:
  - The second call fetches the same data the first call already contains (just filtered differently).

**Fix (pattern)**:

- Backend:
  - Keep `listNotifications` as-is for the main list (since the page uses all fields).
  - Optionally add a “light” variant in future if more lightweight consumers appear.
- Frontend:
  - Derive the attendance-only list from `allNotifications`:
    - `const attendanceNotifications = allNotifications.filter(n => n.type === 'attendance');`
  - Remove the second `useNotifications` call in the page.

**Impact (estimate)**:

- Before:
  - Two list calls (all + attendance) for each visit to `/notifications`.
- After:
  - One list call; attendance tab reuses already-fetched data.
- Expected improvement:
  - **~50% reduction** in notifications list queries for this page.

---

### P3 (Lower, but Notable) Observations

#### Positive Patterns Already in Place

- **Bulk attendance marking is already well optimised and non-blocking**:
  - Uses a single `upsert` with `onConflict: 'student_id,date,academic_year_id'` for all records.
  - Returns all upserted rows with `select(...)`.
  - Sends attendance notifications using `void this.notificationsService.createAttendanceNotification(...).catch(...)`, so:
    - Notification creation runs in the background.
    - The main attendance save response is **not blocked** by notification failures or latency.
- **Frontend bulk attendance UX is robust**:
  - `AttendanceSheet`:
    - Shows a clear loading state while attendance data is loading.
    - Disables the “Save Attendance” button and guards against double-submit with `if (bulkMarkMutation.isPending) return;`.
  - `useBulkMarkAttendance`:
    - Overrides Axios timeout to **30 seconds** specifically for bulk saves.
    - Has timeout-aware error handling that:
      - Shows a “saving is taking longer than expected” message.
      - Triggers a best-effort refetch after a short delay to detect late completion.

These patterns directly mitigate the “request timed out but data saved” behaviour for bulk attendance saves and are worth reusing for other heavy operations.

---

### Timeout & Axios Configuration – Current Risks

**Location**: `frontend/src/lib/api-client.ts`

- The global Axios instance is configured with a **10 second timeout** for all requests.
- Only the bulk attendance save override in `useBulkMarkAttendance` extends this timeout to 30 seconds.
- This means:
  - Heavy endpoints such as attendance reports (Issue #1) or future bulk operations (imports, assessments) are still constrained to 10 seconds.
  - Under load or with broad filters, these endpoints are at risk of timing out on the client side while still finishing successfully on the server.

**Recommended policy (for later implementation)**:

- Keep the **global 10s timeout** as a sensible default for ordinary CRUD requests.
- For known heavy operations:
  - Either extend timeout per-request (like bulk attendance).
  - Or design them as background/async jobs with:
    - A “start job” mutation.
    - A polling or WebSocket-based “check status” mechanism.

---

### DB & Supabase Considerations (Attendance + Notifications)

Since DDL files are not present in the repo, these are **verification tasks** to run in Supabase for this batch:

- **Attendance table**:
  - Verify or add composite indexes aligned with your frequent query patterns:
    - `attendance(branch_id, academic_year_id, date, class_section_id)`.
    - `attendance(student_id, branch_id, academic_year_id, date, status)`.
  - Ensure these indexes are compatible with RLS predicates (no expressions that prevent index use).
- **Notifications table**:
  - Verify or add:
    - `notifications(user_id, is_read, created_at)`.
    - `notifications(user_id, type, created_at)` if type-based filtering is common.
- **RLS policies**:
  - Attendance: ensure policies filter by `branch_id` and academic year in a way that aligns with the above indexes.
  - Notifications: ensure policies match `user_id = auth.uid()` or equivalent, avoiding complex subqueries that may harm index usage.

---

### Recommended Implementation Order for This Batch

1. **P0 – Rework attendance report implementation**  
   - Remove the `limit: 10000` pattern and switch to server-side aggregation + a safe row cap.
   - Verify/add the suggested attendance indexes.

2. **P1 – Convert attendance summaries to aggregated queries**  
   - Update per-student and per-class summary endpoints to use grouped counts in SQL, not full scans.

3. **P1 – Add dedicated notifications unread-count endpoint**  
   - Implement a single aggregate count endpoint and switch `useUnreadCount` to use it.

4. **P2 – Remove redundant notifications list call from notifications page**  
   - Derive attendance-only notifications from the existing `allNotifications` query.

5. **P2 – Parallelise Supabase queries in attendance service**  
   - Use `Promise.all` to execute independent queries together in `listAttendance`, `getAttendanceByClassAndDate`, and `getAttendanceByStudent`.

6. **P2 – Introduce targeted “hydrate attendance by id” helper**  
   - Replace the `listAttendance` call in `updateAttendance` with a cheaper, ID-specific hydration path.

---

### Next Batches (Planned Scope)

- **Batch 2**: Students + Staff modules (large lists, imports, mapping operations).
- **Batch 3**: Assessments + Timetable (complex, multi-join operations and scheduling).
- **Batch 4**: Frontend hooks/components (React Query usage, waterfalls, over-fetching, virtualisation, loading UX).
- **Batch 5**: Supabase schema & indexes + RLS (concrete DDL recommendations and policy tuning).

Each batch will follow the same structure: issues by priority, problem explanation, fix pattern, estimated impact, and any required database changes.



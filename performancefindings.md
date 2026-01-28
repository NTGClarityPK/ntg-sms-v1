## Performance Audit – Findings Summary (All Batches)

This document summarises current performance findings for the School Management System across three logical batches. It focuses on **real bottlenecks** and keeps **business logic and workflows unchanged**; all recommendations are about how data is fetched, aggregated, cached, or presented.

- **Batch 1 – High‑impact backend**: Attendance, Notifications, Students, Staff.
- **Batch 2 – Frontend data & UX**: React Query usage, waterfalls, over‑fetching, slow pages, timeouts.
- **Batch 3 – Database & Supabase**: Indexes, query patterns, RLS cost, Supabase‑specific considerations.

The detailed implementation plan for these batches will live in a **separate plan document**; this file is only for findings and recommended optimisation directions.

---

## Batch 1 – High‑Impact Backend (Attendance, Notifications, Students, Staff)

### 1.1 Attendance – Bulk Save, Lists, Reports, Summaries

#### 1.1.1 Bulk Save Attendance – Current State

- Bulk attendance save (`POST /api/v1/attendance/bulk`) is already implemented using:
  - **Single `upsert`** with `onConflict: 'student_id,date,academic_year_id'` to avoid N+1 inserts.
  - **Fire‑and‑forget attendance notifications** using `void notificationsService.createAttendanceNotification(...).catch(...)` so notification creation does **not block** the main response.
- Frontend uses:
  - A dedicated **React Query mutation** (`useBulkMarkAttendance`) that:
    - Extends Axios timeout to **30 seconds** for this endpoint.
    - Disables the Save button while pending and prevents double‑submit.
    - On timeout, shows a **“saving is taking longer than expected”** message and triggers a best‑effort refetch.

**Finding**: For bulk save, the critical “request timed out but data saved” issue is largely mitigated already with good patterns (batch upsert, non‑blocking notifications, extended timeout, UX messaging).

**Risk**: These good patterns are **not yet systematically applied** to other heavy endpoints (reports, possible bulk imports, etc.), so similar timeout symptoms can still appear elsewhere.

---

#### 1.1.2 Attendance Report – Potentially Very Large Result Sets

**Symptom / Pattern**

- The attendance report endpoint generates a full report by:
  - Calling the core list function with a **very high `limit` (10,000)** to bypass normal pagination rules.
  - Hydrating each record with student, class, section and “marked by” names via additional joins.
  - Running multiple `.filter` and `.map` operations in Node to compute totals and percentages, and to derive date ranges.

**Why This Is a Bottleneck**

- For a large branch or wide date range:
  - Up to **10,000 fully hydrated rows** can be returned in a single request.
  - Each row is expanded with relational data, increasing payload size significantly.
  - Node does several full passes over the array to compute metrics and sort dates.
- Combined with the **global 10s Axios timeout**, this endpoint is at high risk of:
  - Timing out on the client under load.
  - Still completing successfully on the server **after** the client has given up.

**Impact**

- Wide‑range attendance reports are likely to:
  - Be **slow to generate** (seconds).
  - Consume unnecessary CPU and memory on the backend.
  - Be vulnerable to client‑side timeouts and user frustration.

**Direction for Optimisation (without changing business logic)**

- Replace “fetch up to 10k detailed rows then aggregate in Node” with:
  - **Database‑level aggregations** (group by status, count).
  - **Smaller, controlled result sets** with explicit upper bounds.
  - Optional streaming or paginated exports for full data downloads.
- Keep the **shape of the report** (summary + record list) the same from the user’s perspective; only the internal query strategy changes.

---

#### 1.1.3 Attendance Summaries – Per‑Student and Per‑Class

**Symptom / Pattern**

- Summary endpoints for:
  - **Per‑student** attendance in an academic year.
  - **Per‑class‑section** attendance for a date range.
- These endpoints:
  - Fetch **all matching `attendance` rows** (status only, which is good).
  - Compute `presentDays`, `absentDays`, `lateDays`, `excusedDays`, `totalDays`, and percentage via several `.filter(...).length` passes in Node.

**Why This Can Be a Bottleneck**

- For a year‑long view:
  - Each call loads one row per day (or per recorded day) from the DB.
  - Node then processes the full array multiple times.
- These endpoints are likely used by:
  - Dashboards (widgets).
  - Student detail pages.
  - Class‑level analytics.
- Under concurrency, repeatedly pulling full day‑by‑day data rather than aggregated counts adds:
  - Unnecessary DB I/O.
  - Extra CPU work per request.

**Direction for Optimisation**

- Move counting into the database:
  - Use grouped queries (`GROUP BY status`) to get counts per status directly from Postgres.
  - Return only a **tiny set** of rows (up to 4 for the four statuses).
- The **response shape** (summary DTO) remains identical; only query strategy changes.

---

#### 1.1.4 Attendance Lists – Multiple Sequential Fetches for Related Data

**Symptom / Pattern**

- The core attendance list function:
  - Applies filters (branch, academic year, date, student, class‑section, status) and pagination.
  - Fetches `attendance` rows.
  - Then, **sequentially** fetches:
    - Students (`students` table).
    - Student profiles (`profiles`).
    - Class sections (`class_sections`).
    - Classes (`classes`).
    - Sections (`sections`).
    - “Marked by” profiles (`profiles` again).
  - Combines everything into a hydrated `AttendanceDto` array.

**Why This Can Slow Things Down**

- Many of these secondary queries are **independent** once the IDs are known.
- Executing them one after another introduces:
  - Additional network round‑trip latency for each call.
  - Longer wall‑clock time, even if total DB work is the same.

**Direction for Optimisation**

- Maintain the **same DTO and workflow**, but:
  - Use **batched, parallel queries** (conceptually `Promise.all`) once ID sets are ready.
  - Ensure pagination remains in place; do not increase `limit`.

---

#### 1.1.5 Attendance Update – Rehydration via Generic List Call

**Symptom / Pattern**

- The single‑record update endpoint:
  - Updates one `attendance` row.
  - Then calls the generic `listAttendance` endpoint with `page=1, limit=1` to obtain a hydrated DTO.
  - Locates the updated record in the list (which may or may not contain it depending on sort and filters).

**Why This Is Inefficient**

- Every update does:
  - One `update` query.
  - One **full list+join** query (students, profiles, classes, sections, etc.).
- This is heavy work just to reconstruct **one** DTO and is fragile if the updated item doesn’t appear in the first page.

**Direction for Optimisation**

- Introduce a focused “hydrate attendance by id” path:
  - Start from the updated row returned by Supabase.
  - Fetch only the directly related records needed for that row.
  - Construct the DTO without running a full list query.
- From the client’s perspective:
  - Response format and semantics remain identical.

---

### 1.2 Notifications – Lists, Unread Count, Attendance Notifications

#### 1.2.1 Notifications List – General Health

**Current Pattern**

- Notifications list endpoint:
  - Uses `select('*', { count: 'exact' })` and pagination.
  - Filters by `user_id`, optional `isRead`, optional `type`, and sorts by `created_at`.
  - Returns a DTO array with all necessary fields (`id, userId, type, title, body, data, isRead, createdAt`).

**Finding**

- This is generally sound:
  - Pagination is enforced.
  - No obvious N+1 patterns within the notifications module itself.

Potential improvement (Batch 3):

- A “light” variant could be introduced for consumers that only need counts or a small subset of fields, reducing payload size, but current design is acceptable for the main notifications page.

---

#### 1.2.2 Unread Count – Double Query and Extra Load

**Symptom / Pattern**

- The unread notifications counter on the frontend:
  - Calls `GET /notifications?limit=1` (all statuses) to read `meta.total`.
  - Calls `GET /notifications?isRead=true&limit=1` to read `meta.total` of read notifications.
  - Subtracts to derive unread count.
  - Runs this query pair on a **30‑second poll interval**.

**Why This Is a Bottleneck**

- Each call:
  - Executes a list query with `count: 'exact'` on the backend.
  - Triggers RLS checks and index scans.
- For N logged‑in users:
  - There are **2×N count‑enabled list calls** every 30 seconds.
  - All to compute a simple integer per user.

**Direction for Optimisation**

- Keep UI behaviour identical (badge with unread count), but:
  - Introduce a single **unread‑count endpoint** on the backend (`count(*) where user_id = :user and is_read = false`).
  - Update the hook to call this **single** endpoint instead of two list calls.

---

#### 1.2.3 Notifications Page – Redundant Filtering Call

**Symptom / Pattern**

- The notifications page:
  - Calls the notifications list endpoint for **all** notifications (with `limit`, pagination).
  - Then makes a **second list call** filtered by `type='attendance'` for the attendance tab.
  - The second call largely duplicates data already in the first, just filtered on the client side.

**Why This Is Suboptimal**

- Doubles the list queries when visiting the notifications page.
- Transfers more data than necessary.

**Direction for Optimisation**

- Keep the tabbed UI and semantics unchanged, but:
  - Load notifications **once** (all types).
  - Derive attendance‑specific tab data via client‑side filtering on that result.

---

### 1.3 Students & Staff – Anticipated Hotspots

> Note: These modules will be inspected in more detail during implementation. Here we list the **likely** performance hotspots based on architecture and typical patterns.

#### 1.3.1 Large Lists and Pagination

Expected patterns:

- Students and Staff APIs are likely to:
  - Support pagination via a shared `BasePaginationDto`.
  - Filter by branch, class/section, active/inactive states.
  - Potentially support search and sorting.

Potential risks:

- Any endpoint returning large lists without proper pagination or with very high `limit` values (bypassing the enforced `@Max(100)` rule) would:
  - Increase payload sizes.
  - Risk timeouts and slow UI on pages like `/students` and `/staff`.

Direction:

- Confirm all list endpoints for students/staff:
  - Honour the **max 100** rule.
  - Use efficient filters that align with indexes (branch, status, class, etc.).

---

#### 1.3.2 Bulk Imports and Updates

Expected patterns:

- Bulk student or staff import:
  - May process many records at once.
  - Could be implemented either as:
    - One record per DB call (risky, N+1).
    - Or batched operations (preferred).

Likely bottlenecks (to be confirmed):

- Per‑row inserts or updates inside loops, especially if each:
  - Checks relational data separately (class, parent, role) per iteration.
  - Triggers notifications, additional lookups, or secondary writes synchronously.

Direction:

- Apply the **same principles as bulk attendance**:
  - Use bulk insert/upsert where possible.
  - Move non‑critical side‑effects (notifications, logs) to non‑blocking flows.
  - Keep the import workflow and validations **unchanged** from a business perspective.

---

#### 1.3.3 N+1 Lookups for Related Data

Expected patterns:

- When listing students/staff with enriched information (class names, roles, branch names):
  - Helpers may query related tables **per row** in naive implementations.

Risks:

- For lists of 50–100 records:
  - N+1 behaviours can cause noticeable lag and increased DB load.

Direction:

- Ensure all such enrichments use **batched lookups**:
  - Fetch related entities by ID sets in one query per table.
  - Map/join in memory (similar to the improved attendance list pattern).

---

## Batch 2 – Frontend Data Fetching & UX Performance

Batch 2 focuses on React Query usage patterns, API call waterfalls, over‑fetching, and user‑perceived performance issues across the main pages. The goal is to make screens feel faster without changing business workflows.

### 2.1 React Query Hooks (Global)

#### 2.1.1 Waterfalls and Serial Fetching

Expected hotspots:

- Hooks or components that:
  - Fetch one resource, then in `useEffect` or another hook immediately fetch a dependent resource in a **serial** pattern.
  - Example shape:
    - Fetch user.
    - Then fetch branches.
    - Then fetch settings.

Impact:

- Adds cumulative latency (e.g. 200ms × 3 = 600ms before the page can render meaningful data), even when some calls could run in parallel.

Direction:

- Where business logic permits:
  - Trigger independent queries in parallel using React Query’s built‑in behaviour.
  - Avoid unnecessary `enabled` flags that create avoidable waterfalls.

---

#### 2.1.2 Over‑fetching and Missing `staleTime`

Expected hotspots:

- Hooks that:
  - Re‑fetch lists or configuration on every mount/focus.
  - Do not specify `staleTime`, so data is considered stale immediately.
  - Fetch full objects when the UI only needs counts or small projections.

Impact:

- Increased backend load and chattier UI:
  - More network requests.
  - Higher latency on repeated navigations.

Direction:

- Introduce **appropriate `staleTime` values** for:
  - Semi‑static configuration (academic years, roles, settings, lookups).
  - Less volatile data (class structure, teacher assignments).
- Prefer narrower endpoints or projections (counts/summaries) instead of always loading full entities.

---

#### 2.1.3 Redundant Calls and Cache Invalidation

Expected hotspots:

- Multiple components on the same page:
  - Independently calling the same hook with identical keys and params.
  - Or using slightly different keys that defeat React Query’s deduplication.

Impact:

- Duplicate backend calls for the same logical data.

Direction:

- Standardise query keys and shared hooks.
- Ensure components on the same screen reuse the same hook outputs where possible.

---

### 2.2 Page‑Level UX Performance

#### 2.2.1 `/attendance` and `/attendance/mark`

Current positives:

- Clear loading states in the attendance sheet.
- Save button disabled during pending save.
- Timeout‑aware UX for bulk save.

Expected additional improvements:

- Ensure:
  - Class‑section list loading has visible Skeleton/Loader.
  - Attendance stats and the sheet avoid re‑render storms when local state updates (efficient state slices).

---

#### 2.2.2 `/notifications`

Current positives:

- Uses a table UI with a consolidated list.
- Polling for updated notifications.

Expected improvements:

- Remove the **second `useNotifications` call** for attendance‑only tab (see Batch 1 finding).
- Consider:
  - Increasing `limit` only as needed and staying within the global “max 100” rule.
  - Using a slightly higher `staleTime` plus a moderate poll interval to balance freshness and load.

---

#### 2.2.3 `/students`, `/staff`, `/my-schedule`, others

Expected hotspots:

- Large lists with:
  - Client‑side filtering on already large payloads.
  - No virtualisation when rows get large (500+).
- Search inputs:
  - Triggering API calls on every keystroke without debouncing.

Direction:

- Introduce:
  - Debounced search.
  - Pagination (already enforced in backend, must be reflected in UI).
  - Virtualised list/table components if lists become very large.

---

### 2.3 Timeouts, Error Handling, and UX

#### 2.3.1 Global 10s Axios Timeout

Findings:

- The global Axios client is configured with a **10‑second timeout** for all requests.
- Only bulk attendance overrides this to 30 seconds.

Risks:

- Heavy endpoints (reports, imports, complex analytics) can:
  - Succeed on the server after ~11–15 seconds.
  - But be reported as **“request timed out”** on the client.

Direction:

- Define a **timeout policy**:
  - Keep 10s for ordinary CRUD.
  - Use per‑request higher timeouts or async job patterns for known heavy operations.
- Pair timeouts with:
  - User messaging (“taking longer than expected, your changes may still be saved”).
  - Automatic background refetch after timeout to detect eventual success.

---

## Batch 3 – Database & Supabase (Indexes, RLS, Query Patterns)

Batch 3 addresses **database‑level performance** and Supabase‑specific behaviours, without altering business semantics or access rules.

### 3.1 Indexing Strategy

#### 3.1.1 Attendance

Likely required/beneficial composite indexes:

- To support list, summary, and report queries:
  - `attendance(branch_id, academic_year_id, date, class_section_id)`
  - `attendance(student_id, branch_id, academic_year_id, date, status)`
  - Optionally `attendance(class_section_id, branch_id, academic_year_id, date, status)` for class‑centric summaries.

Benefits:

- Faster filters and range scans over dates.
- Better performance for group‑by and aggregate queries by status.

---

#### 3.1.2 Notifications

Likely indexes:

- `notifications(user_id, is_read, created_at)`:
  - Supports unread‑count, list queries, and read‑all updates.
- `notifications(user_id, type, created_at)`:
  - For type‑filtered lists (e.g. attendance notifications).

Benefits:

- Reduced latency on list and unread‑count endpoints.
- Better performance under polling and high user concurrency.

---

#### 3.1.3 Students & Staff

Expected key patterns:

- Filters by:
  - `branch_id`
  - `class_id` and `section_id` (for students)
  - `is_active`
  - Role/assignment relationships for staff.

Direction:

- Ensure indexes align with real query predicates:
  - Example candidates:
    - `students(branch_id, class_id, section_id, is_active)`
    - `staff(branch_id, is_active)`

---

### 3.2 Supabase RLS and Policy Performance

Findings (conceptual, to be confirmed in Supabase console):

- RLS is required on all tables and is typically implemented with:
  - Branch isolation policies (branch‑based multi‑tenancy).
  - User‑/role‑based policies for notifications and attendance.

Potential performance pitfalls:

- Policies that:
  - Use **complex subqueries** or unindexed columns in `USING`/`WITH CHECK`.
  - Refer to non‑indexed join tables (e.g. `user_branches`, `parent_students`) in a way that forces sequential scans.

Direction:

- For attendance:
  - Ensure RLS policies filter via indexed columns such as `branch_id`, `academic_year_id`, and `student_id`.
- For notifications:
  - Policies should pivot on `user_id = auth.uid()` or a similarly indexed expression.
- Verify that:
  - Policy predicates align with the indexes recommended above.

---

### 3.3 Supabase Usage Patterns

#### 3.3.1 Avoiding Heavy Relationship Syntax for Complex Joins

Finding:

- The backend mostly uses **explicit joins** implemented as:
  - Separate Supabase queries.
  - In‑memory maps to combine data (as seen in attendance).

This is a good pattern for:

- Keeping queries simple.
- Controlling when and how additional data is fetched.

Direction:

- Continue this pattern, but:
  - Apply **batching and parallelisation** carefully to keep latency low.
  - Avoid deep “relationship syntax” joins that can be slow and harder to optimise/index.

---

### 3.4 Summary of DB‑Level Optimisation Opportunities

- **Primary opportunities**:
  - Add or verify composite indexes aligned with real query patterns for attendance, notifications, students, and staff.
  - Move aggregation (counts, summaries) from Node to SQL where possible.
  - Ensure RLS predicates are index‑friendly.
- **What stays the same**:
  - Business logic, workflows, and permissions semantics.
  - DTOs and API shapes exposed to the frontend.

---

## Overall Summary

- **Batch 1 (High‑impact backend)**:
  - Attendance’s bulk save is already well‑optimised; main remaining risks are large reports, summary scans, sequential relational fetches, and inefficient update rehydration.
  - Notifications are structurally solid but wasteful for unread counts and do extra work for attendance tabs.
  - Students and Staff likely need the same bulk and batching patterns applied to avoid N+1 and oversized lists.
- **Batch 2 (Frontend data & UX)**:
  - Focused on eliminating waterfalls, over‑fetching, redundant calls, and tightening React Query usage while enhancing loading/timeout UX.
- **Batch 3 (Database & Supabase)**:
  - Centres on indexing, aggregate query patterns, and RLS performance, with no changes to business rules.

The upcoming **plan document** will map these findings to concrete, ordered changes while explicitly preserving all existing business logic and workflows.

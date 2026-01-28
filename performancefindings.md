## Performance finding: “Request timed out but data saved” (Save Attendance)

### Symptom
- User clicks **Save Attendance** and sees an Axios error: **`timeout of 10000ms exceeded`**.
- After refreshing the page, the attendance is actually **saved correctly**.

### Root cause (common pattern)
- Frontend uses a **hard Axios timeout** (10s) for all requests.
- Backend endpoint does **slow, sequential work** (N+1 queries / per-record loops / extra side effects like notifications).
- Result: the server completes successfully **after** the browser aborts the request, so the client reports an error even though the write succeeded.

### Why this matters
- Causes **duplicate submissions** (user clicks again).
- Causes **loss of trust** (“the system is unreliable”).
- Produces inconsistent user feedback (error toast while data is saved).

### Best-practice fixes (no new libraries required)
- **UI/UX**
  - Disable the submit button while pending and show a spinner (`loading` + `disabled`).
  - Prevent double-submit in handlers (early return if pending).
  - If a timeout happens, show a message like:
    - “Saving is taking longer than expected. Your changes may still be saved. Refreshing data…”
  - Trigger a refetch/invalidate shortly after a timeout (best-effort).

- **Backend performance**
  - Replace per-record loops with **batch operations** where possible:
    - e.g. Supabase/Postgres **`upsert`** for many rows using a unique constraint.
  - Avoid calling list endpoints inside loops (no `listX()` per row).
  - Return the final state with **one fetch** at the end (optional).

- **Timeout policy**
  - Keep a normal default timeout.
  - For known heavy endpoints (bulk operations), set a **longer per-request timeout**.

### Optional later improvements (infrastructure-heavy)
- Background job queues (e.g. Redis/BullMQ) for side effects (notifications), to keep the main request fast.


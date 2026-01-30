# Performance Audit Report v2

## Executive Summary

This report documents performance issues discovered during a comprehensive audit of the `ntg-sms-v1` codebase. The issues are categorised into:

1. **CRITICAL** - Fetching ALL data when only a subset is needed
2. **HIGH** - N+1 query patterns and sequential DB calls
3. **MEDIUM** - Unnecessary multiple API requests from frontend
4. **LOW** - Missing caching/staleTime configurations

---

## 🔴 CRITICAL: Backend Fetching ALL Data

### Issue 1: Students Service - Fetching ALL Auth Users

**File:** `backend/src/modules/students/students.service.ts`  
**Lines:** 136-141

```typescript
// PROBLEM: Fetches ALL auth users across ALL tenants/branches
const { data: authUsers } = await supabase.auth.admin.listUsers();
const emailMap = new Map(
  authUsers.users
    .filter((u) => userIds.includes(u.id))  // Filters client-side AFTER fetching all
    .map((u) => [u.id, u.email || '']),
);
```

**Impact:**  
- If you have 10,000 users in the system, this fetches ALL 10,000 even if you only need 20 emails
- Response time grows linearly with total user count, not query size
- Memory usage spikes on large datasets

**Solution:**  
Use individual `getUserById` calls with `Promise.all`, or better yet, consider storing email in the `profiles` table to avoid auth API entirely.

```typescript
// RECOMMENDED FIX
const emailPromises = userIds.map(id => 
  supabase.auth.admin.getUserById(id).then(res => [id, res.data.user?.email || ''] as const)
);
const emailEntries = await Promise.all(emailPromises);
const emailMap = new Map(emailEntries);
```

---

### Issue 2: Staff Service - Same ALL Users Problem

**File:** `backend/src/modules/staff/staff.service.ts`  
**Lines:** 126-152

```typescript
// PROBLEM: Same issue - fetches ALL users first
const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
if (!listError && authUsers?.users) {
  authUsers.users
    .filter((u) => userIds.includes(u.id))  // Client-side filtering
    .forEach((u) => {
      if (u.email) emailMap.set(u.id, u.email);
    });
}
```

**Impact:** Same as above - scales poorly with total user count.

**Solution:** Same as Issue 1 - batch individual lookups or store email in profiles.

---

### Issue 3: Parent Associations - Fetching ALL Branch Students

**File:** `backend/src/modules/parents/parents.service.ts`  
**Lines:** 273-288

```typescript
// PROBLEM: Fetches ALL students in branch, then filters
if (branchId) {
  // First get all students in this branch
  const { data: branchStudents } = await supabase
    .from('students')
    .select('id')
    .eq('branch_id', branchId);

  const studentIds = branchStudents?.map((s) => s.id) || [];
  // Then uses IN filter - but already fetched all IDs!
  dbQuery = dbQuery.in('student_id', studentIds);
}
```

**Impact:**  
- Fetches potentially thousands of student IDs just to use in an IN clause
- The IN clause with thousands of IDs is also slow
- Should use a JOIN or subquery instead

**Solution:**  
Use RLS or a subquery approach:

```typescript
// RECOMMENDED: Use RPC or view with proper JOIN
// Or if sticking with current approach, at least paginate the parent_students query
// and let RLS handle the branch filtering on the parent_students table directly
```

---

## 🟠 HIGH: N+1 Query Patterns

### Issue 4: Class Sections - Student Count N+1

**File:** `backend/src/modules/class-sections/class-sections.service.ts`  
**Lines:** 453-488

```typescript
private async getStudentCounts(classSectionIds: string[]): Promise<Map<string, number>> {
  // ...
  // PROBLEM: Loops through EACH class-section and makes a SEPARATE DB call
  for (const cs of (classSections || []) as Array<{...}>) {
    const { count, error } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', cs.branch_id)
      .eq('class_id', cs.class_id)
      .eq('section_id', cs.section_id)
      .eq('is_active', true);
    // ...
  }
}
```

**Impact:**  
- 20 class-sections = 20 separate DB roundtrips
- Each roundtrip adds ~10-50ms latency
- Total: 200-1000ms just for counts

**Solution:**  
Use a single aggregated query with GROUP BY:

```typescript
// RECOMMENDED FIX
const { data: counts } = await supabase.rpc('get_student_counts_by_class_section', {
  class_section_ids: classSectionIds
});

// Or raw SQL approach:
const { data } = await supabase
  .from('students')
  .select('class_id, section_id, count:id.count()')
  .eq('is_active', true)
  .in('class_id', classIds)  // Pre-filter to reduce scan
  // Then process in memory to match class_section combinations
```

---

### Issue 5: Sequential DB Calls Instead of Parallel

**File:** `backend/src/modules/attendance/attendance.service.ts`  
**Lines:** 131-219

Several sequential await calls that could run in parallel:

```typescript
// Current: Sequential calls
const { data: studentsData } = await supabase.from('students')...
const { data: profilesData } = await supabase.from('profiles')...
const { data: classSectionsData } = await supabase.from('class_sections')...
const { data: classesData } = await supabase.from('classes')...
const { data: sectionsData } = await supabase.from('sections')...
const { data: markedByProfiles } = await supabase.from('profiles')...
```

**Impact:** Each await blocks until complete. 6 calls × 20ms = 120ms minimum.

**Solution:** Group independent calls with `Promise.all`:

```typescript
// RECOMMENDED: Parallel fetching
const [studentsResult, classSectionsResult] = await Promise.all([
  supabase.from('students').select('...').in('id', studentIds),
  supabase.from('class_sections').select('...').in('id', classSectionIds),
]);

// Then for dependent calls:
const [classesResult, sectionsResult, profilesResult] = await Promise.all([
  supabase.from('classes').select('...').in('id', classIds),
  supabase.from('sections').select('...').in('id', sectionIds),
  supabase.from('profiles').select('...').in('id', userIds),
]);
```

---

## 🟡 MEDIUM: Frontend Multiple Unnecessary Requests

### Issue 6: Leave Stats - 3 Requests for Counts

**File:** `frontend/src/hooks/useLeaveRequests.ts`  
**Lines:** 157-189

```typescript
export function useStudentLeaveStats(studentId: string | null) {
  // PROBLEM: Makes 3 separate API calls just to get counts
  const [pendingResponse, rejectedResponse, approvedResponse] = await Promise.all([
    apiClient.get<LeaveRequest[]>(`/api/v1/leave-requests?studentId=${studentId}&status=pending&limit=1`),
    apiClient.get<LeaveRequest[]>(`/api/v1/leave-requests?studentId=${studentId}&status=rejected&limit=1`),
    apiClient.get<LeaveRequest[]>(`/api/v1/leave-requests?studentId=${studentId}&status=approved&limit=1`),
  ]);
}
```

**Impact:**  
- 3 HTTP requests for simple counts
- 3× network latency
- 3× database queries

**Solution:**  
Create a dedicated stats endpoint:

```typescript
// Backend: GET /api/v1/leave-requests/stats/:studentId
// Returns: { pending: 5, approved: 10, rejected: 2 }

// Frontend:
const response = await apiClient.get<LeaveStats>(`/api/v1/leave-requests/stats/${studentId}`);
```

---

### Issue 7: Missing staleTime on Frequently-Used Hooks

Some hooks that fetch relatively static data don't have `staleTime` set:

| Hook | Current staleTime | Recommended |
|------|-------------------|-------------|
| `useClassSections` | 0 (default) | 5 minutes |
| `useStudents` | 0 (default) | 2 minutes |
| `useStaff` | 0 (default) | 2 minutes |
| `useNotifications` | 30 seconds ✓ | OK |
| `useCoreLookups` | 5 minutes ✓ | OK |

**Solution:**  
Add appropriate staleTime to reduce refetches:

```typescript
export function useClassSections(params?: QueryClassSectionsParams) {
  return useQuery({
    queryKey: ['class-sections', branchId, params],
    queryFn: async () => { /* ... */ },
    enabled: !!branchId,
    staleTime: 5 * 60 * 1000,  // ADD THIS
  });
}
```

---

## 🟢 POSITIVE PATTERNS FOUND

### 1. Efficient Delete Operations ✓
Delete operations (students, staff, etc.) use single requests without over-fetching.

### 2. Bulk Operations Exist ✓
`bulkMarkAttendance` uses upsert with single request - excellent pattern.

### 3. Proper Pagination ✓
List endpoints properly implement `page` and `limit` with range queries.

### 4. DB-Level Filtering for Branch ✓
Most queries properly filter by `branch_id` at database level.

### 5. Unread Count Endpoint ✓
`GET /api/v1/notifications/unread-count` uses `count: 'exact', head: true` - efficient.

---

## Optimisation Priority Matrix

| Priority | Issue | Estimated Impact | Effort |
|----------|-------|------------------|--------|
| 🔴 P0 | Fetch ALL auth users | CRITICAL - blocks scaling | Medium |
| 🔴 P0 | Parent associations fetch all students | CRITICAL | Low |
| 🟠 P1 | N+1 in class-section student counts | HIGH - adds 500ms+ | Medium |
| 🟠 P1 | Sequential DB calls in attendance | HIGH - adds 100ms+ | Low |
| 🟡 P2 | 3 requests for leave stats | MEDIUM | Low |
| 🟡 P2 | Missing staleTime on hooks | MEDIUM | Very Low |

---

## Implementation Recommendations

### Phase 1: Quick Wins (1-2 hours)
1. Add `staleTime` to `useClassSections`, `useStudents`, `useStaff`
2. Create leave stats endpoint to replace 3 requests
3. Add `Promise.all` for parallel DB calls in attendance service

### Phase 2: Critical Fixes (4-8 hours)
1. Replace `listUsers()` with batch `getUserById()` in students/staff services
2. Consider adding `email` column to `profiles` table to avoid auth API
3. Fix parent associations to use proper JOIN instead of fetching all student IDs

### Phase 3: Structural Improvements (1-2 days)
1. Create database function for class-section student counts aggregation
2. Review and add indexes for common query patterns
3. Implement response caching for static lookups

---

## Database Index Recommendations

Based on query patterns observed:

```sql
-- Already likely exist but verify:
CREATE INDEX IF NOT EXISTS idx_students_branch_class_section 
  ON students(branch_id, class_id, section_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_attendance_branch_year_date 
  ON attendance(branch_id, academic_year_id, date);

CREATE INDEX IF NOT EXISTS idx_parent_students_parent_student 
  ON parent_students(parent_user_id, student_id);

-- May be missing:
CREATE INDEX IF NOT EXISTS idx_leave_requests_student_status 
  ON leave_requests(student_id, status) WHERE status = 'pending';
```

---

## Monitoring Recommendations

1. **Add APM/tracing** to identify slow endpoints in production
2. **Log query times** for queries taking >100ms
3. **Monitor Supabase dashboard** for slow queries
4. **Set up alerts** for endpoints exceeding 1s response time

---

## Conclusion

The most impactful fixes are:
1. **Stop fetching ALL auth users** - this is a scaling blocker
2. **Parallelize DB calls** with `Promise.all` - easy win
3. **Fix N+1 in student counts** - significant UX improvement

The codebase has good patterns (pagination, bulk ops, branch filtering) but the auth user fetching and N+1 patterns will cause noticeable slowness at scale.

---

*Report generated: January 2026*
*Auditor: AI Performance Analyst*


# Performance Audit Report v2

## Executive Summary

This report documents performance issues discovered during a comprehensive audit of the `ntg-sms-v1` codebase. The issues are categorised into:

1. **CRITICAL** - Fetching ALL data when only a subset is needed
2. **HIGH** - N+1 query patterns, sequential DB calls, and navigation/caching issues
3. **MEDIUM** - Unnecessary multiple API requests from frontend
4. **LOW** - Unnecessary payload in requests/responses

---

## 🔴 CRITICAL: Tab Switching & Navigation Issues

### Issue 0: useAuth Has ZERO Caching

**File:** `frontend/src/hooks/useAuth.ts`  
**Lines:** 20-28

```typescript
const { data: user, ... } = useQuery({
  queryKey: ['auth', 'me'],
  queryFn: fetchCurrentUser,
  retry: false,
  refetchOnWindowFocus: false,
  enabled: true,
  staleTime: 0,      // ❌ ZERO - data is ALWAYS stale
  gcTime: 0,         // ❌ ZERO - cache cleared immediately
});
```

**Impact:**  
- **Every tab switch / page navigation triggers a fresh `/api/v1/auth/me` request**
- Multiple components use `useAuth()`: Header, Sidebar, CurrentBranchBadge, UserMenu, etc.
- Each page load = 1 API call just for auth even though user data rarely changes
- This is likely the #1 cause of "slow navigation" feeling

**Solution:**

```typescript
return useQuery({
  queryKey: ['auth', 'me'],
  queryFn: fetchCurrentUser,
  retry: false,
  refetchOnWindowFocus: false,
  enabled: true,
  staleTime: 5 * 60 * 1000,  // 5 minutes - user data rarely changes
  gcTime: 10 * 60 * 1000,    // 10 minutes
});
```

---

### Issue 0b: Header Makes Multiple API Calls on Every Page

**File:** `frontend/src/components/layout/Header.tsx`

The Header component (rendered on EVERY page) uses:
- `useTenantMe()` - fetches tenant info
- `CurrentBranchBadge` → `useAuth()` - fetches user
- `NotificationBell` → `useUnreadCount()` - fetches notification count

**Impact:**  
Without proper `staleTime`, switching tabs triggers 3+ API calls just for the header!

**Solution:**  
Add `staleTime: 5 * 60 * 1000` to `useTenantMe()`:

```typescript
// frontend/src/hooks/useTenant.ts
export function useTenantMe() {
  return useQuery({
    queryKey: tenantKeys.me(),
    queryFn: async () => apiClient.get<Tenant>('/api/v1/tenants/me'),
    staleTime: 5 * 60 * 1000,  // ADD THIS
  });
}
```

---

## 🔴 CRITICAL: Branch Selection Slowness

### Issue 0c: Auth Service Makes 5+ Sequential DB Calls

**File:** `backend/src/modules/auth/auth.service.ts`  
**Method:** `getCurrentUser()` (Lines 74-149)

```typescript
async getCurrentUser(userId: string): Promise<UserResponseDto> {
  // CALL 1: Get auth user
  const { data: { user } } = await supabase.auth.admin.getUserById(userId);
  
  // CALL 2: Get profile
  const { data: profile } = await supabase.from('profiles').select('*')...
  
  // CALL 3: Get user_branches (inside listUserBranches)
  const branches = await this.listUserBranches(userId);
  
  // CALL 4: Get current_branch_id from profile
  const currentBranchId = await this.getProfileCurrentBranchId(userId);
  
  // CALL 5: Get user_roles
  const { data: userRolesData } = await supabase.from('user_roles').select(...)
  
  // CALL 6: Get role details
  const { data: rolesData } = await supabase.from('roles').select(...).in('id', roleIds);
}
```

**Impact:**  
- 6 sequential DB calls × 20ms each = **120ms+ minimum** for auth
- This runs on EVERY page load (due to staleTime: 0 above)
- After login, this slow call must complete before dashboard loads

**Solution:**  
Use `Promise.all` for independent calls:

```typescript
async getCurrentUser(userId: string): Promise<UserResponseDto> {
  const supabase = this.supabaseConfig.getClient();

  // PARALLEL: All independent calls at once
  const [authResult, profileResult, userBranchesResult, userRolesResult] = await Promise.all([
    supabase.auth.admin.getUserById(userId),
    supabase.from('profiles').select('full_name, avatar_url, current_branch_id').eq('id', userId).single(),
    supabase.from('user_branches').select('branch_id').eq('user_id', userId),
    supabase.from('user_roles').select('role_id, branch_id').eq('user_id', userId),
  ]);

  // THEN fetch dependent data in parallel
  const branchIds = userBranchesResult.data?.map(ub => ub.branch_id) || [];
  const roleIds = [...new Set(userRolesResult.data?.map(ur => ur.role_id) || [])];

  const [branchesResult, rolesResult] = await Promise.all([
    branchIds.length > 0 
      ? supabase.from('branches').select('id, tenant_id, name, code').in('id', branchIds)
      : Promise.resolve({ data: [] }),
    roleIds.length > 0
      ? supabase.from('roles').select('id, name').in('id', roleIds)
      : Promise.resolve({ data: [] }),
  ]);

  // Build response...
}
```

This reduces 6 sequential calls (120ms+) to 2 parallel batches (~40-50ms).

---

### Issue 0d: Branch Switcher Invalidates ALL Queries

**File:** `frontend/src/hooks/useBranchSwitcher.ts`  
**Line:** 32

```typescript
onSuccess: (data) => {
  refetchAuth();
  queryClient.invalidateQueries();  // ❌ INVALIDATES EVERYTHING!
  // ...
}
```

**Impact:**  
- `invalidateQueries()` with no arguments invalidates ALL cached queries
- This triggers refetch of: students, staff, attendance, notifications, class-sections, etc.
- Results in a "waterfall" of requests after branch switch

**Solution:**

```typescript
onSuccess: (data) => {
  // Only invalidate branch-dependent queries
  queryClient.invalidateQueries({ queryKey: ['students'] });
  queryClient.invalidateQueries({ queryKey: ['staff'] });
  queryClient.invalidateQueries({ queryKey: ['attendance'] });
  queryClient.invalidateQueries({ queryKey: ['class-sections'] });
  queryClient.invalidateQueries({ queryKey: ['leaves'] });
  // Keep auth cached - it was just refetched
  refetchAuth();
}
```

---

### Issue 0e: UserMenu Branch Switch Does Full Page Reload

**File:** `frontend/src/components/layout/UserMenu.tsx`  
**Line:** 56

```typescript
const handleBranchSelection = async (branchId: string) => {
  await apiClient.post('/api/v1/auth/select-branch', { branchId });
  localStorage.setItem('currentBranchId', branchId);
  await refetch();
  setShowBranchModal(false);
  window.location.href = '/dashboard';  // ❌ FULL PAGE RELOAD!
};
```

**Impact:**  
- `window.location.href` forces full page reload
- Loses all React Query cache
- All components re-mount and re-fetch everything
- User experiences a "flash" and slow load

**Solution:**  
Use Next.js router instead:

```typescript
import { useRouter } from 'next/navigation';

const handleBranchSelection = async (branchId: string) => {
  await apiClient.post('/api/v1/auth/select-branch', { branchId });
  localStorage.setItem('currentBranchId', branchId);
  await refetch();
  setShowBranchModal(false);
  
  // Invalidate branch-dependent queries
  queryClient.invalidateQueries({ queryKey: ['students'] });
  queryClient.invalidateQueries({ queryKey: ['staff'] });
  // etc.
  
  router.push('/dashboard');  // ✅ SPA navigation
};
```

---

## 🔴 CRITICAL: Unnecessary Payload Issues

### Issue 0f: Using SELECT * Instead of Specific Fields

**Found:** 103 instances of `select('*')` across backend services

**Examples:**

| File | Line | Current | Only Needs |
|------|------|---------|------------|
| `auth.service.ts` | 90 | `profiles.select('*')` | `full_name, avatar_url, current_branch_id` |
| `staff.service.ts` | 92 | `staff.select('*')` | `id, user_id, employee_id, department, is_active` |
| `attendance.service.ts` | 74 | `attendance.select('*')` | Specific fields only |
| `leave-requests.service.ts` | 177 | `leave_requests.select('*')` | Specific fields only |
| `notifications.service.ts` | 49 | `notifications.select('*')` | `id, type, title, body, is_read, created_at` |

**Impact:**  
- Transfers unused columns over the network
- `profiles` table might have large fields (address, etc.)
- `notifications.data` is a JSONB field - potentially very large
- Every extra KB × 1000 users = MB of wasted bandwidth

**Solution:**  
Replace `select('*')` with explicit field lists:

```typescript
// BEFORE
const { data: profile } = await supabase.from('profiles').select('*')...

// AFTER
const { data: profile } = await supabase
  .from('profiles')
  .select('full_name, avatar_url, current_branch_id')
  .eq('id', userId)
  .single();
```

---

### Issue 0g: Attendance DTO Returns More Fields Than Needed

**File:** `backend/src/modules/attendance/dto/attendance.dto.ts`

The DTO includes many fields that aren't always needed:

```typescript
export class AttendanceDto {
  id!: string;
  studentId!: string;
  studentIdNumber?: string;      // Not needed for list view
  studentName!: string;
  classSectionId!: string;
  className!: string;             // Already have classSectionId
  sectionName!: string;           // Already have classSectionId
  date!: string;
  status!: 'present' | 'absent' | 'late' | 'excused';
  entryTime?: string;
  exitTime?: string;
  notes?: string;
  markedById?: string;
  markedByName?: string;          // Not needed for most views
  branchId!: string;              // Client already knows branch
  academicYearId!: string;        // Client already knows year
  createdAt!: string;
  updatedAt!: string;
}
```

**Solution:**  
Consider creating slim DTOs for list views:

```typescript
// For list views
export class AttendanceListDto {
  id!: string;
  studentId!: string;
  studentName!: string;
  date!: string;
  status!: string;
}

// Full DTO for detail views
export class AttendanceDetailDto extends AttendanceListDto {
  // ... additional fields
}
```

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
| 🔴 P0 | useAuth staleTime: 0 | CRITICAL - every nav = API call | Very Low |
| 🔴 P0 | Auth service sequential DB calls | CRITICAL - 120ms+ per auth | Low |
| 🔴 P0 | Branch switcher invalidates ALL queries | CRITICAL - refetch storm | Very Low |
| 🔴 P0 | Branch switch full page reload | CRITICAL - loses all cache | Very Low |
| 🔴 P0 | Fetch ALL auth users | CRITICAL - blocks scaling | Medium |
| 🔴 P0 | Parent associations fetch all students | CRITICAL | Low |
| 🟠 P1 | N+1 in class-section student counts | HIGH - adds 500ms+ | Medium |
| 🟠 P1 | SELECT * everywhere | HIGH - wasted bandwidth | Medium |
| 🟠 P1 | useTenantMe no staleTime | HIGH - extra call per nav | Very Low |
| 🟡 P2 | 3 requests for leave stats | MEDIUM | Low |
| 🟡 P2 | Missing staleTime on hooks | MEDIUM | Very Low |

---

## Implementation Recommendations

### Phase 0: Immediate Wins (30 minutes) - HIGHEST IMPACT

These fixes will have the most noticeable impact immediately:

1. **Add staleTime to useAuth** (5 min)
   ```typescript
   // frontend/src/hooks/useAuth.ts
   staleTime: 5 * 60 * 1000,  // 5 minutes
   gcTime: 10 * 60 * 1000,
   ```

2. **Add staleTime to useTenantMe** (2 min)
   ```typescript
   // frontend/src/hooks/useTenant.ts
   staleTime: 5 * 60 * 1000,
   ```

3. **Fix branch switcher invalidation** (5 min)
   ```typescript
   // Replace queryClient.invalidateQueries() with specific keys
   ```

4. **Replace window.location.href with router.push** (5 min)

### Phase 1: Quick Backend Wins (1-2 hours)

1. **Parallelize auth service DB calls** with `Promise.all`
2. Add `staleTime` to `useClassSections`, `useStudents`, `useStaff`
3. Create leave stats endpoint to replace 3 requests

### Phase 2: Critical Fixes (4-8 hours)

1. Replace `listUsers()` with batch `getUserById()` in students/staff services
2. Replace `select('*')` with explicit field lists (103 instances)
3. Fix parent associations to use proper JOIN instead of fetching all student IDs

### Phase 3: Structural Improvements (1-2 days)

1. Create database function for class-section student counts aggregation
2. Consider adding `email` column to `profiles` table to avoid auth API
3. Create slim DTOs for list views vs detail views

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

### Root Cause of "Slow Navigation" Feeling

The primary reason tab switching and navigation feels slow is:

1. **`useAuth` has `staleTime: 0`** - EVERY page navigation triggers `/api/v1/auth/me`
2. **Auth service makes 6 sequential DB calls** - Each auth request takes 120ms+
3. **Header components fetch on every render** - `useTenantMe`, `useUnreadCount` without caching
4. **Branch switching nukes all cache** - `invalidateQueries()` with no filter

Combined effect: **Navigate to new page → 3-4 API calls fire → each takes 50-150ms → total delay 200-500ms**

### Root Cause of "Slow After Login"

1. First `/api/v1/auth/me` call with 6 sequential DB queries = 120ms+
2. If no branch selected, `BranchGuard` auto-selects branch = another API call
3. Then `window.location.href` forces full page reload = lose all cache
4. Dashboard loads fresh, triggering all queries again

### Most Impactful Fixes (In Order)

| Fix | Time | Impact |
|-----|------|--------|
| Add `staleTime` to `useAuth` | 2 min | Eliminates repeated auth calls |
| Parallelize auth service DB calls | 30 min | Reduces auth from 120ms → 40ms |
| Fix branch switcher invalidation | 5 min | Prevents refetch storm |
| Replace `window.location.href` | 5 min | Preserves cache on branch switch |
| Add `staleTime` to `useTenantMe` | 2 min | Removes 1 call per navigation |
| Replace `select('*')` | 2 hours | Reduces payload size by ~50% |
| Stop fetching ALL auth users | 1 hour | Unblocks scaling past 1000 users |

### Good Patterns Found ✓

- Efficient delete operations (single request)
- Bulk operations exist (bulk attendance marking)
- Proper pagination implemented
- Unread count endpoint uses efficient head-only query
- Branch filtering at DB level

### Summary

**Quick wins (Phase 0) will have the most dramatic impact on perceived performance.** 

Adding `staleTime: 5 * 60 * 1000` to `useAuth` alone will likely cut navigation time by 50% since it eliminates the most frequent unnecessary API call.

---


CRITICAL: WHILE CREATING PLAN TO FIX THE ABOVE ISSSUES, MAKE SURE YOU DONT CHANGE ANY EXISTING BUSINESS LOGIC OR FLOW.

*Report generated: January 2026*  
*Auditor: AI Performance Analyst*


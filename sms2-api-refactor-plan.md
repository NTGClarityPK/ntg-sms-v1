# SMS2 API Refactor Plan
> Generated from API design audit of 215 endpoints across 32 controllers.
> Feed this to Cursor plan mode. Implement in priority order P0 → P3.

---

## Context & Rules

- Stack: NestJS + Supabase + TypeScript
- All routes are under `/api/v1/`
- Follow existing patterns: DTOs in `*.dto.ts`, service logic in `*.service.ts`, controller decorators with `@ApiTags`, `@ApiBearerAuth`
- Do NOT break existing endpoint URLs unless explicitly stated — add new ones or migrate with backward-compatible deprecation
- For every change, update: controller, service (if needed), DTO (if needed), Swagger decorators
- branch_id isolation via RLS must be respected in all new service methods

---

## P0 — Do These First (No Breaking Changes, Pure Additions)

### P0-1: Add HTTP Error Responses to All Endpoints (Swagger Only)

**Problem:** Every endpoint only documents `200` or `201`. No `400`, `401`, `403`, `404`, `500`.

**Task:** Add a global exception filter + standard `@ApiResponse` decorators.

**Step 1 — Create global exception filter:**
```typescript
// src/common/filters/http-exception.filter.ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json({
      statusCode: status,
      message: exception instanceof HttpException
        ? exception.message
        : 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
}
```

**Step 2 — Register globally in `main.ts`:**
```typescript
app.useGlobalFilters(new AllExceptionsFilter());
```

**Step 3 — Create reusable Swagger decorator:**
```typescript
// src/common/decorators/api-standard-responses.decorator.ts
export function ApiStandardResponses() {
  return applyDecorators(
    ApiResponse({ status: 400, description: 'Bad Request — validation failed' }),
    ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid token' }),
    ApiResponse({ status: 403, description: 'Forbidden — insufficient permissions' }),
    ApiResponse({ status: 404, description: 'Not Found — resource does not exist' }),
    ApiResponse({ status: 500, description: 'Internal Server Error' }),
  );
}
```

**Step 4 — Apply to all controllers:**
Add `@ApiStandardResponses()` to every controller method. Also add `@ApiResponse({ status: 409, description: 'Conflict' })` to any POST that creates a unique resource (students, academic years, etc.).

---

### P0-2: Fix Settings Controller Ownership

**Problem:** `/settings/school-days` is in `ScheduleController` (tag: `Schedule`). `/settings/leave-quota` is in `AssessmentController` (tag: `Assessment`). The URL prefix `/settings/` implies one owner but the code splits it across two controllers.

**Task:** Move both endpoints into `SettingsController` (which already exists for `/settings` and `/settings/{key}`).

**Move these endpoints:**
```
FROM: ScheduleController
  GET  /api/v1/settings/school-days
  PUT  /api/v1/settings/school-days

TO: SettingsController (or a new ScheduleSettingsController tagged under Settings)
  GET  /api/v1/settings/school-days
  PUT  /api/v1/settings/school-days
```

```
FROM: AssessmentController  
  GET  /api/v1/settings/leave-quota
  PUT  /api/v1/settings/leave-quota

TO: SettingsController
  GET  /api/v1/settings/leave-quota
  PUT  /api/v1/settings/leave-quota
```

URLs do NOT change. Only ownership and Swagger tag changes from `Schedule`/`Assessment` to `Settings`.

---

## P1 — High Value, Low Risk

### P1-1: Merge LeaveRequests approve + reject → single status endpoint

**Problem:** Two endpoints with identical DTOs:
```
PUT /api/v1/leave-requests/{id}/approve   → UpdateLeaveStatusDto
PUT /api/v1/leave-requests/{id}/reject    → UpdateLeaveStatusDto  ← same DTO
```

**New endpoint:**
```
PATCH /api/v1/leave-requests/{id}/status
```

**New DTO:**
```typescript
// update-leave-status.dto.ts
export class UpdateLeaveStatusDto {
  @IsEnum(['approve', 'reject'])
  action: 'approve' | 'reject';

  @IsOptional()
  @IsString()
  reason?: string;
}
```

**Controller:**
```typescript
@Patch(':id/status')
@ApiOperation({ summary: 'Approve or reject a leave request' })
async updateStatus(
  @Param('id') id: string,
  @Body() dto: UpdateLeaveStatusDto,
) {
  return this.leaveRequestsService.updateStatus(id, dto);
}
```

**Service:** Route to existing approve/reject logic based on `dto.action`.

**Keep:** `PUT /{id}/cancel` stays separate (different actor — parent/submitter, not admin).

**Deprecate:** Mark old `/approve` and `/reject` endpoints with `@ApiOperation({ deprecated: true })` for one sprint before removing.

---

### P1-2: Merge EarlyDeparture approve + reject → single status endpoint

**Same pattern as P1-1.**

**New endpoint:**
```
PATCH /api/v1/early-departures/{id}/status
```

**New DTO:**
```typescript
export class UpdateEarlyDepartureStatusDto {
  @IsEnum(['approve', 'reject'])
  action: 'approve' | 'reject';

  @IsOptional()
  @IsString()
  notes?: string;
}
```

**Keep:** `PUT /{id}/cancel` stays separate.

---

### P1-3: Embed unread_count in Notifications list response

**Problem:** Frontend always calls both:
```
GET /api/v1/notifications          ← list
GET /api/v1/notifications/unread-count  ← count
```
These are called together on every page render and after every action.

**Task:** Modify `GET /api/v1/notifications` to include `unreadCount` in the meta:

**New response shape:**
```typescript
{
  data: Notification[],
  meta: {
    total: number,
    unreadCount: number   // ← ADD THIS
  }
}
```

**Service change — run in parallel:**
```typescript
async listNotifications(userId: string) {
  const [notifications, unreadCount] = await Promise.all([
    this.getNotifications(userId),
    this.getUnreadCount(userId),   // reuse existing logic
  ]);
  return { data: notifications, meta: { total: notifications.length, unreadCount } };
}
```

**Deprecate** `/notifications/unread-count` endpoint after frontend is updated.

---

### P1-4: POST /auth/select-branch returns the selected branch

**Problem:** After `POST /auth/select-branch`, frontend must call `GET /auth/current-branch` to get the branch data. Two requests for one action.

**Task:** Make `POST /auth/select-branch` return the branch object in its response.

**Current response:** `{ success: true }` (or similar)

**New response:**
```typescript
{
  success: true,
  branch: {
    id: string,
    name: string,
    // ... other branch fields
  }
}
```

No DTO change needed on input. Just enrich the return value in the service.

---

## P2 — Medium Priority

### P2-1: Add unified Schedule events endpoint (Calendar view)

**Problem:** Calendar UI fetches both holidays and vacations. Two separate GETs.

**Keep existing CRUD endpoints as-is.** Add ONE new read-only endpoint:

```
GET /api/v1/schedule/events?academicYearId=xxx&type=holiday|vacation|all
```

**Response:**
```typescript
{
  holidays: PublicHoliday[],
  vacations: Vacation[],
  totalEvents: number
}
```

**Controller:** Add to `ScheduleController` (it already owns both resources):
```typescript
@Get('events')  // maps to /api/v1/schedule/events  — NOTE: verify this doesn't conflict
@ApiQuery({ name: 'academicYearId', required: true })
@ApiQuery({ name: 'type', enum: ['holiday', 'vacation', 'all'], required: false })
async getScheduleEvents(
  @Query('academicYearId') academicYearId: string,
  @Query('type') type: 'holiday' | 'vacation' | 'all' = 'all',
) {
  return this.scheduleService.getEvents(academicYearId, type);
}
```

**Service:** Run queries in parallel:
```typescript
async getEvents(academicYearId: string, type: string) {
  const [holidays, vacations] = await Promise.all([
    type !== 'vacation' ? this.listHolidays(academicYearId) : [],
    type !== 'holiday' ? this.listVacations(academicYearId) : [],
  ]);
  return { holidays, vacations, totalEvents: holidays.length + vacations.length };
}
```

---

### P2-2: Merge LeaveRequests quota + stats → summary endpoint

**Problem:** Two requests always fetched together:
```
GET /api/v1/leave-requests/quota/{studentId}
GET /api/v1/leave-requests/stats/{studentId}
```

**New endpoint:**
```
GET /api/v1/leave-requests/summary/{studentId}?academicYearId=xxx
```

**Response:**
```typescript
{
  quota: {
    total: number,
    used: number,
    remaining: number
  },
  stats: {
    approved: number,
    rejected: number,
    pending: number,
    cancelled: number
  }
}
```

**Service:** Use `Promise.all` to fetch both in parallel, return merged object.

**Keep** old `/quota/{studentId}` and `/stats/{studentId}` endpoints, mark deprecated.

---

### P2-3: Add AcademicYears bulk action endpoint

**Problem:** No way to activate/lock/unlock multiple academic years at once.

**New endpoint:**
```
POST /api/v1/academic-years/bulk-action
```

**New DTO:**
```typescript
export class BulkAcademicYearActionDto {
  @IsArray()
  @IsUUID('4', { each: true })
  ids: string[];

  @IsEnum(['activate', 'lock', 'unlock'])
  action: 'activate' | 'lock' | 'unlock';
}
```

**Service — use Promise.all (not a loop):**
```typescript
async bulkAction(dto: BulkAcademicYearActionDto) {
  const results = await Promise.all(
    dto.ids.map(id => this.performAction(id, dto.action))
  );
  return {
    success: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results
  };
}
```

**Note:** Check branch_id RLS — ensure user can only bulk-action academic years within their own branch.

---

### P2-4: Unify AcademicYears status endpoints (optional, can wait)

**Problem:** Three separate PATCH endpoints for state transitions. Also inconsistent admin prefix:
```
PATCH /api/v1/academic-years/{id}/activate
PATCH /api/v1/academic-years/{id}/lock
PATCH /api/v1/academic-years/admin/{id}/unlock   ← inconsistent /admin/ prefix
```

**New single endpoint:**
```
PATCH /api/v1/academic-years/{id}/status
Body: { "action": "activate" | "lock" | "unlock" }
```

**Authorization:** Use role guard (`@Roles('admin')`) on the controller method instead of putting admin in the URL. The `/admin/` URL prefix is an anti-pattern.

**Migration:** Keep old endpoints with `@ApiOperation({ deprecated: true })` for one release cycle.

---

## P3 — Cleanup & Missing Pieces

### P3-1: Add missing GET /{id} endpoints

These controllers have no single-record GET:

```typescript
// EarlyDepartureController — ADD:
@Get(':id')
async getById(@Param('id') id: string) {
  return this.earlyDepartureService.getById(id);
}

// BehavioralController — ADD:
@Get(':id')
async getById(@Param('id') id: string) {
  return this.behavioralService.getById(id);
}
```

---

### P3-2: Merge Timetable conflicts + validate

**Problem:** Two endpoints with identical query params:
```
GET /api/v1/timetable/conflicts?classSectionId=x&staffId=x&academicYearId=x
GET /api/v1/timetable/validate?classSectionId=x&staffId=x&academicYearId=x
```

**Merge:** Make `/validate` return both validation status AND conflicts list:
```typescript
// GET /api/v1/timetable/validate
{
  isValid: boolean,
  conflicts: TimetableConflict[],   // was previously only in /conflicts
  summary: string
}
```

Mark `/conflicts` as deprecated.

---

### P3-3: Fix HTTP method inconsistencies

These use `POST` but should use `PATCH` (state transition, not resource creation):

| Current | Fix | Reason |
|---------|-----|--------|
| `POST /api/v1/staff/{id}/deactivate` | `PATCH /api/v1/staff/{id}/status` | State change |
| `POST /api/v1/assessments/{id}/publish` | `PATCH /api/v1/assessments/{id}/status` | State change |
| `POST /api/v1/early-departures/authorize` | Review needed — unclear if this creates a new record or mutates existing | Confirm with team |

For each: add PATCH endpoint, keep POST with `deprecated: true` for one sprint.

---

### P3-4: Document pagination params on all list endpoints

All list endpoints (GET without /{id}) are missing documented query params in Swagger.

Add this decorator to every list endpoint:
```typescript
@ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
@ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
@ApiQuery({ name: 'search', required: false, type: String })
@ApiQuery({ name: 'sortBy', required: false, type: String })
@ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
```

List endpoints to update: `/staff`, `/students`, `/grades`, `/notifications`, `/leave-requests`, `/early-departures`, `/assessments`, `/teacher-assignments`, `/class-sections`, `/events`, `/behavioral`, `/users`.

---

### P3-5: Fix SubjectTemplates assignment method inconsistency

```
POST /api/v1/subject-templates/{id}/assign-classes   ← uses POST
PUT  /api/v1/timing-templates/{id}/assign-classes    ← uses PUT (same action!)
```

Standardize: Use `PUT` for all assignment operations (replacing a set of relationships).
Change `SubjectTemplatesController` assign-classes, assign-levels to `PUT`.

---

### P2-5: Grades — Extend Bulk Endpoint

**Problem:** `POST /api/v1/grades/bulk` exists for creating grades in bulk, but there is no bulk **update** or bulk **delete**. A teacher grading an entire class must either call `POST /grades/bulk` (only for new records) or loop `PUT /grades/{id}` one-by-one for corrections.

**Current endpoints:**
```
POST /api/v1/grades/bulk    ← bulk CREATE only (BulkCreateGradesDto)
PUT  /api/v1/grades/{id}    ← single update only
DELETE /api/v1/grades/{id}  ← single delete only
```

**Add two new endpoints:**

**Bulk update:**
```
PUT /api/v1/grades/bulk
```

**New DTO:**
```typescript
export class BulkUpdateGradesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateGradeItemDto)
  grades: UpdateGradeItemDto[];
}

export class UpdateGradeItemDto {
  @IsUUID('4')
  id: string;

  // same fields as UpdateStudentGradeDto
  @IsOptional()
  @IsNumber()
  score?: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}
```

**Bulk delete:**
```
DELETE /api/v1/grades/bulk
Body: { "ids": ["uuid1", "uuid2", ...] }
```

**DTO:**
```typescript
export class BulkDeleteGradesDto {
  @IsArray()
  @IsUUID('4', { each: true })
  ids: string[];
}
```

**Controller:**
```typescript
@Put('bulk')
@ApiOperation({ summary: 'Bulk update grades' })
async bulkUpdate(@Body() dto: BulkUpdateGradesDto) {
  return this.gradesService.bulkUpdate(dto);
}

@Delete('bulk')
@ApiOperation({ summary: 'Bulk delete grades' })
async bulkDelete(@Body() dto: BulkDeleteGradesDto) {
  return this.gradesService.bulkDelete(dto);
}
```

**Service — use Promise.all, not a loop:**
```typescript
async bulkUpdate(dto: BulkUpdateGradesDto) {
  const results = await Promise.all(
    dto.grades.map(g => this.updateGrade(g.id, g))
  );
  return { updated: results.length, results };
}

async bulkDelete(dto: BulkDeleteGradesDto) {
  // Use .in() query — single DB call, not N calls
  const { error } = await this.supabase
    .from('student_grades')
    .delete()
    .in('id', dto.ids)
    .eq('branch_id', this.branchId);  // RLS: ensure branch isolation

  return { deleted: dto.ids.length };
}
```

**Note:** The existing `POST /grades/bulk` (bulk create) stays unchanged.

---

## Implementation Checklist

### P0 Sprint (can be done in 1-2 days)
- [ ] Create `AllExceptionsFilter` and register in `main.ts`
- [ ] Create `@ApiStandardResponses()` decorator
- [ ] Apply `@ApiStandardResponses()` to all 32 controllers
- [ ] Move `school-days` endpoints to `SettingsController`
- [ ] Move `leave-quota` endpoints to `SettingsController`
- [ ] Re-tag both with `@ApiTags('Settings')`

### P1 Sprint (can be done in 1-2 days)
- [ ] Create new `UpdateLeaveStatusDto` with `action` enum
- [ ] Add `PATCH /leave-requests/{id}/status` endpoint + service method
- [ ] Mark old `/approve` and `/reject` as deprecated
- [ ] Same for `EarlyDeparture`: `PATCH /early-departures/{id}/status`
- [ ] Update `listNotifications` service to return `meta.unreadCount`
- [ ] Mark `/notifications/unread-count` as deprecated
- [ ] Update `selectBranch` service to return branch object in response

### P2 Sprint (2-3 days)
- [ ] Add `GET /schedule/events` endpoint in ScheduleController
- [ ] Add `GET /leave-requests/summary/{studentId}` endpoint
- [ ] Add `POST /academic-years/bulk-action` endpoint + DTO
- [ ] (Optional) Add `PATCH /academic-years/{id}/status` unified endpoint
- [ ] Add `PUT /grades/bulk` (bulk update) endpoint + DTO
- [ ] Add `DELETE /grades/bulk` (bulk delete) endpoint + DTO

### P3 Sprint (1 day cleanup)
- [ ] Add `GET /early-departures/{id}`
- [ ] Add `GET /behavioral/{id}`
- [ ] Merge timetable `/validate` to include conflicts
- [ ] Fix POST → PATCH for deactivate/publish
- [ ] Add `@ApiQuery` pagination decorators to all list endpoints
- [ ] Standardize SubjectTemplates assign methods to PUT

---

## Files Likely to Change

```
src/
├── main.ts                                        (P0 - register filter)
├── common/
│   ├── filters/http-exception.filter.ts           (P0 - new file)
│   └── decorators/api-standard-responses.ts       (P0 - new file)
├── modules/
│   ├── settings/
│   │   └── settings.controller.ts                 (P0 - absorb school-days, leave-quota)
│   ├── leave-requests/
│   │   ├── leave-requests.controller.ts           (P1 - add /status, deprecate /approve /reject)
│   │   ├── leave-requests.service.ts              (P1 - add updateStatus method)
│   │   └── dto/update-leave-status.dto.ts         (P1 - update DTO)
│   ├── early-departure/
│   │   ├── early-departure.controller.ts          (P1+P3)
│   │   ├── early-departure.service.ts             (P1+P3)
│   │   └── dto/update-early-departure-status.dto.ts (P1)
│   ├── notifications/
│   │   ├── notifications.controller.ts            (P1 - deprecate /unread-count)
│   │   └── notifications.service.ts              (P1 - embed count in list)
│   ├── auth/
│   │   └── auth.service.ts                        (P1 - selectBranch returns branch)
│   ├── schedule/
│   │   └── schedule.controller.ts                 (P2 - add /schedule/events)
│   ├── grades/
│   │   ├── grades.controller.ts                     (P2 - add bulk update + bulk delete)
│   │   ├── grades.service.ts                        (P2 - bulkUpdate, bulkDelete methods)
│   │   └── dto/bulk-update-grades.dto.ts            (P2 - new file)
│   ├── academic-years/
│   │   ├── academic-years.controller.ts           (P2 - bulk-action, unified status)
│   │   ├── academic-years.service.ts              (P2)
│   │   └── dto/bulk-academic-year-action.dto.ts   (P2 - new file)
│   ├── timetable/
│   │   └── timetable.controller.ts                (P3 - merge validate/conflicts)
│   ├── behavioral/
│   │   └── behavioral.controller.ts               (P3 - add GET /:id)
│   └── subject-templates/
│       └── subject-templates.controller.ts        (P3 - PUT for assign)
```

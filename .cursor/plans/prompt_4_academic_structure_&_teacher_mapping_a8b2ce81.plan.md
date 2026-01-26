---
name: "Prompt 4: Academic Structure & Teacher Mapping"
overview: Implement class-section management, class teacher assignments, and subject-teacher mapping (list and matrix views) with teacher schedule view. This connects teachers to classes, sections, and subjects, forming the foundation for attendance, grades, and timetable features.
todos:
  - id: phase4-1-db
    content: Create database migration for class_sections table with RLS policies
    status: completed
  - id: phase4-1-backend
    content: Implement class-sections backend module (service, controller, DTOs)
    status: completed
    dependencies:
      - phase4-1-db
  - id: phase4-1-frontend
    content: Implement class-sections frontend (page, grid, cards, modals, hooks)
    status: completed
    dependencies:
      - phase4-1-backend
  - id: phase4-2-db
    content: Add class_teacher_id column to class_sections table
    status: completed
    dependencies:
      - phase4-1-db
  - id: phase4-2-backend
    content: Implement class teacher assignment endpoints and update staff service
    status: completed
    dependencies:
      - phase4-2-db
      - phase4-1-backend
  - id: phase4-2-frontend
    content: Update ClassSectionCard and create AssignClassTeacherModal
    status: completed
    dependencies:
      - phase4-2-backend
      - phase4-1-frontend
  - id: phase4-3-db
    content: Create database migration for teacher_assignments table with RLS policies
    status: completed
    dependencies:
      - phase4-1-db
  - id: phase4-3-backend
    content: Implement teacher-assignments backend module (service, controller, DTOs)
    status: completed
    dependencies:
      - phase4-3-db
  - id: phase4-3-frontend
    content: Implement teacher mapping list view (page, list component, row component, modals, hooks)
    status: completed
    dependencies:
      - phase4-3-backend
  - id: phase4-4-frontend
    content: Implement teacher mapping matrix view (matrix component, cell component, toggle)
    status: completed
    dependencies:
      - phase4-3-frontend
  - id: phase4-5-backend
    content: Add staff schedule endpoint and implement getAssignments method
    status: completed
    dependencies:
      - phase4-2-backend
      - phase4-3-backend
  - id: phase4-5-frontend
    content: Implement teacher schedule view page and components
    status: completed
    dependencies:
      - phase4-5-backend
  - id: phase4-navigation
    content: Update Sidebar navigation to include Academic menu items
    status: completed
    dependencies:
      - phase4-1-frontend
      - phase4-3-frontend
---

# Prompt

4: Academic Structure & Teacher Mapping Implementation Plan

## Overview

This prompt implements the academic structure that connects teachers to classes, sections, and subjects. It consists of 5 phases:

1. Class-Section Management - Create class-section combinations
2. Class Teacher Assignment - Assign one class teacher per class-section
3. Subject-Teacher Mapping (List View) - Map subject teachers to class-sections
4. Subject-Teacher Mapping (Matrix View) - Visual matrix for bulk editing
5. Teacher Schedule View - Individual teacher view of assignments

## Phase 4.1: Class-Section Management

### Database Migration

- Create `class_sections` table with:
- `id` (UUID, PK)
- `class_id` (FK to `classes`)
- `section_id` (FK to `sections`)
- `branch_id` (FK to `branches`)
- `academic_year_id` (FK to `academic_years`)
- `capacity` (INT, default 30)
- `is_active` (BOOLEAN, default TRUE)
- `created_at` (TIMESTAMPTZ)
- Unique constraint: `(class_id, section_id, branch_id, academic_year_id)`
- Index on `(branch_id, academic_year_id)`
- RLS enabled with branch isolation policy

### Backend Implementation

**Module**: `backend/src/modules/class-sections/`

- **Service** (`class-sections.service.ts`):
- `listClassSections(query, branchId, academicYearId)` - Paginated list with filters (class, section, isActive)
- `getClassSectionById(id, branchId)` - Get single class-section with student count
- `createClassSection(input, branchId, academicYearId)` - Create single or bulk
- `updateClassSection(id, input, branchId)` - Update capacity/isActive
- `deleteClassSection(id, branchId)` - Delete only if no students enrolled
- `getStudentsInClassSection(id, branchId)` - List students in class-section
- Helper: `countStudentsInClassSection(id)` - Get student count for validation
- **Controller** (`class-sections.controller.ts`):
- `GET /api/v1/class-sections` - List (query params: page, limit, classId, sectionId, isActive, academicYearId)
- `GET /api/v1/class-sections/:id` - Get details with student count
- `POST /api/v1/class-sections` - Create (single or bulk)
- `PUT /api/v1/class-sections/:id` - Update capacity/isActive
- `DELETE /api/v1/class-sections/:id` - Delete (validates no students)
- `GET /api/v1/class-sections/:id/students` - List students
- All endpoints use `@UseGuards(JwtAuthGuard, BranchGuard)` and `@CurrentBranch()`
- **DTOs**:
- `ClassSectionDto` - Response with class/section names, student count, capacity
- `CreateClassSectionDto` - Single creation (classId, sectionId, capacity)
- `BulkCreateClassSectionDto` - Bulk creation (array of CreateClassSectionDto)
- `UpdateClassSectionDto` - Update capacity/isActive
- `QueryClassSectionsDto` - Extends BasePaginationDto, adds classId, sectionId, isActive, academicYearId filters

### Frontend Implementation

**Page**: `frontend/src/app/dashboard/academic/class-sections/page.tsx`

- Title bar with "Create Class-Section" button
- Uses `ClassSectionGrid` component

**Components**:

- `ClassSectionGrid.tsx` - Visual grid (classes as rows, sections as columns)
- Shows all class-section combinations for active academic year
- Empty cells show "Create" button
- Filled cells show `ClassSectionCard`
- Responsive: collapses to list view on mobile
- `ClassSectionCard.tsx` - Card showing:
- Class name + Section name (e.g., "Class 1 - A")
- Student count / Capacity (e.g., "15/30")
- Class teacher name (if assigned, Phase 4.2)
- Actions: Edit capacity, Assign teacher, View students, Delete
- Status badge (Active/Inactive)
- `CreateClassSectionModal.tsx` - Modal for:
- Single creation: Class dropdown, Section dropdown, Capacity input
- Bulk creation: Select multiple classes and sections, auto-generate all combinations
- `ClassSectionStudentsModal.tsx` - Modal listing students in class-section (table view)

**Hook**: `frontend/src/hooks/useClassSections.ts`

- `useClassSections(query)` - List query
- `useClassSection(id)` - Single query
- `useCreateClassSection()` - Create mutation
- `useUpdateClassSection()` - Update mutation
- `useDeleteClassSection()` - Delete mutation
- `useClassSectionStudents(id)` - Students query

## Phase 4.2: Class Teacher Assignment

### Database Migration

- Add `class_teacher_id` column to `class_sections` table:
- `class_teacher_id UUID REFERENCES public.staff(id)`
- Nullable (class-section can exist without teacher initially)

### Backend Implementation

**Update** `class-sections.service.ts`:

- `assignClassTeacher(classSectionId, staffId, branchId)` - Assign teacher
- `unassignClassTeacher(classSectionId, branchId)` - Remove teacher assignment
- Update `getClassSectionById` to include teacher info (join with staff and profiles)

**Update** `class-sections.controller.ts`:

- `PUT /api/v1/class-sections/:id/class-teacher` - Body: `{ staffId: string | null }` (null to unassign)
- `GET /api/v1/staff/:id/class-teacher-of` - Get sections where staff is class teacher (moved from staff module)

**Update** `staff.service.ts`:

- Implement `getAssignments()` method (currently returns empty arrays)
- Returns `{ classTeacherOf: Array<{ classSectionId, className, sectionName }>, subjectAssignments: Array<...> }`

### Frontend Implementation

**Update** `ClassSectionCard.tsx`:

- Display class teacher name below student count
- "Assign Teacher" button opens `AssignClassTeacherModal`

**Component**: `AssignClassTeacherModal.tsx`

- Staff dropdown (filtered by branch, role = class_teacher)
- Shows current teacher if assigned
- "Unassign" button to remove teacher
- Validation: Teacher must have `class_teacher` role in the branch

## Phase 4.3: Subject-Teacher Mapping (List View)

### Database Migration

- Create `teacher_assignments` table:
- `id` (UUID, PK)
- `staff_id` (FK to `staff`)
- `subject_id` (FK to `subjects`)
- `class_section_id` (FK to `class_sections`)
- `academic_year_id` (FK to `academic_years`)
- `branch_id` (FK to `branches`)
- `created_at` (TIMESTAMPTZ)
- Unique constraint: `(subject_id, class_section_id, academic_year_id)` - one teacher per subject-class-section-year
- Indexes: `(staff_id)`, `(class_section_id)`
- RLS enabled with branch isolation policy

### Backend Implementation

**Module**: `backend/src/modules/teacher-assignments/`

- **Service** (`teacher-assignments.service.ts`):
- `listTeacherAssignments(query, branchId, academicYearId)` - Paginated list with filters (staffId, subjectId, classSectionId)
- `getTeacherAssignmentById(id, branchId)` - Get single assignment
- `createTeacherAssignment(input, branchId, academicYearId)` - Create assignment
- `updateTeacherAssignment(id, input, branchId)` - Change teacher for same subject-class-section
- `deleteTeacherAssignment(id, branchId)` - Remove assignment
- `getAssignmentsByTeacher(staffId, branchId, academicYearId)` - Get all assignments for a teacher
- `getAssignmentsByClassSection(classSectionId, branchId, academicYearId)` - Get all subjects/teachers for a class-section
- Validation: Ensure subject, class-section, and staff belong to same branch
- **Controller** (`teacher-assignments.controller.ts`):
- `GET /api/v1/teacher-assignments` - List (query params: page, limit, staffId, subjectId, classSectionId, academicYearId)
- `GET /api/v1/teacher-assignments/:id` - Get single
- `POST /api/v1/teacher-assignments` - Create
- `PUT /api/v1/teacher-assignments/:id` - Update (change teacher)
- `DELETE /api/v1/teacher-assignments/:id` - Delete
- `GET /api/v1/teacher-assignments/by-teacher/:staffId` - Get teacher's assignments
- `GET /api/v1/teacher-assignments/by-class/:classSectionId` - Get class-section's subjects/teachers
- All endpoints use `@UseGuards(JwtAuthGuard, BranchGuard)` and `@CurrentBranch()`
- **DTOs**:
- `TeacherAssignmentDto` - Response with staff name, subject name, class-section name
- `CreateTeacherAssignmentDto` - staffId, subjectId, classSectionId
- `UpdateTeacherAssignmentDto` - staffId (to change teacher)
- `QueryTeacherAssignmentsDto` - Extends BasePaginationDto, adds staffId, subjectId, classSectionId, academicYearId filters

### Frontend Implementation

**Page**: `frontend/src/app/dashboard/academic/teacher-mapping/page.tsx`

- Title bar with "Create Assignment" button
- Toggle between List and Matrix views (Phase 4.4)
- Uses `TeacherMappingList` component (default view)

**Components**:

- `TeacherMappingList.tsx` - Table view:
- Columns: Class-Section, Subject, Teacher, Actions
- Filters: Class, Section, Subject, Teacher (multi-select)
- Each row is `AssignmentRow` component
- `AssignmentRow.tsx` - Table row:
- Shows class-section name, subject name, teacher name
- Actions: Edit (change teacher), Delete
- Teacher column has dropdown to change teacher inline (optional)
- `CreateAssignmentModal.tsx` - Modal for:
- Class-Section dropdown (filtered by active academic year)
- Subject dropdown (filtered by branch)
- Teacher dropdown (filtered by branch, role = subject_teacher)
- Validation: No duplicate subject-class-section assignments

**Hook**: `frontend/src/hooks/useTeacherAssignments.ts`

- `useTeacherAssignments(query)` - List query
- `useTeacherAssignment(id)` - Single query
- `useCreateTeacherAssignment()` - Create mutation
- `useUpdateTeacherAssignment()` - Update mutation
- `useDeleteTeacherAssignment()` - Delete mutation
- `useAssignmentsByTeacher(staffId)` - Teacher's assignments query
- `useAssignmentsByClassSection(classSectionId)` - Class-section's assignments query

## Phase 4.4: Subject-Teacher Mapping (Matrix View)

### Backend Implementation

- No changes needed (reuses Phase 4.3 endpoints)

### Frontend Implementation

**Component**: `TeacherMappingMatrix.tsx`

- Grid layout: Class-sections as rows, Subjects as columns
- Each cell (`MatrixCell`) shows:
- Teacher name if assigned
- "Assign" button if empty
- Click to open teacher dropdown
- Bulk operations:
- "Assign Teacher to All" - Assign same teacher to all empty cells for a subject
- "Clear Column" - Remove all assignments for a subject
- Responsive: Scrollable horizontal on mobile

**Component**: `MatrixCell.tsx`

- Editable cell with teacher dropdown
- Shows teacher name or "Assign" button
- Click opens dropdown with available teachers
- Changes save immediately (optimistic update)

**Update** `teacher-mapping/page.tsx`:

- Add toggle button: "List View" / "Matrix View"
- Conditionally render `TeacherMappingList` or `TeacherMappingMatrix`

## Phase 4.5: Teacher Schedule View

### Backend Implementation

**Update** `staff.controller.ts`:

- `GET /api/v1/staff/:id/schedule` - Get teacher's full schedule
- Returns: `{ classTeacherOf: [...], subjectAssignments: [...] }`
- Uses existing `getAssignments()` method from `staff.service.ts`

### Frontend Implementation

**Page**: `frontend/src/app/dashboard/staff/:id/schedule/page.tsx`

- Title: "Teacher Schedule: [Teacher Name]"
- Uses `TeacherSchedule` component

**Component**: `TeacherSchedule.tsx`

- Weekly grid view (placeholder until timetable is implemented):
- Shows class teacher assignments (if any)
- Shows subject assignments grouped by class-section
- Each assignment shows: Class-Section, Subject, Academic Year
- Future: Will integrate with timetable to show actual schedule

**Component**: `ScheduleCard.tsx`

- Card for each assignment:
- Class-Section name
- Subject name
- Academic year
- Link to class-section details

**Hook**: `frontend/src/hooks/useStaffSchedule.ts`

- `useStaffSchedule(staffId)` - Fetches teacher's assignments

## Implementation Notes

### Multi-Tenancy

- All tables include `branch_id` and filter by it
- Use `BranchGuard` on all endpoints
- Use `@CurrentBranch()` decorator to get branch context
- RLS policies enforce branch isolation via `user_branches` table

### Academic Year Context

- All operations require active academic year
- Use `AcademicYearsService.getActiveYear()` to get current year
- Filter all queries by `academic_year_id`

### Validation Rules

- Class-section: Unique per (class, section, branch, academic year)
- Teacher assignment: Unique per (subject, class-section, academic year)
- Cannot delete class-section if students are enrolled
- Class teacher must have `class_teacher` role
- Subject teacher must have `subject_teacher` role

### UI/UX Guidelines

- Follow `UI_UX_Design_System.md` for all components
- Use centralized theme system (no hardcoded colors)
- Grid view should be responsive (collapse to list on mobile)
- All modals use Mantine Modal component
- All tables use Mantine Table with Paper wrapper
- All badges use `variant="light"`

### Dependencies

- Requires Prompt 1 (Settings) - classes, sections, subjects exist
- Requires Prompt 2 (Branches) - branch isolation
- Requires Prompt 3 (Users) - staff table exists
- Students table exists (for student count validation)

### Files to Create/Modify

**Backend**:

- `backend/src/modules/class-sections/` (new module)
- `backend/src/modules/teacher-assignments/` (new module)
- Update `backend/src/modules/staff/staff.service.ts` (implement getAssignments)
- Update `backend/src/modules/staff/staff.controller.ts` (add schedule endpoint)

**Frontend**:

- `frontend/src/app/dashboard/academic/class-sections/page.tsx` (new)
- `frontend/src/app/dashboard/academic/teacher-mapping/page.tsx` (new)
- `frontend/src/app/dashboard/staff/[id]/schedule/page.tsx` (new)
- `frontend/src/components/features/academic/` (new directory with all components)
- `frontend/src/hooks/useClassSections.ts` (new)
- `frontend/src/hooks/useTeacherAssignments.ts` (new)
- `frontend/src/hooks/useStaffSchedule.ts` (new)
- Update `frontend/src/components/layout/Sidebar.tsx` (add Academic menu items)

**Database**:
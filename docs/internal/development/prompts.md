# School Management System - Implementation Prompts

> **Purpose**: Phased implementation prompts for Cursor AI. Each feature broken into testable phases with DB, API, and UI specs.
> **Tech Stack**: Next.js 14 (App Router) + Mantine v7 + NestJS + Supabase
> **Structure**: `frontend/` and `backend/` directories (NOT monorepo)

---

## Prompt 0: Initial Project Setup

### Context
Set up the foundational project structure with both frontend and backend applications, Supabase connection, and shared configurations.

### Phase 0.1: Backend Scaffolding
**Goal**: NestJS project with Supabase integration and base configuration.

**Database**: None yet (Supabase project created manually)

**API Endpoints**: None yet

**Tasks**:
- Initialize NestJS project in `backend/` with TypeScript strict mode
- Install dependencies: `@supabase/supabase-js`, `@nestjs/config`, `class-validator`, `class-transformer`
- Create `src/common/` with:
  - `config/supabase.config.ts` - Supabase client initialization
  - `filters/http-exception.filter.ts` - Global exception handler
  - `interceptors/response.interceptor.ts` - Wrap all responses in `{ data, meta, error }` format
  - `decorators/current-user.decorator.ts` - Extract user from request
  - `guards/jwt-auth.guard.ts` - Validate Supabase JWT
- Create `.env.example` with `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_JWT_SECRET`
- Set up CORS for frontend origin

**Verify**: `npm run start:dev` runs without errors, health endpoint returns 200.

---

### Phase 0.2: Frontend Scaffolding
**Goal**: Next.js 14 with Mantine UI, React Query, and API client.

**Database**: None

**API Endpoints**: None

**Tasks**:
- Initialize Next.js 14 in `frontend/` with App Router, TypeScript
- Install: `@mantine/core`, `@mantine/hooks`, `@mantine/notifications`, `@tanstack/react-query`, `@supabase/ssr`, `zod`
- Create `src/lib/`:
  - `api-client.ts` - Axios instance pointing to NestJS backend with auth header injection
  - `supabase/client.ts` - Browser Supabase client (auth only)
  - `supabase/server.ts` - Server Supabase client (auth only)
  - `query-client.ts` - React Query provider setup
- Create `src/app/`:
  - `layout.tsx` - Root layout with MantineProvider, QueryClientProvider
  - `providers.tsx` - Client-side providers wrapper
- Create `src/types/api.ts` - Base response type `{ data: T, meta?: Meta, error?: string }`
- Create `.env.local.example` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`

**Verify**: `npm run dev` shows Mantine-styled page, no console errors.

---

### Phase 0.3: Authentication Flow
**Goal**: Supabase Auth integration with login/logout and session management.

**Database (Supabase Migration)**:
```sql
-- Enable RLS on auth.users (already exists)
-- Create profiles table linked to auth.users
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
```

**API Endpoints**:
- `GET /api/v1/auth/me` - Returns current user with profile and roles
- `POST /api/v1/auth/validate` - Validates JWT, returns user context

**UI Components**:
- `src/app/(auth)/login/page.tsx` - Login form with email/password
- `src/app/(auth)/layout.tsx` - Centered auth layout
- `src/components/common/AuthGuard.tsx` - Protect routes, redirect if not authenticated
- `src/hooks/useAuth.ts` - Auth state hook with React Query

**Verify**: Can login, session persists on refresh, logout clears session, protected routes redirect.

---

### Phase 0.4: App Shell & Navigation
**Goal**: Main application layout with sidebar navigation and role-aware menu.

**Database**: None

**API Endpoints**: None

**UI Components**:
- `src/app/(dashboard)/layout.tsx` - Dashboard layout with AppShell
- `src/components/layout/AppShell.tsx` - Mantine AppShell with sidebar
- `src/components/layout/Sidebar.tsx` - Navigation menu (placeholder items)
- `src/components/layout/Header.tsx` - User menu, notifications icon, logout
- `src/components/layout/UserMenu.tsx` - Profile dropdown

**Verify**: Authenticated user sees sidebar, can navigate placeholder routes, responsive on mobile.

---

## Prompt 1: System Configuration & Settings

### Context
Admin-configurable settings that all other features depend on. These are the foundational lookup tables.

### Phase 1.1: Academic Year Management
**Goal**: Create and manage academic years with active year enforcement.

**Database (Supabase Migration)**:
```sql
CREATE TABLE public.academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- e.g., "2025-2026"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  is_locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only one active year allowed
CREATE UNIQUE INDEX idx_single_active_year ON public.academic_years (is_active) WHERE is_active = TRUE;

ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
```

**API Endpoints**:
- `GET /api/v1/academic-years` - List all years
- `GET /api/v1/academic-years/active` - Get current active year
- `POST /api/v1/academic-years` - Create new year (Admin only)
- `PATCH /api/v1/academic-years/:id/activate` - Set as active year
- `PATCH /api/v1/academic-years/:id/lock` - Lock year (no more edits)

**UI Components**:
- `src/app/(dashboard)/settings/academic-years/page.tsx` - List with status badges
- `src/components/features/settings/AcademicYearForm.tsx` - Create/edit modal
- `src/components/features/settings/AcademicYearCard.tsx` - Year card with actions
- `src/hooks/useAcademicYears.ts` - CRUD hooks

**Verify**: Can create year, activate it, lock it. Only one active at a time. Locked year shows view-only badge.

---

### Phase 1.2: Core Lookup Tables (Subjects, Classes, Sections)
**Goal**: Admin defines subjects, classes, sections used throughout the system.

**Database (Supabase Migration)**:
```sql
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ar TEXT, -- Arabic name
  code TEXT UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- e.g., "KG1", "1", "10"
  display_name TEXT NOT NULL, -- e.g., "Kindergarten 1", "Grade 1"
  sort_order INT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- e.g., "A", "B", "C"
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- e.g., "Primary", "Elementary"
  name_ar TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Many-to-many: which classes belong to which level
CREATE TABLE public.level_classes (
  level_id UUID REFERENCES public.levels(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  PRIMARY KEY (level_id, class_id)
);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.level_classes ENABLE ROW LEVEL SECURITY;
```

**API Endpoints**:
- `GET /api/v1/subjects` - List subjects
- `POST /api/v1/subjects` - Create subject (Admin)
- `GET /api/v1/classes` - List classes with optional level filter
- `POST /api/v1/classes` - Create class (Admin)
- `GET /api/v1/sections` - List sections
- `POST /api/v1/sections` - Create section (Admin)
- `GET /api/v1/levels` - List levels with nested classes
- `POST /api/v1/levels` - Create level with class assignments (Admin)

**UI Components**:
- `src/app/(dashboard)/settings/academic/page.tsx` - Tabbed view (Subjects, Classes, Sections, Levels)
- `src/components/features/settings/SubjectList.tsx` - Draggable list for reordering
- `src/components/features/settings/ClassList.tsx` - Class cards with level badges
- `src/components/features/settings/SectionList.tsx` - Simple list
- `src/components/features/settings/LevelManager.tsx` - Level with class assignment chips

**Verify**: Can CRUD all entities. Classes show which level they belong to. Reordering persists.

---

### Phase 1.3: Timing & Schedule Settings
**Goal**: Configure school days, timing templates, period duration.

**Database (Supabase Migration)**:
```sql
CREATE TABLE public.school_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(day_of_week)
);

CREATE TABLE public.timing_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  assembly_start TIME,
  assembly_end TIME,
  break_start TIME,
  break_end TIME,
  period_duration_minutes INT NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Which classes use which timing template
CREATE TABLE public.class_timing_assignments (
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  timing_template_id UUID REFERENCES public.timing_templates(id) ON DELETE CASCADE,
  PRIMARY KEY (class_id)
);

CREATE TABLE public.public_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ar TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.school_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timing_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_timing_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;
```

**API Endpoints**:
- `GET /api/v1/settings/school-days` - List active school days
- `PUT /api/v1/settings/school-days` - Update school days (Admin)
- `GET /api/v1/timing-templates` - List templates
- `POST /api/v1/timing-templates` - Create template (Admin)
- `PUT /api/v1/timing-templates/:id/assign-classes` - Assign classes to template
- `GET /api/v1/public-holidays` - List holidays for active year
- `POST /api/v1/public-holidays` - Create holiday (Admin)
- `PUT /api/v1/public-holidays/:id` - Update holiday
- `DELETE /api/v1/public-holidays/:id` - Delete holiday

**UI Components**:
- `src/app/(dashboard)/settings/schedule/page.tsx` - Schedule settings page
- `src/components/features/settings/SchoolDaysSelector.tsx` - Day checkboxes (Sun-Sat)
- `src/components/features/settings/TimingTemplateForm.tsx` - Time pickers form
- `src/components/features/settings/TimingTemplateCard.tsx` - Shows template with assigned classes
- `src/components/features/settings/HolidayCalendar.tsx` - Calendar view of holidays

**Verify**: School days persist. Timing templates can be assigned to classes. Holidays show in calendar.

---

### Phase 1.4: Assessment & Grade Settings
**Goal**: Configure assessment types, grade templates, and minimum passing grades.

**Database (Supabase Migration)**:
```sql
CREATE TABLE public.assessment_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ar TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.grade_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- e.g., "Primary Grading", "Secondary Grading"
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.grade_ranges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_template_id UUID REFERENCES public.grade_templates(id) ON DELETE CASCADE,
  letter TEXT NOT NULL, -- A, B, C, D, F
  min_percentage DECIMAL(5,2) NOT NULL,
  max_percentage DECIMAL(5,2) NOT NULL,
  sort_order INT DEFAULT 0
);

-- Which classes use which grade template
CREATE TABLE public.class_grade_assignments (
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  grade_template_id UUID REFERENCES public.grade_templates(id) ON DELETE CASCADE,
  minimum_passing_grade TEXT NOT NULL DEFAULT 'D', -- Letter from the template
  PRIMARY KEY (class_id)
);

CREATE TABLE public.leave_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annual_quota INT NOT NULL DEFAULT 7,
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(academic_year_id)
);

ALTER TABLE public.assessment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_ranges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_grade_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_settings ENABLE ROW LEVEL SECURITY;
```

**API Endpoints**:
- `GET /api/v1/assessment-types` - List types
- `POST /api/v1/assessment-types` - Create type (Admin)
- `GET /api/v1/grade-templates` - List templates with ranges
- `POST /api/v1/grade-templates` - Create template with ranges (Admin)
- `PUT /api/v1/grade-templates/:id` - Update template ranges
- `PUT /api/v1/grade-templates/:id/assign-classes` - Assign to classes with passing grade
- `GET /api/v1/settings/leave-quota` - Get quota for active year
- `PUT /api/v1/settings/leave-quota` - Set quota (Admin)

**UI Components**:
- `src/app/(dashboard)/settings/assessment/page.tsx` - Assessment settings
- `src/components/features/settings/AssessmentTypeList.tsx` - Type list with drag-sort
- `src/components/features/settings/GradeTemplateBuilder.tsx` - Visual grade range builder
- `src/components/features/settings/GradeTemplateAssignment.tsx` - Assign template to classes
- `src/components/features/settings/LeaveQuotaSetting.tsx` - Simple number input

**Verify**: Assessment types persist. Grade template shows visual range preview. Classes show assigned template.

---

### Phase 1.5: Communication & Behavior Settings
**Goal**: Configure communication direction and behavioral assessment system.

**Database (Supabase Migration)**:
```sql
CREATE TABLE public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO public.system_settings (key, value) VALUES
  ('communication_direction', '{"teacher_student": "both", "teacher_parent": "both"}'),
  ('behavioral_assessment', '{"enabled": false, "mandatory": false, "attributes": ["Discipline", "Class Engagement", "Work Habits", "Student Well-being", "Extracurriculars"]}'),
  ('library_categories', '["Textbooks", "Reference", "Fiction", "Islamic Studies", "Science", "History", "Mathematics"]');

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
```

**API Endpoints**:
- `GET /api/v1/settings/:key` - Get specific setting
- `PUT /api/v1/settings/:key` - Update setting (Admin)
- `GET /api/v1/settings` - Get all settings (Admin)

**UI Components**:
- `src/app/(dashboard)/settings/communication/page.tsx` - Communication settings
- `src/components/features/settings/CommunicationSettings.tsx` - Radio group for direction
- `src/app/(dashboard)/settings/behavior/page.tsx` - Behavior assessment config
- `src/components/features/settings/BehaviorSettings.tsx` - Toggle, mandatory checkbox, attribute editor
- `src/components/features/settings/LibraryCategoryEditor.tsx` - Tag input for categories

**Verify**: Settings persist. Behavior attributes can be added/removed. Communication direction saves.

---

## Prompt 2: Branch Management & Multi-Tenancy

### Context
Multi-branch support with complete data isolation. All subsequent tables will reference branch_id.

### Phase 2.1: Branch Entity & CRUD
**Goal**: Create and manage school branches.

**Database (Supabase Migration)**:
```sql
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ar TEXT,
  code TEXT UNIQUE, -- Short code like "DT", "GD"
  address TEXT,
  phone TEXT,
  email TEXT,
  storage_quota_gb INT DEFAULT 100,
  storage_used_bytes BIGINT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only see branches they have access to (will be enforced via user_branches)
```

**API Endpoints**:
- `GET /api/v1/branches` - List branches (filtered by user access)
- `GET /api/v1/branches/:id` - Get branch details
- `POST /api/v1/branches` - Create branch (Super Admin)
- `PUT /api/v1/branches/:id` - Update branch (Admin)
- `GET /api/v1/branches/:id/storage` - Get storage breakdown

**UI Components**:
- `src/app/(dashboard)/admin/branches/page.tsx` - Branch list
- `src/components/features/branches/BranchCard.tsx` - Card with storage indicator
- `src/components/features/branches/BranchForm.tsx` - Create/edit modal
- `src/components/features/branches/StorageIndicator.tsx` - Visual storage bar

**Verify**: Can CRUD branches. Storage indicator shows usage. Branches list loads.

---

### Phase 2.2: Branch Selection Flow
**Goal**: Post-login branch selection for multi-branch users.

**Database (Supabase Migration)**:
```sql
-- User-branch association (many-to-many)
CREATE TABLE public.user_branches (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, branch_id)
);

-- Add branch context to profiles
ALTER TABLE public.profiles ADD COLUMN current_branch_id UUID REFERENCES public.branches(id);

ALTER TABLE public.user_branches ENABLE ROW LEVEL SECURITY;
```

**API Endpoints**:
- `GET /api/v1/auth/my-branches` - List user's assigned branches
- `POST /api/v1/auth/select-branch` - Set current branch in session
- `GET /api/v1/auth/current-branch` - Get current branch context

**UI Components**:
- `src/app/(auth)/select-branch/page.tsx` - Branch selection page (after login)
- `src/components/features/branches/BranchSelector.tsx` - Branch selection cards
- `src/components/layout/BranchSwitcher.tsx` - Header dropdown to switch branch
- Update `src/hooks/useAuth.ts` - Include branch context

**Verify**: Multi-branch user sees selection after login. Branch persists in session. Can switch branches.

---

### Phase 2.3: Branch-Scoped Data Foundation
**Goal**: Ensure all data tables respect branch isolation.

**Database (Supabase Migration)**:
```sql
-- Add branch_id to all settings tables
ALTER TABLE public.subjects ADD COLUMN branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.classes ADD COLUMN branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.sections ADD COLUMN branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.levels ADD COLUMN branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.timing_templates ADD COLUMN branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.public_holidays ADD COLUMN branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.assessment_types ADD COLUMN branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.grade_templates ADD COLUMN branch_id UUID REFERENCES public.branches(id);

-- Create indexes for branch filtering
CREATE INDEX idx_subjects_branch ON public.subjects(branch_id);
CREATE INDEX idx_classes_branch ON public.classes(branch_id);
CREATE INDEX idx_sections_branch ON public.sections(branch_id);

-- Update RLS policies to filter by branch
CREATE POLICY "Branch isolation for subjects" ON public.subjects
  FOR ALL USING (branch_id IN (
    SELECT branch_id FROM public.user_branches WHERE user_id = auth.uid()
  ));

-- Repeat similar policies for all tables...
```

**API Endpoints**:
- Update ALL existing endpoints to:
  - Accept `branch_id` from request context (set by BranchGuard)
  - Filter queries by `branch_id`
  - Validate user has access to the branch

**Backend Changes**:
- `src/common/guards/branch.guard.ts` - Extract and validate branch from request
- `src/common/decorators/current-branch.decorator.ts` - Inject branch into handlers
- Update all services to filter by branch

**UI Changes**:
- Update all API calls to include branch context header
- Update React Query keys to include branch_id for cache isolation

**Verify**: Data from Branch A not visible when switched to Branch B. API rejects cross-branch access.

---

## Prompt 3: User Management & Authentication

### Context
Full user lifecycle management with 9 roles, multi-role support, and student/parent linking.

### Phase 3.1: Roles & Permissions System
**Goal**: Define and manage the 9 user roles with configurable permissions.

**Database (Supabase Migration)**:
```sql
CREATE TYPE user_role AS ENUM (
  'parent',
  'student',
  'principal',
  'school_admin',
  'academic_coordinator',
  'class_teacher',
  'subject_teacher',
  'guidance_counselor',
  'admin_assistant'
);

CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name user_role NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  display_name_ar TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default roles
INSERT INTO public.roles (name, display_name) VALUES
  ('parent', 'Parent/Guardian'),
  ('student', 'Student'),
  ('principal', 'Principal'),
  ('school_admin', 'School Admin'),
  ('academic_coordinator', 'Academic Coordinator'),
  ('class_teacher', 'Class Teacher'),
  ('subject_teacher', 'Subject Teacher'),
  ('guidance_counselor', 'Guidance Counselor'),
  ('admin_assistant', 'Admin Assistant');

CREATE TABLE public.features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE, -- e.g., 'library', 'attendance', 'assessment'
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role-feature permissions (V/E/X configurable)
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
  feature_id UUID REFERENCES public.features(id) ON DELETE CASCADE,
  permission TEXT NOT NULL CHECK (permission IN ('none', 'view', 'edit')),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, feature_id, branch_id)
);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
```

**API Endpoints**:
- `GET /api/v1/roles` - List all roles
- `GET /api/v1/features` - List all features
- `GET /api/v1/permissions` - Get permission matrix for branch
- `PUT /api/v1/permissions` - Update permissions (Admin)

**UI Components**:
- `src/app/(dashboard)/settings/permissions/page.tsx` - Permission matrix page
- `src/components/features/settings/PermissionMatrix.tsx` - Grid: roles × features
- `src/components/features/settings/PermissionCell.tsx` - Dropdown (None/View/Edit)
- `src/hooks/usePermissions.ts` - Permission check hook

**Verify**: Matrix displays all roles/features. Changes persist. Users can check permissions via hook.

---

### Phase 3.2: User Profiles & CRUD
**Goal**: Manage users with role assignments and profile details.

**Database (Supabase Migration)**:
```sql
-- Extend profiles table
ALTER TABLE public.profiles ADD COLUMN phone TEXT;
ALTER TABLE public.profiles ADD COLUMN address TEXT;
ALTER TABLE public.profiles ADD COLUMN date_of_birth DATE;
ALTER TABLE public.profiles ADD COLUMN gender TEXT CHECK (gender IN ('male', 'female'));
ALTER TABLE public.profiles ADD COLUMN is_active BOOLEAN DEFAULT TRUE;

-- User-role assignments (many-to-many for multi-role)
CREATE TABLE public.user_roles (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, role_id, branch_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
```

**API Endpoints**:
- `GET /api/v1/users` - List users (paginated, filterable by role, branch)
- `GET /api/v1/users/:id` - Get user with roles
- `POST /api/v1/users` - Create user with Supabase Auth + profile + roles
- `PUT /api/v1/users/:id` - Update user profile
- `PUT /api/v1/users/:id/roles` - Update role assignments
- `DELETE /api/v1/users/:id` - Soft delete (set inactive)

**UI Components**:
- `src/app/(dashboard)/users/page.tsx` - User list with filters
- `src/components/features/users/UserTable.tsx` - Data table with role badges
- `src/components/features/users/UserForm.tsx` - Create/edit user modal
- `src/components/features/users/RoleAssignment.tsx` - Multi-select roles
- `src/components/features/users/UserFilters.tsx` - Role, status filters

**Verify**: Can CRUD users. Roles display as badges. Filters work. Inactive users hidden by default.

---

### Phase 3.3: Student Profiles
**Goal**: Extended student profiles with academic info and unique IDs.

**Database (Supabase Migration)**:
```sql
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL, -- e.g., "2024-KG1-A-001"
  class_id UUID REFERENCES public.classes(id),
  section_id UUID REFERENCES public.sections(id),
  blood_group TEXT,
  medical_notes TEXT,
  admission_date DATE,
  academic_year_id UUID REFERENCES public.academic_years(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, branch_id)
);

CREATE INDEX idx_students_class ON public.students(class_id, section_id);
CREATE INDEX idx_students_branch ON public.students(branch_id);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
```

**API Endpoints**:
- `GET /api/v1/students` - List students (filterable by class, section)
- `GET /api/v1/students/:id` - Get student with full profile
- `POST /api/v1/students` - Create student (creates auth user + profile + student record)
- `PUT /api/v1/students/:id` - Update student
- `POST /api/v1/students/bulk-import` - Excel import
- `GET /api/v1/students/generate-id` - Generate next student ID

**UI Components**:
- `src/app/(dashboard)/students/page.tsx` - Student list
- `src/components/features/students/StudentTable.tsx` - Table with class/section columns
- `src/components/features/students/StudentForm.tsx` - Full student form
- `src/components/features/students/StudentCard.tsx` - Profile card view
- `src/components/features/students/BulkImport.tsx` - Excel upload with preview

**Verify**: Students created with auto-generated ID. Can filter by class/section. Bulk import works.

---

### Phase 3.4: Parent-Student Linking
**Goal**: Link parents to their children with selection flow.

**Database (Supabase Migration)**:
```sql
CREATE TABLE public.parent_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL, -- 'father', 'mother', 'guardian'
  is_primary BOOLEAN DEFAULT FALSE,
  can_approve BOOLEAN DEFAULT TRUE, -- Can approve leaves, events
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent_user_id, student_id)
);

-- Add current child selection to profiles
ALTER TABLE public.profiles ADD COLUMN current_student_id UUID REFERENCES public.students(id);

ALTER TABLE public.parent_students ENABLE ROW LEVEL SECURITY;
```

**API Endpoints**:
- `GET /api/v1/parents/:id/children` - List parent's children
- `POST /api/v1/parents/:id/children` - Link child to parent
- `DELETE /api/v1/parents/:id/children/:studentId` - Unlink child
- `POST /api/v1/auth/select-child` - Set current child in session
- `GET /api/v1/auth/current-child` - Get selected child

**UI Components**:
- `src/app/(auth)/select-child/page.tsx` - Child selection after branch selection
- `src/components/features/parents/ChildSelector.tsx` - Child cards
- `src/components/features/parents/LinkChildModal.tsx` - Search and link child
- `src/components/layout/ChildSwitcher.tsx` - Header dropdown for parents

**Verify**: Parent can link children. Child selection persists. Parent sees only their children's data.

---

### Phase 3.5: Staff Management
**Goal**: Teacher and staff profiles with replacement workflow.

**Database (Supabase Migration)**:
```sql
CREATE TABLE public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  employee_id TEXT,
  department TEXT,
  join_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  deactivated_at TIMESTAMPTZ,
  deactivation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
```

**API Endpoints**:
- `GET /api/v1/staff` - List staff (filterable by role, status)
- `GET /api/v1/staff/:id` - Get staff details
- `POST /api/v1/staff` - Create staff member
- `PUT /api/v1/staff/:id` - Update staff
- `POST /api/v1/staff/:id/deactivate` - Deactivate with replacement selection
- `GET /api/v1/staff/:id/assignments` - Get teacher's class/subject assignments

**UI Components**:
- `src/app/(dashboard)/staff/page.tsx` - Staff list
- `src/components/features/staff/StaffTable.tsx` - Table with role/status
- `src/components/features/staff/StaffForm.tsx` - Staff form
- `src/components/features/staff/DeactivateModal.tsx` - Replacement selection modal
- `src/components/features/staff/AssignmentsList.tsx` - Shows teacher's assignments

**Verify**: Staff CRUD works. Deactivation requires replacement if has assignments. Inactive staff visible in history.

---

## Prompt 4: Academic Structure & Teacher Mapping

### Context
Connect teachers to classes, sections, and subjects. Foundation for attendance, grades, and timetable.

### Phase 4.1: Class-Section Management
**Goal**: Create class-section combinations for student enrollment.

**Database (Supabase Migration)**:
```sql
CREATE TABLE public.class_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.sections(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE,
  capacity INT DEFAULT 30,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, section_id, branch_id, academic_year_id)
);

CREATE INDEX idx_class_sections_branch ON public.class_sections(branch_id, academic_year_id);

ALTER TABLE public.class_sections ENABLE ROW LEVEL SECURITY;
```

**API Endpoints**:
- `GET /api/v1/class-sections` - List all class-sections for active year
- `POST /api/v1/class-sections` - Create class-section
- `PUT /api/v1/class-sections/:id` - Update capacity
- `DELETE /api/v1/class-sections/:id` - Delete (only if no students enrolled)
- `GET /api/v1/class-sections/:id/students` - List students in class-section

**UI Components**:
- `src/app/(dashboard)/academic/class-sections/page.tsx` - Class-section grid
- `src/components/features/academic/ClassSectionGrid.tsx` - Visual grid (class rows × section cols)
- `src/components/features/academic/ClassSectionCard.tsx` - Card with student count
- `src/components/features/academic/CreateClassSectionModal.tsx` - Bulk create

**Verify**: Grid shows all combinations. Student count displays. Can't delete with enrolled students.

---

### Phase 4.2: Class Teacher Assignment
**Goal**: Assign one class teacher per class-section.

**Database (Supabase Migration)**:
```sql
ALTER TABLE public.class_sections ADD COLUMN class_teacher_id UUID REFERENCES public.staff(id);
```

**API Endpoints**:
- `PUT /api/v1/class-sections/:id/class-teacher` - Assign class teacher
- `GET /api/v1/staff/:id/class-teacher-of` - Get sections where staff is class teacher

**UI Components**:
- Update `ClassSectionCard.tsx` - Show class teacher name
- `src/components/features/academic/AssignClassTeacherModal.tsx` - Staff dropdown

**Verify**: Each class-section shows assigned teacher. Teacher sees their class on dashboard.

---

### Phase 4.3: Subject-Teacher Mapping (List View)
**Goal**: Map subject teachers to class-sections with list view.

**Database (Supabase Migration)**:
```sql
CREATE TABLE public.teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  class_section_id UUID REFERENCES public.class_sections(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subject_id, class_section_id, academic_year_id)
);

CREATE INDEX idx_teacher_assignments_staff ON public.teacher_assignments(staff_id);
CREATE INDEX idx_teacher_assignments_class ON public.teacher_assignments(class_section_id);

ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;
```

**API Endpoints**:
- `GET /api/v1/teacher-assignments` - List all assignments (filterable)
- `POST /api/v1/teacher-assignments` - Create assignment
- `PUT /api/v1/teacher-assignments/:id` - Update (change teacher)
- `DELETE /api/v1/teacher-assignments/:id` - Remove assignment
- `GET /api/v1/teacher-assignments/by-teacher/:staffId` - Get teacher's assignments
- `GET /api/v1/teacher-assignments/by-class/:classSectionId` - Get class's subjects/teachers

**UI Components**:
- `src/app/(dashboard)/academic/teacher-mapping/page.tsx` - Teacher mapping page
- `src/components/features/academic/TeacherMappingList.tsx` - List view
- `src/components/features/academic/AssignmentRow.tsx` - Row with teacher dropdown
- `src/components/features/academic/CreateAssignmentModal.tsx` - Subject + class + teacher

**Verify**: Assignments persist. Can filter by teacher/class/subject. No duplicate subject-class.

---

### Phase 4.4: Subject-Teacher Mapping (Matrix View)
**Goal**: Visual matrix view for bulk assignment editing.

**Database**: No changes

**API Endpoints**: Use existing endpoints

**UI Components**:
- `src/components/features/academic/TeacherMappingMatrix.tsx` - Matrix grid
- `src/components/features/academic/MatrixCell.tsx` - Editable cell with teacher dropdown
- Toggle between List and Matrix views on mapping page

**Verify**: Matrix shows subjects as columns, class-sections as rows. Clicking cell opens teacher dropdown. Changes save.

---

### Phase 4.5: Teacher Schedule View
**Goal**: Individual teacher view of their assignments.

**Database**: No changes

**API Endpoints**:
- `GET /api/v1/staff/:id/schedule` - Get teacher's full schedule

**UI Components**:
- `src/app/(dashboard)/staff/:id/schedule/page.tsx` - Teacher schedule page
- `src/components/features/staff/TeacherSchedule.tsx` - Weekly grid view
- `src/components/features/staff/ScheduleCard.tsx` - Class-subject card

**Verify**: Teacher sees all their assignments. Schedule shows weekly view (placeholder until timetable).

---

## Prompt 5: Attendance Management

### Context
Daily attendance marking by class teachers with parent notifications.

### Phase 5.1: Attendance Records Table
**Goal**: Database structure for daily attendance.

**Database (Supabase Migration)**:
```sql
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'excused');

CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  class_section_id UUID REFERENCES public.class_sections(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status attendance_status NOT NULL,
  entry_time TIME,
  exit_time TIME,
  notes TEXT,
  marked_by UUID REFERENCES auth.users(id),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, date, academic_year_id)
);

CREATE INDEX idx_attendance_date ON public.attendance(date, class_section_id);
CREATE INDEX idx_attendance_student ON public.attendance(student_id, date);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- RLS: Teachers can only mark attendance for their class-sections
CREATE POLICY "Teachers mark own class attendance" ON public.attendance
  FOR ALL USING (
    class_section_id IN (
      SELECT cs.id FROM public.class_sections cs
      WHERE cs.class_teacher_id IN (
        SELECT id FROM public.staff WHERE user_id = auth.uid()
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'principal')
    )
  );
```

**API Endpoints**:
- `GET /api/v1/attendance` - List attendance (date, class-section filters)
- `GET /api/v1/attendance/class/:classSectionId/date/:date` - Get class attendance for date
- `POST /api/v1/attendance/bulk` - Bulk mark attendance for class
- `PUT /api/v1/attendance/:id` - Update single record
- `GET /api/v1/attendance/student/:studentId` - Get student's attendance history

**UI Components**: (Phase 5.2)

**Verify**: Migration runs. RLS policies work.

---

### Phase 5.2: Attendance Marking UI
**Goal**: Class teacher marks daily attendance for their class.

**Database**: No changes

**API Endpoints**: Use from 5.1

**UI Components**:
- `src/app/(dashboard)/attendance/page.tsx` - Attendance landing page
- `src/app/(dashboard)/attendance/mark/page.tsx` - Mark attendance page
- `src/components/features/attendance/AttendanceSheet.tsx` - Student list with status toggles
- `src/components/features/attendance/StudentRow.tsx` - Name, photo, status buttons, time inputs
- `src/components/features/attendance/AttendanceStats.tsx` - Present/absent/late counts
- `src/hooks/useAttendance.ts` - Attendance CRUD hooks

**Verify**: Teacher sees only their class(es). Can mark present/absent/late. Entry time auto-fills. Changes save.

---

### Phase 5.3: Attendance History & Reports
**Goal**: View attendance history and generate reports.

**Database**: No changes

**API Endpoints**:
- `GET /api/v1/attendance/report` - Generate attendance report (date range, class)
- `GET /api/v1/attendance/summary/student/:studentId` - Student attendance summary
- `GET /api/v1/attendance/summary/class/:classSectionId` - Class attendance summary

**UI Components**:
- `src/app/(dashboard)/attendance/history/page.tsx` - History with date picker
- `src/components/features/attendance/AttendanceCalendar.tsx` - Calendar view with color-coded days
- `src/components/features/attendance/AttendanceReport.tsx` - Summary stats, percentage
- `src/components/features/attendance/StudentAttendanceCard.tsx` - Individual student view

**Verify**: Calendar shows attendance by color. Reports calculate correct percentages. Can view by date range.

---

### Phase 5.4: Parent Attendance View & Notifications
**Goal**: Parents see child's attendance with real-time notifications.

**Database (Supabase Migration)**:
```sql
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'attendance', 'leave', 'event', 'grade', 'message'
  title TEXT NOT NULL,
  body TEXT,
  data JSONB, -- Additional data for click-through
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications" ON public.notifications
  FOR ALL USING (user_id = auth.uid());
```

**API Endpoints**:
- `GET /api/v1/notifications` - List user's notifications (paginated)
- `PUT /api/v1/notifications/:id/read` - Mark as read
- `PUT /api/v1/notifications/read-all` - Mark all as read
- Internal: Create notification when attendance marked

**UI Components**:
- `src/app/(dashboard)/attendance/child/page.tsx` - Parent view of child's attendance
- `src/components/features/attendance/ChildAttendanceView.tsx` - Calendar + stats for child
- `src/components/layout/NotificationBell.tsx` - Header notification icon with count
- `src/components/layout/NotificationDropdown.tsx` - Recent notifications list
- `src/app/(dashboard)/notifications/page.tsx` - Full notifications page

**Verify**: Parent sees only selected child's attendance. Notification created when child marked present/absent.

---

### Phase 5.5: Attendance Dashboard Widget
**Goal**: Dashboard widgets showing attendance summary.

**Database**: No changes

**API Endpoints**:
- `GET /api/v1/dashboard/attendance` - Dashboard attendance data

**UI Components**:
- `src/components/features/dashboard/AttendanceWidget.tsx` - Today's stats for teacher
- `src/components/features/dashboard/ChildAttendanceWidget.tsx` - Today's status for parent
- Update dashboard pages to include widgets

**Verify**: Teacher dashboard shows class attendance. Parent dashboard shows child's status for today.

---

## Usage Instructions

### For Each Prompt
1. Copy the prompt section to Cursor
2. Implement phase by phase
3. Test each phase before moving to next
4. Update `overallcontext.md` after completing the prompt
5. Log any mistakes in `mistakes.md`
6. Update `docs/contracts.md` with finalized API specs

### Dependency Chain
```
Prompt 0 (Setup) 
    ↓
Prompt 1 (Settings) → Required by all features
    ↓
Prompt 2 (Branches) → Required for data isolation
    ↓
Prompt 3 (Users) → Required for roles, students, staff
    ↓
Prompt 4 (Academic) → Required for teacher mapping
    ↓
Prompt 5 (Attendance) → Uses all above
```

### Key Principles
- Always filter by `branch_id` and `academic_year_id`
- Use React Query for all data fetching
- Validate with Zod (frontend) and class-validator (backend)
- Wrap all responses in `{ data, meta, error }` format
- Add JwtAuthGuard to ALL endpoints
- Use Mantine components only, NO Tailwind

---

## Prompt 6: Leave & Early Departure Management

### Context
Leave requests and early departure workflows for parents with staff approval, quota tracking, and integration with attendance data.

### Phase 6.1: Leave Requests Table & Workflow
**Goal**: Database structure and API for parent-initiated leave requests with approval workflow.

**Database (Supabase Migration)**:
```sql
CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES auth.users(id), -- Parent who requested
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  attachment_url TEXT, -- Optional document
  status leave_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id), -- Staff who reviewed
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leave_requests_student ON public.leave_requests(student_id, academic_year_id);
CREATE INDEX idx_leave_requests_status ON public.leave_requests(status, branch_id);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- RLS: Parents see their own requests, staff see all for their branch
CREATE POLICY "Leave request access" ON public.leave_requests
  FOR ALL USING (
    requested_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() 
      AND ur.branch_id = leave_requests.branch_id
      AND r.name IN ('school_admin', 'principal', 'class_teacher', 'admin_assistant')
    )
  );
```

**API Endpoints**:
- `GET /api/v1/leave-requests` - List requests (filters: studentId, status, dateRange, branch)
- `GET /api/v1/leave-requests/:id` - Get request details
- `POST /api/v1/leave-requests` - Create leave request (Parent)
- `PUT /api/v1/leave-requests/:id/approve` - Approve request (Staff)
- `PUT /api/v1/leave-requests/:id/reject` - Reject request (Staff)
- `PUT /api/v1/leave-requests/:id/cancel` - Cancel request (Parent, only if pending)
- `GET /api/v1/leave-requests/quota/:studentId` - Get student's leave quota usage

**UI Components**:
- `src/app/leaves/page.tsx` - Leave requests landing page
- `src/app/leaves/request/page.tsx` - Create leave request form (Parent)
- `src/components/features/leaves/LeaveRequestForm.tsx` - Form with date picker, reason, attachment upload
- `src/components/features/leaves/LeaveRequestCard.tsx` - Card showing request status, dates, actions
- `src/components/features/leaves/LeaveQuotaIndicator.tsx` - Shows used/total quota
- `src/components/features/leaves/LeaveApprovalModal.tsx` - Staff approval/rejection modal
- `src/hooks/useLeaveRequests.ts` - CRUD hooks

**Verify**: Parent can request leave, staff can approve/reject, quota updates correctly, notifications sent.

---

### Phase 6.2: Early Departure Requests
**Goal**: Parent-initiated early departure requests with staff approval workflow.

**Database (Supabase Migration)**:
```sql
CREATE TYPE early_departure_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.early_departure_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES auth.users(id),
  date DATE NOT NULL,
  departure_time TIME NOT NULL,
  reason TEXT,
  attachment_url TEXT,
  status early_departure_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_early_departure_student ON public.early_departure_requests(student_id, date);
CREATE INDEX idx_early_departure_status ON public.early_departure_requests(status, branch_id);

ALTER TABLE public.early_departure_requests ENABLE ROW LEVEL SECURITY;
```

**API Endpoints**:
- `GET /api/v1/early-departures` - List requests
- `POST /api/v1/early-departures` - Create request (Parent)
- `PUT /api/v1/early-departures/:id/approve` - Approve (Staff)
- `PUT /api/v1/early-departures/:id/reject` - Reject (Staff)

**UI Components**:
- `src/app/early-departure/page.tsx` - Early departure requests page
- `src/components/features/early-departure/EarlyDepartureForm.tsx` - Request form
- `src/components/features/early-departure/EarlyDepartureCard.tsx` - Request card
- `src/hooks/useEarlyDepartures.ts` - CRUD hooks

**Verify**: Parent can request early departure, staff can approve/reject, no quota limitations.

---

### Phase 6.3: Integration with Attendance & Notifications
**Goal**: Link leave/early departure with attendance records and send notifications.

**Database**: No new tables

**API Updates**:
- Update attendance marking to auto-mark "excused" for approved leave dates
- Create notifications for parents on approval/rejection
- Create notifications for staff on new requests

**UI Updates**:
- Attendance view shows leave/early departure indicators
- Parent dashboard shows pending requests and recent approvals
- Staff dashboard shows pending requests requiring action

**Verify**: Approved leaves reflect in attendance, notifications work for all parties.

---

## Prompt 7: Timetable & Schedule Management

### Context
Weekly class and teacher schedules with conflict detection, building on teacher assignments from Prompt 4.

### Phase 7.1: Timetable Structure
**Goal**: Database structure for weekly class timetables.

**Database (Supabase Migration)**:
```sql
CREATE TABLE public.timetable_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_section_id UUID REFERENCES public.class_sections(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  period_number INT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  subject_id UUID REFERENCES public.subjects(id),
  staff_id UUID REFERENCES public.staff(id), -- Teacher assigned
  room TEXT, -- Optional room/location
  slot_type TEXT NOT NULL DEFAULT 'class' CHECK (slot_type IN ('class', 'assembly', 'break', 'free')),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_section_id, day_of_week, period_number, academic_year_id)
);

CREATE INDEX idx_timetable_class_section ON public.timetable_slots(class_section_id, day_of_week);
CREATE INDEX idx_timetable_teacher ON public.timetable_slots(staff_id, day_of_week);

ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;
```

**API Endpoints**:
- `GET /api/v1/timetable/class/:classSectionId` - Get class timetable
- `GET /api/v1/timetable/teacher/:staffId` - Get teacher timetable
- `POST /api/v1/timetable/slots` - Create/update slot
- `DELETE /api/v1/timetable/slots/:id` - Delete slot
- `POST /api/v1/timetable/generate` - Auto-generate from timing template
- `GET /api/v1/timetable/conflicts` - Check for conflicts

**UI Components**:
- `src/app/timetable/page.tsx` - Timetable management landing
- `src/app/timetable/class/:classSectionId/page.tsx` - Class timetable view/edit
- `src/components/features/timetable/TimetableGrid.tsx` - Weekly grid (days × periods)
- `src/components/features/timetable/TimetableSlot.tsx` - Individual slot (subject, teacher, room)
- `src/components/features/timetable/SlotEditModal.tsx` - Edit slot details
- `src/components/features/timetable/ConflictWarning.tsx` - Shows teacher conflicts
- `src/hooks/useTimetable.ts` - CRUD hooks

**Verify**: Can create timetable, slots validate against timing template, no duplicate periods.

---

### Phase 7.2: Teacher Schedule View
**Goal**: Individual teacher weekly schedule derived from timetable.

**Database**: No changes (uses existing timetable_slots)

**API Endpoints**:
- `GET /api/v1/timetable/teacher/:staffId/week` - Weekly schedule
- `GET /api/v1/timetable/teacher/me` - Current teacher's schedule

**UI Components**:
- Update `src/app/my-schedule/page.tsx` - Show actual timetable (not just assignments)
- `src/components/features/timetable/TeacherWeekView.tsx` - Teacher's weekly grid
- `src/components/features/timetable/FreePeriodsIndicator.tsx` - Shows free periods

**Verify**: Teacher sees their weekly schedule, free periods highlighted.

---

### Phase 7.3: Conflict Detection & Validation
**Goal**: Detect and warn about teacher scheduling conflicts.

**Database**: No changes

**API Endpoints**:
- `GET /api/v1/timetable/validate` - Full validation of current timetable
- `GET /api/v1/timetable/teacher/:staffId/conflicts` - Teacher-specific conflicts

**Backend Logic**:
- Check teacher not double-booked (same time, different classes)
- Warn if teacher exceeds max periods per day
- Validate against school days and timing templates
- Check for gaps between periods (using timing template duration)

**UI Components**:
- `src/components/features/timetable/ConflictList.tsx` - List of all conflicts
- Inline warnings in TimetableGrid when creating/editing slots

**Verify**: Conflicts detected and displayed, cannot save conflicting slot without override.

---

## Prompt 8: Assessment & Grade Management

### Context
Assessment creation using templates, grade entry, student submission tracking, and performance analytics.

### Phase 8.1: Assessment Creation
**Goal**: Create assessments using configured assessment types and templates.

**Database (Supabase Migration)**:
```sql
CREATE TABLE public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  assessment_type_id UUID REFERENCES public.assessment_types(id),
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  class_section_id UUID REFERENCES public.class_sections(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  total_marks DECIMAL(5,2) NOT NULL,
  due_date DATE,
  publish_date DATE,
  is_published BOOLEAN DEFAULT FALSE,
  allow_late_submission BOOLEAN DEFAULT FALSE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assessment attachments (teacher uploads)
CREATE TABLE public.assessment_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID REFERENCES public.assessments(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size_bytes BIGINT,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assessments_class ON public.assessments(class_section_id, academic_year_id);
CREATE INDEX idx_assessments_subject ON public.assessments(subject_id);

ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_attachments ENABLE ROW LEVEL SECURITY;
```

**API Endpoints**:
- `GET /api/v1/assessments` - List assessments (filters: classSectionId, subjectId, typeId, status)
- `GET /api/v1/assessments/:id` - Get assessment details with attachments
- `POST /api/v1/assessments` - Create assessment
- `PUT /api/v1/assessments/:id` - Update assessment
- `DELETE /api/v1/assessments/:id` - Delete (only if no grades entered)
- `POST /api/v1/assessments/:id/publish` - Publish assessment
- `POST /api/v1/assessments/:id/attachments` - Upload attachment (max 10MB)

**UI Components**:
- `src/app/assessments/page.tsx` - Assessments list
- `src/app/assessments/create/page.tsx` - Create assessment form
- `src/components/features/assessments/AssessmentForm.tsx` - Full form with file upload
- `src/components/features/assessments/AssessmentCard.tsx` - Assessment card with status
- `src/components/features/assessments/AttachmentUpload.tsx` - File upload component
- `src/hooks/useAssessments.ts` - CRUD hooks

**Verify**: Can create assessment, attach files, publish to students.

---

### Phase 8.2: Grade Entry & Submission Tracking
**Goal**: Enter grades for students, track submissions and late work.

**Database (Supabase Migration)**:
```sql
CREATE TABLE public.student_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID REFERENCES public.assessments(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  marks_obtained DECIMAL(5,2),
  submission_status TEXT DEFAULT 'not_submitted' CHECK (submission_status IN ('not_submitted', 'submitted', 'late', 'excused')),
  submitted_at TIMESTAMPTZ,
  graded_by UUID REFERENCES auth.users(id),
  graded_at TIMESTAMPTZ,
  feedback TEXT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assessment_id, student_id)
);

CREATE INDEX idx_grades_assessment ON public.student_grades(assessment_id);
CREATE INDEX idx_grades_student ON public.student_grades(student_id);

ALTER TABLE public.student_grades ENABLE ROW LEVEL SECURITY;
```

**API Endpoints**:
- `GET /api/v1/assessments/:id/grades` - Get all grades for assessment
- `POST /api/v1/assessments/:id/grades/bulk` - Bulk enter grades
- `PUT /api/v1/grades/:id` - Update single grade
- `GET /api/v1/students/:id/grades` - Get student's all grades
- `PUT /api/v1/grades/:id/submission-status` - Mark as submitted/late/not submitted

**UI Components**:
- `src/app/assessments/:id/grades/page.tsx` - Grade entry page
- `src/components/features/assessments/GradeEntrySheet.tsx` - Spreadsheet-like grade entry
- `src/components/features/assessments/StudentGradeRow.tsx` - Row with marks input, status dropdown
- `src/components/features/assessments/SubmissionStats.tsx` - Submitted/Late/Missing counts
- `src/hooks/useGrades.ts` - Grade CRUD hooks

**Verify**: Can enter grades for all students, mark submissions, see statistics.

---

### Phase 8.3: Assessment Analytics & Statistics
**Goal**: View assessment and class performance statistics.

**Database**: No changes

**API Endpoints**:
- `GET /api/v1/assessments/:id/statistics` - Assessment stats (avg, min, max, distribution)
- `GET /api/v1/class-sections/:id/performance` - Class performance overview
- `GET /api/v1/subjects/:id/performance` - Subject performance across classes

**UI Components**:
- `src/components/features/assessments/AssessmentStats.tsx` - Stats display (charts)
- `src/components/features/assessments/GradeDistributionChart.tsx` - Grade distribution bar chart
- `src/components/features/assessments/ClassComparisonChart.tsx` - Compare class averages

**Verify**: Statistics calculated correctly, charts display properly.

---

## Prompt 9: Events & Communication

### Context
Event management with consent workflows and teacher-student-parent messaging system.

### Phase 9.1: Event Management
**Goal**: Create events with consent requirements and conflict detection.

**Database (Supabase Migration)**:
```sql
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL, -- 'field_trip', 'sports', 'cultural', 'academic', 'other'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  location TEXT,
  requires_consent BOOLEAN DEFAULT FALSE,
  consent_deadline DATE,
  target_type TEXT NOT NULL CHECK (target_type IN ('all', 'level', 'class', 'section')),
  target_level_id UUID REFERENCES public.levels(id),
  target_class_id UUID REFERENCES public.classes(id),
  target_section_id UUID REFERENCES public.class_sections(id),
  created_by UUID REFERENCES auth.users(id),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.event_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  parent_user_id UUID REFERENCES auth.users(id),
  consent_status TEXT NOT NULL CHECK (consent_status IN ('pending', 'approved', 'rejected')),
  responded_at TIMESTAMPTZ,
  ip_address TEXT, -- For audit trail
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, student_id)
);

CREATE INDEX idx_events_branch ON public.events(branch_id, start_date);
CREATE INDEX idx_event_consents_event ON public.event_consents(event_id, consent_status);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_consents ENABLE ROW LEVEL SECURITY;
```

**API Endpoints**:
- `GET /api/v1/events` - List events (filters: dateRange, type, targetType)
- `GET /api/v1/events/:id` - Get event details with consent stats
- `POST /api/v1/events` - Create event
- `PUT /api/v1/events/:id` - Update event
- `DELETE /api/v1/events/:id` - Delete event
- `GET /api/v1/events/:id/consents` - Get consent responses
- `POST /api/v1/events/:id/consent` - Submit consent (Parent)
- `GET /api/v1/events/conflicts` - Check for conflicts with assessments/other events

**UI Components**:
- `src/app/events/page.tsx` - Events list with calendar view
- `src/app/events/create/page.tsx` - Create event form
- `src/components/features/events/EventForm.tsx` - Event form with target selection
- `src/components/features/events/EventCard.tsx` - Event card with consent progress
- `src/components/features/events/ConsentModal.tsx` - Parent consent form
- `src/components/features/events/ConsentList.tsx` - List of consent responses
- `src/components/features/events/EventCalendar.tsx` - Calendar view of events
- `src/hooks/useEvents.ts` - CRUD hooks

**Verify**: Can create events, parents receive consent requests, conflict detection works.

---

### Phase 9.2: Messaging System
**Goal**: Teacher-student-parent messaging with configurable direction.

**Database (Supabase Migration)**:
```sql
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id),
  message_type TEXT NOT NULL CHECK (message_type IN ('event', 'meeting', 'grade', 'other')),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  is_broadcast BOOLEAN DEFAULT FALSE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.message_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES auth.users(id),
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('student', 'parent', 'teacher', 'class')),
  class_section_id UUID REFERENCES public.class_sections(id), -- For broadcast to class
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_sender ON public.messages(sender_id, created_at DESC);
CREATE INDEX idx_message_recipients_user ON public.message_recipients(recipient_id, is_read);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_recipients ENABLE ROW LEVEL SECURITY;
```

**API Endpoints**:
- `GET /api/v1/messages/inbox` - Get user's received messages
- `GET /api/v1/messages/sent` - Get user's sent messages
- `GET /api/v1/messages/:id` - Get message details
- `POST /api/v1/messages` - Send message (one-to-one or broadcast)
- `PUT /api/v1/messages/:id/read` - Mark as read
- `GET /api/v1/messages/unread-count` - Get unread count

**UI Components**:
- `src/app/messages/page.tsx` - Messages inbox
- `src/app/messages/compose/page.tsx` - Compose message
- `src/components/features/messages/MessageList.tsx` - List of messages
- `src/components/features/messages/MessageCard.tsx` - Message preview card
- `src/components/features/messages/ComposeForm.tsx` - Compose form with recipient selector
- `src/components/features/messages/RecipientSelector.tsx` - Select student/parent/class
- `src/components/features/messages/MessageBadge.tsx` - Type badge (color-coded)
- `src/hooks/useMessages.ts` - CRUD hooks

**Verify**: Can send/receive messages, broadcast to class works, respects communication direction setting.

---

## Prompt 10: Student Reports & Behavioral Assessment

### Context
Comprehensive student reports combining academic, attendance, and behavioral data with ranking/percentile display.

### Phase 10.1: Behavioral Assessment System
**Goal**: Star-based monthly behavioral questionnaire filled by teachers.

**Database (Supabase Migration)**:
```sql
CREATE TABLE public.behavioral_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  assessed_by UUID REFERENCES auth.users(id), -- Teacher
  assessment_month DATE NOT NULL, -- First day of month
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, assessed_by, assessment_month)
);

CREATE TABLE public.behavioral_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  behavioral_assessment_id UUID REFERENCES public.behavioral_assessments(id) ON DELETE CASCADE,
  attribute_name TEXT NOT NULL, -- e.g., 'Discipline', 'Class Engagement'
  score INT NOT NULL CHECK (score BETWEEN 1 AND 5), -- 1-5 stars
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_behavioral_student ON public.behavioral_assessments(student_id, assessment_month);
CREATE INDEX idx_behavioral_teacher ON public.behavioral_assessments(assessed_by, assessment_month);

ALTER TABLE public.behavioral_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.behavioral_scores ENABLE ROW LEVEL SECURITY;
```

**API Endpoints**:
- `GET /api/v1/behavioral/pending` - Get students pending assessment this month
- `GET /api/v1/behavioral/student/:id` - Get student's behavioral history
- `POST /api/v1/behavioral` - Submit behavioral assessment
- `PUT /api/v1/behavioral/:id` - Update assessment
- `GET /api/v1/behavioral/matrix/:classSectionId` - Get matrix view for class

**UI Components**:
- `src/app/behavioral/page.tsx` - Behavioral assessment landing
- `src/app/behavioral/assess/page.tsx` - Matrix entry view
- `src/components/features/behavioral/BehavioralMatrix.tsx` - Students × Attributes matrix
- `src/components/features/behavioral/StarRating.tsx` - 1-5 star input
- `src/components/features/behavioral/BehavioralHistory.tsx` - Student's history chart
- `src/hooks/useBehavioral.ts` - CRUD hooks

**Verify**: Teachers can assess monthly, matrix view works, respects mandatory/optional setting.

---

### Phase 10.2: Student Report Generation
**Goal**: Comprehensive reports combining all data with ranking.

**Database**: No new tables (aggregates existing data)

**API Endpoints**:
- `GET /api/v1/reports/student/:id` - Full student report (configurable period)
- `GET /api/v1/reports/student/:id/academic` - Academic-only report
- `GET /api/v1/reports/student/:id/attendance` - Attendance-only report
- `GET /api/v1/reports/class/:classSectionId` - Class performance report
- `GET /api/v1/reports/rankings/:classSectionId/:subjectId` - Subject rankings

**Report Data Structure**:
- Academic: Subject-wise marks, grades, rank/percentile
- Attendance: Present/absent/late counts, percentage
- Behavioral: Attribute averages by period
- Rankings: Top 3 show rank, others show percentile (e.g., "Top 40%")

**UI Components**:
- `src/app/reports/student/:id/page.tsx` - Student report view
- `src/app/reports/class/:classSectionId/page.tsx` - Class report view
- `src/components/features/reports/StudentReportCard.tsx` - Full report card
- `src/components/features/reports/AcademicSection.tsx` - Grades table with rank
- `src/components/features/reports/AttendanceSection.tsx` - Attendance summary
- `src/components/features/reports/BehavioralSection.tsx` - Behavioral averages
- `src/components/features/reports/RankBadge.tsx` - Rank or percentile display
- `src/hooks/useReports.ts` - Report hooks

**Verify**: Reports show all data correctly, rankings calculated per subject.

---

### Phase 10.3: Report Export (PDF/Excel)
**Goal**: Export reports in PDF and Excel formats.

**Database**: No changes

**API Endpoints**:
- `GET /api/v1/reports/student/:id/export/pdf` - Export student report as PDF
- `GET /api/v1/reports/student/:id/export/excel` - Export as Excel
- `GET /api/v1/reports/class/:classSectionId/export/excel` - Export class report

**Backend Logic**:
- Use server-side PDF generation (e.g., PDFKit, Puppeteer)
- Use server-side Excel generation (e.g., ExcelJS)
- PDF: Formatted view with school header
- Excel: Data tables, one sheet per section

**UI Components**:
- `src/components/features/reports/ExportButton.tsx` - Download button with format selection
- `src/components/features/reports/ExportProgress.tsx` - Progress indicator for large exports

**Verify**: PDF and Excel downloads work, formatting is correct.

---

## Updated Dependency Chain

```
Prompt 0 (Setup) 
    ↓
Prompt 1 (Settings) → Required by all features
    ↓
Prompt 2 (Branches) → Required for data isolation
    ↓
Prompt 3 (Users) → Required for roles, students, staff
    ↓
Prompt 4 (Academic) → Required for teacher mapping
    ↓
Prompt 5 (Attendance) → Uses all above
    ↓
Prompt 6 (Leaves/Early Departure) → Uses attendance, students, notifications
    ↓
Prompt 7 (Timetable) → Uses academic structure, teacher mapping
    ↓
Prompt 8 (Assessments) → Uses academic structure, grade templates
    ↓
Prompt 9 (Events/Communication) → Uses users, notifications
    ↓
Prompt 10 (Reports) → Aggregates all data for comprehensive reports
```

---

## Prompt 11: Library & Digital Resources

### Context
Digital library for textbooks, reference materials, and PDFs with categorised browsing, metadata management, and storage quota integration.

### Phase 11.1: Library Items Table & CRUD
**Goal**: Database structure and API for library resources.

**Database (Supabase Migration)**:
```sql
CREATE TABLE public.library_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author TEXT,
  description TEXT,
  subject_id UUID REFERENCES public.subjects(id),
  class_id UUID REFERENCES public.classes(id),
  category TEXT NOT NULL, -- From system_settings 'library_categories'
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  thumbnail_url TEXT, -- Auto-generated for PDFs
  is_active BOOLEAN DEFAULT TRUE,
  view_count INT DEFAULT 0,
  download_count INT DEFAULT 0,
  uploaded_by UUID REFERENCES auth.users(id),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_library_items_branch ON public.library_items(branch_id, category);
CREATE INDEX idx_library_items_subject ON public.library_items(subject_id);
CREATE INDEX idx_library_items_class ON public.library_items(class_id);

ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY;

-- RLS: Branch isolation with role-based access per permissions matrix
CREATE POLICY "Library access" ON public.library_items
  FOR ALL USING (
    branch_id IN (
      SELECT branch_id FROM public.user_branches WHERE user_id = auth.uid()
    )
  );
```

**API Endpoints**:
- `GET /api/v1/library` - List items (filters: category, subjectId, classId, search, pagination)
- `GET /api/v1/library/:id` - Get item details
- `POST /api/v1/library` - Upload new item (Admin/Teachers with edit permission)
- `PUT /api/v1/library/:id` - Update metadata
- `DELETE /api/v1/library/:id` - Delete item (removes from storage)
- `GET /api/v1/library/:id/download` - Download file (tracks download count)
- `GET /api/v1/library/categories` - Get categories from system settings

**UI Components**:
- `src/app/library/page.tsx` - Library landing with grid/list toggle
- `src/components/features/library/LibraryGrid.tsx` - Card grid view
- `src/components/features/library/LibraryList.tsx` - Table view
- `src/components/features/library/LibraryItemCard.tsx` - Card with thumbnail, title, metadata
- `src/components/features/library/LibraryFilters.tsx` - Category, subject, class filters
- `src/components/features/library/UploadModal.tsx` - File upload with metadata form
- `src/hooks/useLibrary.ts` - CRUD hooks

**Verify**: Can upload PDFs (max 100MB), view items by category, download tracks count.

---

### Phase 11.2: File Upload & Storage Integration
**Goal**: File upload with automatic compression and storage quota management.

**Database**: No changes (uses existing branches.storage_used_bytes)

**API Endpoints**:
- `POST /api/v1/library/upload` - Upload file with progress
- `GET /api/v1/library/storage` - Get storage usage breakdown

**Backend Logic**:
- Validate file size (max 100MB per file)
- Automatic image compression (1920px max width, 85% quality)
- Generate PDF thumbnails for preview
- Update `branches.storage_used_bytes` on upload/delete
- Reject upload if branch storage quota exceeded

**UI Components**:
- `src/components/features/library/FileUploader.tsx` - Drag-drop upload with progress
- `src/components/features/library/StorageQuotaBar.tsx` - Shows used/total storage
- `src/components/features/library/CompressionNotice.tsx` - Shows compression applied

**Verify**: Large images compressed, storage quota enforced, thumbnails generated.

---

### Phase 11.3: Browse, Search & View
**Goal**: User-facing library browsing with search and categorised views.

**Database**: No changes

**API Endpoints**:
- `GET /api/v1/library/search` - Full-text search on title, author, description
- `POST /api/v1/library/:id/view` - Track view count

**UI Components**:
- `src/components/features/library/SearchBar.tsx` - Search with autocomplete
- `src/components/features/library/CategoryBrowser.tsx` - Browse by category tabs
- `src/components/features/library/PDFViewer.tsx` - In-app PDF preview (optional download)
- `src/components/features/library/LibraryStats.tsx` - View/download statistics

**Verify**: Search works across fields, view counts increment, PDF preview works.

---

## Prompt 12: Uniform Inventory Management

### Context
Track uniform items, sizes, and stock levels with parent request workflow and distribution history. No payment processing.

### Phase 12.1: Inventory Structure
**Goal**: Database structure for uniform items and stock levels.

**Database (Supabase Migration)**:
```sql
CREATE TABLE public.uniform_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- e.g., "Boys Shirt", "Girls Skirt"
  item_code TEXT,
  category TEXT NOT NULL, -- 'shirt', 'pants', 'skirt', 'shoes', 'accessories'
  gender TEXT CHECK (gender IN ('male', 'female', 'unisex')),
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.uniform_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uniform_item_id UUID REFERENCES public.uniform_items(id) ON DELETE CASCADE,
  size TEXT NOT NULL, -- e.g., "S", "M", "L", "8", "10", "12"
  quantity INT NOT NULL DEFAULT 0,
  low_stock_threshold INT DEFAULT 10,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(uniform_item_id, size, branch_id)
);

CREATE INDEX idx_uniform_items_branch ON public.uniform_items(branch_id);
CREATE INDEX idx_uniform_stock_item ON public.uniform_stock(uniform_item_id);

ALTER TABLE public.uniform_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uniform_stock ENABLE ROW LEVEL SECURITY;
```

**API Endpoints**:
- `GET /api/v1/uniforms` - List uniform items with stock
- `GET /api/v1/uniforms/:id` - Get item with all sizes and stock
- `POST /api/v1/uniforms` - Create uniform item (Admin)
- `PUT /api/v1/uniforms/:id` - Update item
- `POST /api/v1/uniforms/:id/stock` - Add/update stock for size
- `PUT /api/v1/uniforms/stock/:stockId` - Update stock quantity
- `GET /api/v1/uniforms/low-stock` - Get items below threshold

**UI Components**:
- `src/app/inventory/page.tsx` - Inventory dashboard
- `src/app/inventory/items/page.tsx` - Manage uniform items
- `src/components/features/inventory/UniformItemCard.tsx` - Item with size grid
- `src/components/features/inventory/StockMatrix.tsx` - Size × quantity matrix
- `src/components/features/inventory/AddStockModal.tsx` - Update stock levels
- `src/components/features/inventory/LowStockAlert.tsx` - Warning banner
- `src/hooks/useInventory.ts` - CRUD hooks

**Verify**: Can create items, manage stock by size, low-stock alerts show.

---

### Phase 12.2: Parent Request Workflow
**Goal**: Parents request uniforms, admin approves and issues.

**Database (Supabase Migration)**:
```sql
CREATE TYPE uniform_request_status AS ENUM ('pending', 'approved', 'rejected', 'issued', 'cancelled');

CREATE TABLE public.uniform_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES auth.users(id), -- Parent
  status uniform_request_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  issued_by UUID REFERENCES auth.users(id),
  issued_at TIMESTAMPTZ,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.uniform_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.uniform_requests(id) ON DELETE CASCADE,
  uniform_item_id UUID REFERENCES public.uniform_items(id),
  size TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_uniform_requests_student ON public.uniform_requests(student_id);
CREATE INDEX idx_uniform_requests_status ON public.uniform_requests(status, branch_id);

ALTER TABLE public.uniform_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uniform_request_items ENABLE ROW LEVEL SECURITY;
```

**API Endpoints**:
- `GET /api/v1/uniform-requests` - List requests (filters: status, studentId)
- `GET /api/v1/uniform-requests/:id` - Get request details with items
- `POST /api/v1/uniform-requests` - Create request (Parent)
- `PUT /api/v1/uniform-requests/:id/approve` - Approve request (Admin)
- `PUT /api/v1/uniform-requests/:id/reject` - Reject request (Admin)
- `PUT /api/v1/uniform-requests/:id/issue` - Mark as issued (Admin, deducts stock)
- `PUT /api/v1/uniform-requests/:id/cancel` - Cancel request (Parent, if pending)

**UI Components**:
- `src/app/inventory/requests/page.tsx` - Request management (Admin view)
- `src/app/uniform-request/page.tsx` - Parent request form
- `src/components/features/inventory/RequestForm.tsx` - Item selection form
- `src/components/features/inventory/RequestCard.tsx` - Request with status
- `src/components/features/inventory/ApprovalModal.tsx` - Approve/reject modal
- `src/components/features/inventory/IssueModal.tsx` - Issue and deduct stock
- `src/hooks/useUniformRequests.ts` - CRUD hooks

**Verify**: Parent can request, admin approves, stock deducted on issue.

---

### Phase 12.3: Issuance History & Tracking
**Goal**: Track uniform issuance history per student.

**Database (Supabase Migration)**:
```sql
CREATE TABLE public.uniform_issuances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  uniform_item_id UUID REFERENCES public.uniform_items(id),
  size TEXT NOT NULL,
  quantity INT NOT NULL,
  issued_by UUID REFERENCES auth.users(id),
  request_id UUID REFERENCES public.uniform_requests(id), -- Optional link
  notes TEXT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  issued_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_uniform_issuances_student ON public.uniform_issuances(student_id);

ALTER TABLE public.uniform_issuances ENABLE ROW LEVEL SECURITY;
```

**API Endpoints**:
- `GET /api/v1/uniform-issuances/student/:studentId` - Get student's issuance history
- `POST /api/v1/uniform-issuances` - Direct issuance (without request)
- `GET /api/v1/uniform-issuances/report` - Issuance report (date range, item)

**UI Components**:
- `src/app/inventory/history/page.tsx` - Issuance history list
- `src/components/features/inventory/IssuanceHistory.tsx` - Student's uniform history
- `src/components/features/inventory/DirectIssueModal.tsx` - Issue without request
- `src/components/features/inventory/IssuanceReport.tsx` - Report with filters

**Verify**: History shows all issuances per student, can issue directly.

---

## Prompt 13: Administrative Reports & Public Statistics

### Context
Administrative reports with filters, role-based visibility, and public student count statistics.

### Phase 13.1: Attendance Reports
**Goal**: Comprehensive attendance reports with filters and export.

**Database**: No new tables (aggregates existing attendance data)

**API Endpoints**:
- `GET /api/v1/reports/attendance/class/:classSectionId` - Class attendance report
- `GET /api/v1/reports/attendance/summary` - Branch-wide attendance summary
- `GET /api/v1/reports/attendance/low-attendance` - Students below threshold
- `GET /api/v1/reports/attendance/export` - Export as PDF/Excel

**Report Data Structure**:
- Date range selection (week, month, custom)
- Per-student: Present days, absent days, late days, percentage
- Class summary: Average attendance, trends
- Filters: Class, section, date range, status

**UI Components**:
- `src/app/reports/attendance/page.tsx` - Attendance reports page
- `src/components/features/reports/AttendanceReportTable.tsx` - Detailed table
- `src/components/features/reports/AttendanceTrends.tsx` - Chart showing trends
- `src/components/features/reports/LowAttendanceList.tsx` - Students below threshold
- `src/components/features/reports/ReportFilters.tsx` - Common filter component
- `src/hooks/useAttendanceReports.ts` - Report hooks

**Verify**: Reports accurate, filters work, export generates correctly.

---

### Phase 13.2: Academic Performance Reports
**Goal**: Subject-wise and class-wise academic performance reports.

**Database**: No new tables (aggregates existing assessment/grade data)

**API Endpoints**:
- `GET /api/v1/reports/academic/class/:classSectionId` - Class academic report
- `GET /api/v1/reports/academic/subject/:subjectId` - Subject performance across classes
- `GET /api/v1/reports/academic/comparison` - Compare classes or subjects
- `GET /api/v1/reports/academic/export` - Export as PDF/Excel

**Report Data Structure**:
- Subject averages, grade distribution
- Top performers and struggling students
- Assignment completion rates
- Trends over time

**UI Components**:
- `src/app/reports/academic/page.tsx` - Academic reports page
- `src/components/features/reports/AcademicReportTable.tsx` - Subject × student matrix
- `src/components/features/reports/GradeDistribution.tsx` - Distribution chart
- `src/components/features/reports/PerformanceTrends.tsx` - Progress over time
- `src/components/features/reports/ClassComparison.tsx` - Compare class averages
- `src/hooks/useAcademicReports.ts` - Report hooks

**Verify**: Aggregations correct, comparisons show meaningful data.

---

### Phase 13.3: Public Statistics Page
**Goal**: Public page showing student count statistics (no login required).

**Database (Supabase Migration)**:
```sql
-- Add password protection for public stats
ALTER TABLE public.branches ADD COLUMN public_stats_password TEXT;
ALTER TABLE public.branches ADD COLUMN public_stats_enabled BOOLEAN DEFAULT FALSE;
```

**API Endpoints**:
- `GET /api/v1/public/statistics/:branchCode` - Get public statistics (no auth required)
- `POST /api/v1/public/statistics/:branchCode/verify` - Verify password for access
- `PUT /api/v1/branches/:id/public-stats` - Enable/disable and set password (Admin)

**Statistics Data**:
- Student count per class (gender-wise)
- Total students per level
- Overall branch totals
- No individual student data exposed

**UI Components**:
- `src/app/public/statistics/[branchCode]/page.tsx` - Public stats page (no layout)
- `src/components/features/public/PasswordGate.tsx` - Password entry form
- `src/components/features/public/StudentCountTable.tsx` - Class × gender matrix
- `src/components/features/public/StatisticsSummary.tsx` - Totals display
- Settings UI to enable/disable and set password

**Verify**: No login required, password protection works, no PII exposed.

---

### Phase 13.4: Role-Based Report Visibility
**Goal**: Enforce role-based access to reports.

**Database**: Uses existing role_permissions

**Backend Logic**:
- Class teacher: Only their class reports
- Subject teacher: Only their subject reports
- Academic coordinator: All academic reports for their scope
- School admin/Principal: All reports

**API Updates**:
- All report endpoints check user role and scope
- Return 403 if accessing outside scope
- Filter data to user's assigned classes/subjects

**UI Updates**:
- Hide inaccessible reports from navigation
- Show filtered views based on role
- Clear messaging when no data available for role

**Verify**: Teachers can't see other classes, coordinators see their scope only.

---

## Prompt 14: Storage & Backup Management

### Context
Branch storage quota management with usage dashboards, automatic compression, and alerts.

### Phase 14.1: Storage Dashboard
**Goal**: Visual storage usage breakdown and management.

**Database (Supabase Migration)**:
```sql
-- Track storage by category
CREATE TABLE public.storage_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- 'images', 'pdfs', 'library', 'attachments', 'other'
  bytes_used BIGINT NOT NULL DEFAULT 0,
  file_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(branch_id, category)
);

CREATE INDEX idx_storage_usage_branch ON public.storage_usage(branch_id);

ALTER TABLE public.storage_usage ENABLE ROW LEVEL SECURITY;
```

**API Endpoints**:
- `GET /api/v1/storage` - Get storage usage for current branch
- `GET /api/v1/storage/breakdown` - Detailed breakdown by category
- `GET /api/v1/storage/files` - List largest files
- `DELETE /api/v1/storage/files/:id` - Delete file (admin only)
- `GET /api/v1/storage/alerts` - Get storage alerts

**UI Components**:
- `src/app/admin/storage/page.tsx` - Storage management dashboard
- `src/components/features/storage/StorageOverview.tsx` - Pie chart of usage
- `src/components/features/storage/CategoryBreakdown.tsx` - Table by category
- `src/components/features/storage/LargestFiles.tsx` - Top files by size
- `src/components/features/storage/StorageAlerts.tsx` - Warning/critical alerts
- `src/hooks/useStorage.ts` - Storage hooks

**Verify**: Usage accurately tracked, breakdown shows correct categories.

---

### Phase 14.2: Automatic Compression & Optimization
**Goal**: Automatic image compression and optimization on upload.

**Database**: No changes

**Backend Logic**:
- Intercept all image uploads
- Compress to max 1920px width, 85% quality
- Generate thumbnails for library items
- Log original vs compressed size
- Update storage usage after compression

**API Updates**:
- All file upload endpoints apply compression
- Return compression stats in response
- Option to skip compression for originals (admin override)

**UI Components**:
- `src/components/common/ImageUploader.tsx` - Upload with compression preview
- `src/components/features/storage/CompressionStats.tsx` - Show savings

**Verify**: Images compressed automatically, original quality preserved when needed.

---

### Phase 14.3: Storage Alerts & Quota Enforcement
**Goal**: Automatic alerts at thresholds and hard limit enforcement.

**Database (Supabase Migration)**:
```sql
CREATE TABLE public.storage_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('warning', 'critical', 'exceeded')),
  percentage_used INT NOT NULL,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_storage_alerts_branch ON public.storage_alerts(branch_id, acknowledged);

ALTER TABLE public.storage_alerts ENABLE ROW LEVEL SECURITY;
```

**API Endpoints**:
- `GET /api/v1/storage/alerts` - Get active alerts
- `PUT /api/v1/storage/alerts/:id/acknowledge` - Acknowledge alert
- Internal: Create alert at 80% (warning), 95% (critical), 100% (exceeded)

**Backend Logic**:
- Check storage after every upload
- Create alert notifications for admins
- Block uploads when quota exceeded
- Send email alerts (if configured)

**UI Components**:
- `src/components/layout/StorageWarningBanner.tsx` - Global warning banner
- `src/components/features/storage/AlertHistory.tsx` - Alert history list
- `src/components/features/storage/QuotaUpgradeModal.tsx` - Request more storage

**Verify**: Alerts trigger at thresholds, uploads blocked at 100%.

---

## Prompt 15: Offline Features (PWA)

### Context
Progressive Web App with offline data caching, queued uploads, and automatic sync.

### Phase 15.1: PWA Setup & Service Worker
**Goal**: Configure PWA with service worker for offline capability.

**Database**: No changes (client-side only)

**Frontend Setup**:
- Configure Next.js PWA plugin
- Create service worker for caching
- Add manifest.json with app metadata
- Enable install prompt

**Files to Create/Modify**:
- `frontend/next.config.js` - Add PWA configuration
- `frontend/public/manifest.json` - PWA manifest
- `frontend/public/sw.js` - Service worker (auto-generated)
- `frontend/src/components/common/InstallPrompt.tsx` - Install button

**Caching Strategy**:
- Cache static assets (JS, CSS, images)
- Cache API responses for offline reading
- Network-first for dynamic data
- Cache-first for static resources

**Verify**: App installable, works offline with cached data.

---

### Phase 15.2: Offline Data Sync
**Goal**: Queue uploads when offline, sync when online.

**Database**: No changes (uses IndexedDB client-side)

**Frontend Implementation**:
- IndexedDB for offline storage
- Queue manager for pending uploads
- Sync manager for reconnection
- Conflict resolution strategy

**Files to Create**:
- `frontend/src/lib/offline/db.ts` - IndexedDB wrapper
- `frontend/src/lib/offline/queue.ts` - Upload queue manager
- `frontend/src/lib/offline/sync.ts` - Sync manager
- `frontend/src/hooks/useOfflineSync.ts` - Sync status hook

**UI Components**:
- `src/components/common/OfflineIndicator.tsx` - Shows offline status
- `src/components/common/SyncStatus.tsx` - Shows pending sync count
- `src/components/common/SyncProgressModal.tsx` - Sync progress on reconnect

**Verify**: Can create data offline, syncs when online, no data loss.

---

### Phase 15.3: Offline Documents
**Goal**: Download and access documents offline.

**Database**: No changes (client-side storage)

**Frontend Implementation**:
- Download reports/documents for offline access
- Store in IndexedDB with metadata
- Access through in-app "Offline Documents" section
- Automatic cleanup of old documents

**UI Components**:
- `src/app/offline-documents/page.tsx` - Offline documents list
- `src/components/features/offline/DownloadButton.tsx` - Save for offline
- `src/components/features/offline/OfflineDocumentCard.tsx` - Document card
- `src/components/features/offline/StorageManager.tsx` - Manage offline storage

**Verify**: Can download documents, access offline, storage managed.

---

## Prompt 16: Arabic Localization & RTL Support

### Context
Bilingual support (English + Arabic) with RTL interface. Uses **hybrid approach**:
- **UI strings** (buttons, labels, errors): JSON files via next-intl
- **Standard lists** (subjects, assessment types): JSONB columns with tabbed input
- **Free text** (notes, remarks): NOT translated (user's choice of language)

**Key Decisions**:
- Library: next-intl (NOT react-i18next or i18next)
- Routing: Cookie-based (NO URL prefixes like `/en` or `/ar`)
- UI Translations: Stored in `messages/en/*.json` and `messages/ar/*.json`
- Data Translations: JSONB columns on specific tables only
- User Preference: Stored in cookie + localStorage + `profiles.preferred_locale`

**Reference**: Read `@sms-i18n-implementation-guide.md` for full architecture details.

---

### Phase 16.1: next-intl Foundation & UI Translation
**Goal**: Set up next-intl with cookie-based locale detection and translate all UI strings.

**Prerequisites**:
- Read `@sms-i18n-implementation-guide.md` sections 1.1-1.10
- Understand: NO URL-based routing, NO [locale] folder

**Install**:
```bash
cd frontend
npm install next-intl
```

**File Structure to Create**:
```
frontend/
├── messages/
│   ├── en/
│   │   ├── common.json          # Buttons, status, errors
│   │   ├── auth.json            # Login, register
│   │   ├── students.json        # Student pages
│   │   ├── attendance.json      # Attendance pages
│   │   ├── leaves.json          # Leave requests
│   │   ├── staff.json           # Staff pages
│   │   ├── grades.json          # Grades pages
│   │   ├── settings.json        # Settings
│   │   └── notifications.json   # Notifications
│   └── ar/
│       └── (same structure)     # Arabic translations
├── src/
│   ├── i18n/
│   │   ├── request.ts           # Server-side config
│   │   └── routing.ts           # Cookie-based routing config
│   └── middleware.ts            # Locale detection middleware
```

**Implementation Steps**:

1. **Create routing config** (`src/i18n/routing.ts`):
```typescript
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'ar'],
  defaultLocale: 'ar',  // Iraqi schools default
  localePrefix: 'never', // CRITICAL: No URL prefix
});
```

2. **Create request config** (`src/i18n/request.ts`):
```typescript
import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  const locale = cookies().get('NEXT_LOCALE')?.value ?? 'ar';
  return {
    locale,
    messages: (await import(`../../messages/${locale}/common.json`)).default,
  };
});
```

3. **Create middleware** (`src/middleware.ts`):
```typescript
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware({
  ...routing,
  localeDetection: true,
});

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
```

4. **Update root layout** (`app/layout.tsx`):
```typescript
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { DirectionProvider } from '@mantine/core';
import { cookies } from 'next/headers';

export default async function RootLayout({ children }) {
  const locale = cookies().get('NEXT_LOCALE')?.value ?? 'ar';
  const messages = await getMessages();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <DirectionProvider initialDirection={dir}>
            <MantineProvider>
              {children}
            </MantineProvider>
          </DirectionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

5. **Create initial JSON files**:
   - Start with `messages/en/common.json` with all common UI strings
   - Get Arabic translation from ChatGPT/Claude
   - Save as `messages/ar/common.json`
   - Repeat for each namespace (auth, students, etc.)

6. **Update components to use translations**:
```typescript
// Server Component
import { useTranslations } from 'next-intl';

export default function StudentsPage() {
  const t = useTranslations('students');
  const common = useTranslations('common');
  
  return (
    <div>
      <h1>{t('pageTitle')}</h1>
      <Button>{common('save')}</Button>
    </div>
  );
}

// Client Component
'use client';
import { useTranslations } from 'next-intl';

export function StudentForm() {
  const t = useTranslations('students');
  return <TextInput label={t('nameLabel')} />;
}
```

**Verify**:
- Can see UI in both languages
- Switching language works
- RTL layout works for Arabic
- No URL prefixes (same `/students` URL for both languages)

---

### Phase 16.2: Language Switcher & User Preference
**Goal**: Language switcher that persists preference in cookie + localStorage + database.

**Database (Supabase Migration)**:
```sql
ALTER TABLE public.profiles 
ADD COLUMN preferred_locale VARCHAR(2) DEFAULT 'ar' 
CHECK (preferred_locale IN ('en', 'ar'));

CREATE INDEX idx_profiles_preferred_locale ON public.profiles(preferred_locale);
```

**Backend API**:
Update `auth.service.ts` to include `preferred_locale` in user response:
```typescript
async getCurrentUser(userId: string) {
  const profile = await this.supabase
    .from('profiles')
    .select('*, preferred_locale')
    .eq('id', userId)
    .single();

  return {
    ...profile,
    preferredLocale: profile.preferred_locale ?? 'ar',
  };
}
```

Add endpoint in `users.controller.ts`:
```typescript
@Patch('me/preferences')
async updatePreferences(
  @UserId() userId: string,
  @Body() dto: { preferred_locale?: string },
) {
  await this.supabase
    .from('profiles')
    .update({ preferred_locale: dto.preferred_locale })
    .eq('id', userId);
  return { success: true };
}
```

**Frontend Components**:

1. **Create LanguageSwitcher** (`src/components/LanguageSwitcher.tsx`):
```typescript
'use client';
import { useRouter } from 'next/navigation';
import { Select } from '@mantine/core';

export function LanguageSwitcher() {
  const router = useRouter();
  const currentLocale = document.documentElement.lang;

  const handleChange = async (locale: string | null) => {
    if (!locale) return;

    // 1. Set cookie
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000`;
    
    // 2. Set localStorage
    localStorage.setItem('locale', locale);
    
    // 3. Update database
    await fetch('/api/v1/users/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferred_locale: locale }),
    });

    // 4. Refresh to apply
    router.refresh();
  };

  return (
    <Select
      value={currentLocale}
      onChange={handleChange}
      data={[
        { value: 'en', label: 'English' },
        { value: 'ar', label: 'العربية' },
      ]}
    />
  );
}
```

2. **Add to Header**:
Add `<LanguageSwitcher />` to your header component.

3. **Sync on Login**:
Update login page to sync locale from user profile:
```typescript
const handleLogin = async (credentials) => {
  const response = await api.post('/auth/login', credentials);
  const { user } = response.data;

  const locale = user.preferredLocale ?? 'ar';
  document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000`;
  localStorage.setItem('locale', locale);

  router.push('/dashboard');
  router.refresh();
};
```

**Verify**:
- Switching language updates cookie, localStorage, and database
- Preference persists across sessions
- On login, user's saved preference is applied

---

### Phase 16.3: Database Translation for Standard Lists
**Goal**: Add JSONB translation columns for subjects, assessment types, event types.

**Database (Supabase Migration)**:
```sql
-- Add translation columns to entities with standard/fixed lists

ALTER TABLE subjects 
ADD COLUMN name_translations JSONB DEFAULT '{}';

ALTER TABLE assessment_types 
ADD COLUMN name_translations JSONB DEFAULT '{}';

ALTER TABLE event_types 
ADD COLUMN name_translations JSONB DEFAULT '{}',
ADD COLUMN description_translations JSONB DEFAULT '{}';

-- Optional: Branches if names should be translated
ALTER TABLE branches 
ADD COLUMN name_translations JSONB DEFAULT '{}';

-- Migrate existing data
UPDATE subjects 
SET name_translations = jsonb_build_object('en', name, 'ar', name)
WHERE name_translations = '{}';

UPDATE assessment_types 
SET name_translations = jsonb_build_object('en', name, 'ar', name)
WHERE name_translations = '{}';

UPDATE event_types 
SET name_translations = jsonb_build_object('en', name, 'ar', name)
WHERE name_translations = '{}';
```

**Backend DTOs**:
Update create/update DTOs to accept translations:
```typescript
// subjects/dto/create-subject.dto.ts
export class CreateSubjectDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsObject()
  name_translations?: {
    en?: string;
    ar?: string;
  };
}
```

**Backend Services**:
Update services to resolve translations based on language parameter:
```typescript
// subjects.service.ts
async list(branchId: string, language: string = 'ar') {
  const { data: subjects } = await this.supabase
    .from('subjects')
    .select('*')
    .eq('branch_id', branchId);

  return subjects.map(subject => ({
    ...subject,
    name: subject.name_translations?.[language] 
      ?? subject.name_translations?.en 
      ?? subject.name,
  }));
}
```

**Backend Controllers**:
Accept language query parameter:
```typescript
@Get()
async list(
  @Query('language') language: string = 'ar',
  @BranchId() branchId: string,
) {
  return this.subjectsService.list(branchId, language);
}
```

**Verify**:
- Backend can save translations in JSONB
- Backend returns translated names based on language parameter

---

### Phase 16.4: Tabbed Translation Input UI
**Goal**: Reusable component for entering translations in multiple languages.

**Reference**: Read `@sms-i18n-implementation-guide.md` section "Tabbed Translation UI" and see the React artifact demo.

**Create Reusable Component** (`src/components/TranslatableInput.tsx`):
```typescript
'use client';
import { useState } from 'react';
import { TextInput, Tabs, Badge } from '@mantine/core';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';

interface Translations {
  en: string;
  ar: string;
}

interface TranslatableInputProps {
  label: string;
  value: Translations;
  onChange: (value: Translations) => void;
  required?: boolean;
  placeholder?: string;
}

export function TranslatableInput({
  label,
  value,
  onChange,
  required,
  placeholder,
}: TranslatableInputProps) {
  const [activeTab, setActiveTab] = useState<string>('en');

  const languages = {
    en: { label: 'English', flag: '🇬🇧', dir: 'ltr' },
    ar: { label: 'العربية', flag: '🇸🇦', dir: 'rtl' },
  };

  const isComplete = (lang: string) => {
    return value[lang as keyof Translations]?.trim().length > 0;
  };

  return (
    <div>
      <Tabs value={activeTab} onChange={(val) => setActiveTab(val || 'en')}>
        <Tabs.List>
          {Object.entries(languages).map(([code, lang]) => (
            <Tabs.Tab
              key={code}
              value={code}
              rightSection={
                isComplete(code) ? (
                  <IconCheck size={14} color="green" />
                ) : required ? (
                  <IconAlertCircle size={14} color="orange" />
                ) : null
              }
            >
              {lang.flag} {lang.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        {Object.entries(languages).map(([code, lang]) => (
          <Tabs.Panel key={code} value={code} pt="md">
            <TextInput
              label={label}
              value={value[code as keyof Translations] || ''}
              onChange={(e) =>
                onChange({ ...value, [code]: e.target.value })
              }
              dir={lang.dir}
              placeholder={placeholder}
              required={required && code === 'en'}
            />
          </Tabs.Panel>
        ))}
      </Tabs>
    </div>
  );
}
```

**Update Forms to Use Tabbed Input**:

Example: Create Subject Form
```typescript
export function CreateSubjectForm() {
  const [translations, setTranslations] = useState({ en: '', ar: '' });
  
  const mutation = useMutation({
    mutationFn: (data) =>
      apiClient.post('/subjects', {
        name: translations.en,
        name_translations: translations,
      }),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
      <TranslatableInput
        label="Subject Name"
        value={translations}
        onChange={setTranslations}
        required
      />
      <Button type="submit">Save</Button>
    </form>
  );
}
```

Apply same pattern to:
- Assessment type forms
- Event type forms
- Any entity with standard/fixed lists

**Frontend Hooks**:
Update hooks to pass locale from next-intl:
```typescript
import { useLocale } from 'next-intl';

export function useSubjects() {
  const locale = useLocale(); // 'en' or 'ar'
  
  return useQuery({
    queryKey: ['subjects', locale],
    queryFn: () => api.get('/subjects', { params: { language: locale } }),
  });
}
```

**Verify**:
- Can create subjects with English and Arabic names
- Tabbed UI shows checkmarks when translations are complete
- List pages show correct language based on user's locale
- Switching language updates all translated content

---

### Phase 16.5: RTL CSS & Polish
**Goal**: Fix any RTL layout issues and ensure professional RTL experience.

**Tasks**:

1. **Update Custom CSS to Use Logical Properties**:
Replace all custom CSS files to use logical properties:
```css
/* Before (breaks in RTL) */
.sidebar { margin-left: 16px; }

/* After (works in both) */
.sidebar { margin-inline-start: 16px; }
```

Common replacements:
- `margin-left` → `margin-inline-start`
- `margin-right` → `margin-inline-end`
- `padding-left` → `padding-inline-start`
- `padding-right` → `padding-inline-end`
- `left: 0` → `inset-inline-start: 0`
- `right: 0` → `inset-inline-end: 0`
- `text-align: left` → `text-align: start`

2. **Test All Pages in Arabic**:
- Verify no text overflow
- Verify buttons/icons are in correct positions
- Verify forms align correctly (labels on right)
- Verify tables read right-to-left
- Verify navigation sidebar is on right side

3. **Handle Pluralization**:
For strings with counts, use ICU message format:
```json
// messages/en/students.json
{
  "studentCount": "{count, plural, =0 {No students} one {1 student} other {# students}}"
}

// messages/ar/students.json
{
  "studentCount": "{count, plural, =0 {لا يوجد طلاب} one {طالب واحد} two {طالبان} few {# طلاب} many {# طالبًا} other {# طالب}}"
}
```

**Verify**:
- All pages look professional in Arabic RTL
- No layout breaks
- Pluralization works correctly in both languages

---

### Testing Checklist

After completing all phases:

**UI Translation**:
- [ ] All buttons/labels in both languages
- [ ] Error messages translated
- [ ] Success notifications translated
- [ ] Form labels translated
- [ ] Page titles translated

**Data Translation**:
- [ ] Can create subject with EN + AR names
- [ ] Can create assessment type with EN + AR names
- [ ] Subjects list shows correct language
- [ ] Assessment types show correct language

**RTL**:
- [ ] Arabic UI is fully RTL
- [ ] Sidebar on right side in Arabic
- [ ] Forms align right in Arabic
- [ ] Tables read right-to-left in Arabic
- [ ] No text overflow

**User Preference**:
- [ ] Language switcher works
- [ ] Preference saves to database
- [ ] Preference persists across sessions
- [ ] On login, user's preference is applied

**Edge Cases**:
- [ ] Pluralization works (0, 1, 2, 3-10, 100+)
- [ ] Long Arabic text doesn't break layout
- [ ] Mixed English/Arabic text in same field (user notes) displays correctly
- [ ] PDF exports respect RTL (if applicable)

---

### What NOT to Do

❌ **Don't create `/en/` or `/ar/` URL routes** - Use cookie-based routing only
❌ **Don't translate free-text fields** (user notes, remarks, comments) - User's choice
❌ **Don't use `react-i18next` or `i18next`** - Use next-intl only
❌ **Don't create separate `translations` database table** - Use JSONB columns
❌ **Don't use multiple input fields side-by-side** - Use tabbed UI
❌ **Don't use physical CSS properties** (`left`, `right`) - Use logical (`inline-start`, `inline-end`)

---

### Reference Documents

Before implementing, read:
- `@sms-i18n-implementation-guide.md` - Full architecture and examples
- `@frontend.md` - Styling patterns
- `@nestjs-patterns` - Backend patterns

---

## Prompt 17: Role-Based Dashboards

### Context
Customised dashboards for each role showing relevant data, pending tasks, and quick actions.

### Phase 17.1: Dashboard Framework
**Goal**: Create role-aware dashboard framework with widget system.

**Database**: No changes (aggregates existing data)

**API Endpoints**:
- `GET /api/v1/dashboard` - Get dashboard data for current user/role
- `GET /api/v1/dashboard/widgets` - Get available widgets for role
- `PUT /api/v1/dashboard/preferences` - Save widget preferences

**Dashboard Data Structure**:
- Widgets: Attendance, assessments, events, notifications, etc.
- Pending tasks: Items requiring action
- Quick stats: Key metrics for the role
- Recent activity: Latest updates

**UI Components**:
- `src/app/dashboard/page.tsx` - Unified dashboard (role-aware)
- `src/components/features/dashboard/DashboardGrid.tsx` - Widget grid layout
- `src/components/features/dashboard/WidgetContainer.tsx` - Widget wrapper
- `src/hooks/useDashboard.ts` - Dashboard data hook

**Verify**: Dashboard loads role-appropriate content.

---

### Phase 17.2: Role-Specific Widgets
**Goal**: Implement widgets for each role's needs.

**Parent Widgets**:
- `ChildTodayWidget.tsx` - Today's attendance status
- `UpcomingEventsWidget.tsx` - Events requiring consent
- `PendingTasksWidget.tsx` - Leaves, early departures pending

**Teacher Widgets**:
- `ClassAttendanceWidget.tsx` - Today's class attendance
- `PendingGradingWidget.tsx` - Assessments needing grades
- `ScheduleTodayWidget.tsx` - Today's timetable

**Admin Widgets**:
- `BranchOverviewWidget.tsx` - Key statistics
- `PendingApprovalsWidget.tsx` - Leaves, requests needing approval
- `LowStockWidget.tsx` - Inventory alerts
- `StorageWidget.tsx` - Storage usage

**Student Widgets**:
- `TodayScheduleWidget.tsx` - Today's classes
- `UpcomingAssessmentsWidget.tsx` - Due dates
- `GradesOverviewWidget.tsx` - Recent grades

**Verify**: Each role sees appropriate widgets.

---

### Phase 17.3: Multi-Role Dashboard Switching
**Goal**: Users with multiple roles can switch dashboard views.

**Database**: Uses existing user_roles

**UI Components**:
- `src/components/features/dashboard/RoleSwitcher.tsx` - Role dropdown
- Update dashboard to filter by selected role
- Persist selected role in session

**Logic**:
- Detect user's roles
- Default to primary role
- Allow switching to secondary roles
- Filter widgets by selected role

**Verify**: Multi-role users can switch views, data filters correctly.

---

## Final Dependency Chain

```
Prompt 0 (Setup) 
    ↓
Prompt 1 (Settings) → Required by all features
    ↓
Prompt 2 (Branches) → Required for data isolation
    ↓
Prompt 3 (Users) → Required for roles, students, staff
    ↓
Prompt 4 (Academic) → Required for teacher mapping
    ↓
Prompt 5 (Attendance) → Uses all above
    ↓
Prompt 6 (Leaves/Early Departure) → Uses attendance, students, notifications
    ↓
Prompt 7 (Timetable) → Uses academic structure, teacher mapping
    ↓
Prompt 8 (Assessments) → Uses academic structure, grade templates
    ↓
Prompt 9 (Events/Communication) → Uses users, notifications
    ↓
Prompt 10 (Reports) → Aggregates all data for comprehensive reports
    ↓
Prompt 11 (Library) → Uses storage, subjects, classes
    ↓
Prompt 12 (Inventory) → Uses students, branches
    ↓
Prompt 13 (Admin Reports) → Uses all data sources
    ↓
Prompt 14 (Storage) → Enhances branch management
    ↓
Prompt 15 (PWA) → Client-side enhancement
    ↓
Prompt 16 (Localisation) → UI enhancement
    ↓
Prompt 17 (Dashboards) → Aggregates all features
```

---

## Implementation Complete

All features from `scope.md` are now covered:

| Scope Feature | Prompt Coverage |
|---------------|-----------------|
| Core User Management | Prompt 3 |
| Subject & Class Structure | Prompts 1, 4 |
| Assessment Management | Prompt 8 |
| Grade Configuration | Prompt 1 |
| Library & Resources | Prompt 11 |
| Teacher-Student-Parent Messaging | Prompt 9 |
| Notification Center | Prompt 5 |
| Attendance Management | Prompt 5 |
| Leave Management | Prompt 6 |
| Early Departure Requests | Prompt 6 |
| Class Timetable | Prompt 7 |
| Teacher Schedule | Prompt 7 |
| School Calendar | Prompt 1 |
| Event Management | Prompt 9 |
| Student Report | Prompt 10 |
| Academic Performance Tracking | Prompts 8, 10 |
| Behavioral Assessment System | Prompt 10 |
| Academic Year Management | Prompt 1 |
| System Settings Configuration | Prompt 1 |
| Staff Management | Prompt 3 |
| Administrative Reports | Prompt 13 |
| Uniform Management | Prompt 12 |
| Branch Management | Prompt 2 |
| Storage & Backup | Prompt 14 |
| Offline Mode (PWA) | Prompt 15 |
| Role-Based Dashboards | Prompt 17 |
| Localization & RTL Support | Prompt 16 |
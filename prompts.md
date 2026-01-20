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


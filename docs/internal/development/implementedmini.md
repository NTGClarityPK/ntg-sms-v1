# School Management System – Implementation Summary (Mini)

> **Purpose**: High-level, up-to-date snapshot of what’s implemented, without the deep-dive detail in `implemented.md`.  
> **Stack**: Next.js 14 (App Router) + Mantine v7 + React Query + NestJS + Supabase (PostgreSQL, RLS)  

---

## 1. Core Architecture

- **Frontend**
  - Next.js 14 App Router, strict TypeScript, Mantine v7 UI.
  - Supabase Auth (SSR-aware) with middleware to refresh session cookies.
  - Centralised API client (`apiClient`) to call **NestJS only** (never Supabase directly, except auth).
  - React Query as the single data-fetching/cache layer.
  - **Route groups**:
    - `(auth)` – login, reset password, select child.
    - `(portal)` – all authenticated pages share one `AppShell` / `AuthGuard` layout.

- **Backend**
  - NestJS with global `ConfigModule`, `SupabaseConfig` service (single Supabase client).
  - Global HTTP exception filter and response interceptor enforcing `{ data, meta, error }` format.
  - JWT guard validating Supabase tokens, `@CurrentUser` and `@CurrentBranch` decorators.

---

## 2. Authentication & Layout

- **Auth**
  - Supabase-based email/password login, logout, and session retrieval.
  - `AuthGuard` (frontend) uses Supabase session only to avoid redirect loops.
  - `GET /api/v1/auth/me` and `POST /api/v1/auth/validate` return user context (including branches).

- **App Shell**
  - Mantine `AppShell` + custom `Header`, `Sidebar`, `UserMenu`, notification bell, branch-aware behaviour.
  - All authenticated routes live under `app/(portal)/...`, so header/sidebar **never remount** on navigation.
  - Sidebar supports collapse, role-based items (e.g. “My Schedule” for teachers), and RMS-style active-state when collapsed.
  - Header shows **school name (tenant)**, NTG logo, online/offline status, language selector, and user menu.

---

## 3. Central Theme System & UI Consistency

- **Theme System**
  - Single `ThemeConfig` source of truth (copied from RMS) with colour tokens, typography, component styling.
  - `DynamicThemeProvider`:
    - Injects CSS variables + high-priority CSS overrides for Mantine components.
    - Controls AppShell, buttons, inputs, tables, tabs, titles, page headers, and the header/sidebar junction rounding.
  - Fonts via `next/font`:
    - Primary: **Saira**, Headings: **Rajdhani**, Mono: **JetBrains Mono**.

- **Global UX Rules (mirroring RMS)**
  - **Loading**: Prefer Skeleton placeholders for pages/sections, avoid full-page spinners (only small inline loaders allowed).
  - **Layout**: One shared `(portal)` layout for all authenticated routes; no per-page AppShell layouts.
  - Enforced via `.cursor/rules/frontend.mdc` and `.cursor/rules/global-rules.mdc`.

---

## 4. Configuration & Settings (Prompt 1)

- **Academic Years**
  - Table with `is_active`/`is_locked`, single active year constraint.
  - CRUD API + frontend page with cards, modal form, and active/locked states.

- **Core Lookups**
  - Subjects, classes, sections, levels, level↔class mapping.
  - Tabbed settings page for managing all lookups with sorted lists and chips for level/class relations.

- **Schedule & Holidays**
  - School days, timing templates, class-timing assignments, public holidays.
  - Settings page with:
    - Days-of-week selector.
    - Timing templates per level.
    - Holiday calendar (date-based CRUD).

- **Assessment & Grading**
  - Assessment types, grade templates + ranges, class↔template assignments, leave quota.
  - Tabbed UI to manage types, templates, assignments, and leave settings with validation.

- **System Settings**
  - Generic `system_settings` table + module for JSON-based config:
    - Communication directions (teacher↔student/parent).
    - Behavioural assessment features and attributes.

---

## 5. Multi-Branch & Tenant Support (Prompt 2 – Backend)

- **Tenant & Branch Schema**
  - `tenants`, `branches`, `user_branches`, `profiles.current_branch_id`.
  - Prompt 1 tables extended with `tenant_id` and `branch_id` where appropriate.

- **Branch & Auth Context**
  - Branches module with CRUD and storage stats.
  - Auth returns:
    - `branches[]` and `currentBranch`.
    - Endpoints to list branches, select current branch, and read current branch context.

- **BranchGuard**
  - Reads `X-Branch-Id` or `profiles.current_branch_id`, validates membership, injects `{ branchId, tenantId }` into request.
  - Applied to all configuration-like controllers (lookups, schedule, assessment, system settings).

---

## 6. Academic Structure & Teacher Mapping (Prompt 4)

- **Class Sections**
  - `class_sections` per class/section/branch/academic year with capacity and class teacher.
  - Grid UI by class/section, modal for single/bulk creation, student list modal, class teacher assignment.

- **Teacher Assignments**
  - `teacher_assignments` table with co-teaching (multiple staff per subject/class-section/year).
  - List + matrix views for subject/teacher mapping:
    - Matrix cells show multiple teachers, support add/unassign, and filter to teacher roles only.

- **Teacher Schedules**
  - Backend endpoints for `GET /staff/:id/schedule` and `GET /staff/me`.
  - Frontend:
    - Staff schedule page.
    - “My Schedule” page for the logged-in teacher.
    - “My Schedule” sidebar link (teacher-only), “View Schedule” button per staff row.

---

## 7. Parent Associations & Notifications

- **Parent–Student Associations**
  - `parent_students` table + admin screen `/parent-associations`.
  - Table + modal to link/unlink children to parents; guarded by branch context.

- **Notifications (Prompt 5.4 polishing)**
  - Robust `isRead` filtering (DTO transform handles booleans + strings).
  - `/notifications` page with tabs: All, Unread, Read, Attendance.
  - Notification bell:
    - Uses dedicated unread-count endpoint and meta totals.
    - Dropdown with scrollable list, “Mark all read”, and “View all notifications”.

---

## 8. Performance & Data Fetching Improvements

- **Attendance**
  - Heavy hydration refactored to batched Supabase queries and `Map`-based joins.
  - Summaries (per student/class) use SQL `count` aggregation instead of loading all rows.

- **Notifications**
  - New `GET /notifications/unread-count` endpoint for cheap unread counts.
  - React Query hooks use `staleTime` to reduce refetching; tabs reuse base data.

- **Lookups & Settings**
  - Semi-static data (`useAcademicYears`, `useCoreLookups`, `useScheduleSettings`, `useSystemSettings`) use `staleTime: Infinity`.

- **Students & Staff**
  - Debounced search for tables, clearer `{ data, meta }` handling.
  - React Query options updated for v5 (no `keepPreviousData`).

- **Supabase Indexing & RLS**
  - Targeted indexes on `attendance` and optimised RLS policy for `notifications`.

---

## 9. Recent UI/UX Enhancements (RMS Alignment)

- **Skeleton-First Loading**
  - All major pages and feature components show section-shaped Skeletons during loading.

- **Portal Layout & Junction**
  - `(portal)` layout ensures a single AppShell for all authenticated pages.
  - Header/sidebar junction uses outer rounded corner similar to RMS, applied globally.

- **Tenant Business Information**
  - `TenantsModule` + `/api/v1/tenants/me` (GET/PATCH).
  - Header shows **tenant name** instead of a static app name.
  - Settings includes a **Business Information** tab to edit school name with validation and notifications.

---

## 10. Leave & Early Departure Management (Prompt 6)

**Tag: prompt 6 changes**

- **Database Schema**
  - `leave_requests` table: `id`, `student_id`, `requested_by`, `start_date`, `end_date`, `reason`, `attachment_url`, `status` (pending/approved/rejected/cancelled), `reviewed_by`, `reviewed_at`, `review_notes`, `branch_id`, `academic_year_id`, timestamps. RLS policies for branch isolation and parent/staff access.
  - `early_departure_requests` table: `id`, `student_id`, `requested_by`, `date`, `departure_time`, `reason`, `attachment_url`, `status` (pending/approved/rejected), `reviewed_by`, `reviewed_at`, `review_notes`, `branch_id`, `academic_year_id`, timestamps. RLS policies for branch isolation.
  - Migration: `prompt_6_leave_and_early_departure_tables` (version: 20260129074744)

- **Backend API**
  - Leave Requests: `GET /api/v1/leave-requests` (list with filters), `POST /api/v1/leave-requests` (create), `GET /api/v1/leave-requests/:id`, `PUT /api/v1/leave-requests/:id/approve`, `PUT /api/v1/leave-requests/:id/reject`, `PUT /api/v1/leave-requests/:id/cancel`, `GET /api/v1/leave-requests/quota/:studentId`.
  - Early Departure: `GET /api/v1/early-departure` (list), `POST /api/v1/early-departure` (create), `PUT /api/v1/early-departure/:id/approve`, `PUT /api/v1/early-departure/:id/reject`.
  - Parent filtering: Parents only see their own requests (`requested_by = userId`). Staff see all requests in their branch.
  - Review workflow: Staff can approve/reject with optional `reviewNotes`. Backend fetches reviewer's `display_name` from `roles` table (not `name`) for proper display text.
  - Notifications: Auto-sent to parents when leave/early departure is approved/rejected. Notification body includes formatted dates and status.

- **Frontend UI**
  - `/leaves` page: Tabbed interface with "Raise a request" (parents) and "All requests" tabs. Student selection dropdown for parents with multiple children. Student statistics badges (Pending/Approved/Rejected counts) shown under dropdown. Table view for all requests with columns: Date Requested, Leave Period, Student, Reason, Status, Review Notes, Reviewed By (with role display name), Date Reviewed, Actions. Skeleton loading states.
  - `/early-departure` page: Similar structure for early departure requests.
  - Leave quota indicator: Shows used/remaining days based on approved leave requests.
  - Form validation: Date range validation, reason required, attachment upload placeholder.

- **Key Features**
  - Branch isolation: All requests filtered by `branch_id` from `BranchGuard`.
  - Role-based access: Parents create/view own requests. Staff can review all requests.
  - Review notes: Optional text field for staff when approving/rejecting.
  - Status workflow: pending → approved/rejected/cancelled (leave only). Cancellation only allowed for pending, unreviewed requests.
  - Integration: Notifications sent via `NotificationsService.createLeaveRequestNotification()` with formatted messages.

---

> For full historical detail, per-endpoint SQL, DTO shapes, and per-component notes, see `implemented.md`.  



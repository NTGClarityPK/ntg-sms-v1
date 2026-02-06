# School Management System – Demo Walkthrough
## Implementation Status (Up to Prompt 7)

> **Purpose**: Quick reference guide for demonstrating implemented features to stakeholders.  
> **Stack**: Next.js 14 + Mantine v7 + NestJS + Supabase (PostgreSQL)

---

## 1. Authentication & Multi-Tenancy Setup

### Login Flow
1. **Login as Admin** → `/login`
   - Email/password authentication via Supabase
   - After login, redirected to branch selection if multiple branches exist
   - Select branch → redirected to dashboard

2. **Branch Context**
   - Header shows **school name (tenant)** and current branch
   - Branch switcher in header dropdown (if user has access to multiple branches)
   - All data is branch-scoped automatically

---

## 2. System Configuration (Admin Only)

### Academic Years
- **Navigate**: Settings → Academic Years
- **Show**: 
  - List of academic years with active/locked badges
  - Create new academic year (date range validation)
  - Activate year (automatically deactivates previous active year)
  - Lock year (prevents further edits)

### Core Lookups
- **Navigate**: Settings → Academic
- **Show tabs**:
  - **Subjects**: List with search, create/edit, Arabic name support
  - **Classes**: List with level associations, sort order
  - **Sections**: List with sort order
  - **Levels**: Shows levels with associated classes (chips)

### Schedule Settings
- **Navigate**: Settings → Schedule
- **Show**:
  - **School Days**: Select active days of week
  - **Timing Templates**: Create templates per level with periods and breaks
  - **Class Timing Assignments**: Assign templates to classes
  - **Public Holidays**: Calendar view, add/remove holidays per academic year

### Assessment & Grading
- **Navigate**: Settings → Assessment
- **Show tabs**:
  - **Assessment Types**: List and create types
  - **Grade Templates**: Create templates with grade ranges (A+, A, B, etc.)
  - **Class Assignments**: Assign grade templates to classes
  - **Leave Quota**: Set annual leave quota per academic year

### System Settings
- **Navigate**: Settings → Communication / Behavior
- **Show**: JSON-based configuration for communication directions and behavioural assessment

### Business Information
- **Navigate**: Settings → Business Information
- **Show**: Edit school name (tenant name) - updates header globally

---

## 3. User Management (Admin Only)

### Roles & Permissions
- **Navigate**: Settings → Permissions
- **Show**:
  - Permission matrix (Roles × Features)
  - Edit permissions: None / View / Edit per role
  - Roles: `school_admin`, `principal`, `class_teacher`, `subject_teacher`, `parent`, `student`, etc.

### Users
- **Navigate**: Users
- **Show**:
  - User list with filters (role, status, branch)
  - Create user (email, name, phone, etc.)
  - Assign roles per branch
  - Soft delete (deactivate) users

### Students
- **Navigate**: Students
- **Show**:
  - Student list with filters (class, section, status)
  - Create student (auto-generates student ID based on class/section/year)
  - Student detail view
  - Bulk import (Excel) - placeholder for future

### Staff
- **Navigate**: Staff
- **Show**:
  - Staff list with role badges
  - Create staff member
  - View staff schedule (shows class teacher assignments and subject assignments)
  - Deactivate staff (with replacement validation)

### Parent-Student Associations
- **Navigate**: Parent Associations
- **Show**:
  - Table of parent-student links
  - Link child to parent (search students)
  - Unlink associations

---

## 4. Academic Structure (Admin/Coordinator)

### Class Sections
- **Navigate**: Academic → Class Sections
- **Show**:
  - Grid view (Classes × Sections)
  - Create single or bulk class-sections
  - Each card shows: Class-Section name, Student count/Capacity, Class teacher (if assigned)
  - Actions: Edit capacity, Assign class teacher, View students, Delete

### Teacher Mapping
- **Navigate**: Academic → Teacher Mapping
- **Show two views**:
  - **List View**: Table with Class-Section, Subject, Teacher columns
  - **Matrix View**: Grid (Class-Sections × Subjects) with teacher names in cells
  - Create assignment: Select class-section, subject, teacher
  - Multiple teachers per subject (co-teaching support)
  - Filter by class, section, subject, teacher

---

## 5. Attendance Management

### Mark Attendance (Class Teacher)
- **Navigate**: Attendance → Mark Attendance
- **Show**:
  - Date picker (defaults to today)
  - Class-section selector (shows only teacher's assigned classes)
  - Student list with status buttons: Present, Absent, Late, Excused
  - Entry/exit time inputs, notes field
  - Real-time statistics (Present/Absent/Late/Excused counts)
  - Bulk save button
  - **Note**: After saving, parents receive notifications automatically

### Attendance History (Teachers/Admins)
- **Navigate**: Attendance → History
- **Show**:
  - Date range picker
  - Filters: Class-section, Student, Status (multi-select)
  - Table view: Date, Student, Status, Entry Time, Exit Time, Notes
  - Calendar view: Color-coded days (green=all present, yellow=some absent, red=many absent)
  - Export placeholder

### Attendance Reports
- **Navigate**: Attendance → History (with filters)
- **Show**:
  - Summary statistics (total days, present/absent/late/excused counts, percentage)
  - Detailed records table
  - Per-student summary
  - Per-class summary

### Parent View (Child Attendance)
- **Login as Parent** → Select child (if multiple children)
- **Navigate**: Attendance → Child View
- **Show**:
  - Child's photo, name, class-section
  - Today's status with time
  - Calendar view (color-coded by status)
  - Attendance summary (percentage, counts)
  - Recent history table

---

## 6. Leave & Early Departure Management

### Leave Requests (Parent)
- **Login as Parent**
- **Navigate**: Leaves
- **Show**:
  - Tab: "Raise a request"
    - Student selector (if multiple children)
    - Date range picker
    - Reason textarea
    - Leave quota indicator (used/remaining days)
    - Attachment placeholder
  - Tab: "All requests"
    - Table with: Date Requested, Leave Period, Student, Reason, Status, Review Notes, Reviewed By, Date Reviewed
    - Status badges: Pending, Approved, Rejected, Cancelled
    - Cancel button (only for pending requests)

### Leave Requests (Staff Review)
- **Login as Staff/Admin**
- **Navigate**: Leaves → All requests tab
- **Show**:
  - All branch requests in table
  - Approve/Reject buttons with optional review notes
  - Status workflow: pending → approved/rejected
  - **Note**: On approval, attendance is auto-marked as "excused" for those dates

### Early Departure Requests
- **Navigate**: Early Departure
- **Show**: Similar structure to leaves
  - Single date + departure time picker
  - Same approval workflow
  - **Note**: Updates attendance with exit time and excused status

---

## 7. Timetable Management (Admin/Coordinator)

### Class Timetable
- **Navigate**: Timetable
- **Show**:
  - Class-section selector dropdown
  - Weekly grid view (Days × Periods)
  - Each cell shows: Subject, Teacher, Room, Time
  - Click cell to edit/create slot
  - Empty cells show "Assign" button
  - **Actions**:
    - "Generate from Template" button (auto-creates slots from timing template)
    - Edit slot: Subject dropdown, Teacher dropdown, Room input, Time pickers
    - Delete slot

### Teacher Timetable View
- **Navigate**: Timetable → Select class-section → View teacher's schedule
- **Show**: Same grid but filtered to show only that teacher's slots

### My Schedule (Teacher)
- **Login as Teacher**
- **Navigate**: My Schedule (sidebar link - teacher-only)
- **Show**:
  - Weekly timetable grid
  - Shows all assigned subjects/class-sections with times
  - Free periods highlighted
  - Class teacher assignments shown separately

### Conflict Detection
- **Navigate**: Timetable → Create/edit slot
- **Show**:
  - Warning if teacher is double-booked (same time, different classes)
  - Validation on save (prevents invalid timings)
  - Conflict list view (future enhancement)

---

## 8. Notifications

### Notification Bell (All Users)
- **Show**: Bell icon in header with unread count badge
- **Click bell**:
  - Dropdown with recent 5-10 unread notifications
  - Each notification: Type badge, Title, Body preview, Time
  - "Mark as read" per notification
  - "Mark all as read" button
  - "View all notifications" link

### Notifications Page
- **Navigate**: Notifications (or click "View all")
- **Show tabs**:
  - All, Unread, Read, Attendance
  - List of notifications with read/unread indicators
  - Click notification → navigates to relevant page (e.g., attendance, leave request)

---

## 9. Dashboard Widgets

### Teacher Dashboard
- **Login as Class Teacher**
- **Navigate**: Dashboard
- **Show**:
  - Attendance widget: Today's attendance for teacher's class
    - Present/Absent/Late counts
    - Attendance percentage
    - "Mark Attendance" button
    - "View Details" link

### Parent Dashboard
- **Login as Parent**
- **Navigate**: Dashboard
- **Show**:
  - Child attendance widget: Today's status
    - Large status badge (Present/Absent/Late)
    - Entry time (if present)
    - "View Full History" link

---

## 10. Key Features Summary

### Multi-Tenancy & Branch Isolation
- ✅ All data scoped by tenant (school) and branch
- ✅ Branch switcher in header
- ✅ RLS policies enforce isolation at database level

### Role-Based Access Control
- ✅ Permission matrix (Roles × Features)
- ✅ UI elements hidden/shown based on permissions
- ✅ Backend guards validate access

### Performance Optimizations
- ✅ Aggregated queries for attendance summaries
- ✅ Dedicated unread-count endpoint for notifications
- ✅ Skeleton loading states (no full-page spinners)
- ✅ React Query caching with appropriate stale times

### UI/UX Consistency
- ✅ Centralized theme system (no hardcoded colors)
- ✅ Mantine v7 components throughout
- ✅ Single AppShell layout (no remounting on navigation)
- ✅ RMS-aligned design patterns

---

## Demo Flow Recommendations

### Quick Demo (15 minutes)
1. Login as Admin → Show Settings (Academic Years, Lookups, Schedule)
2. Create a class-section → Assign class teacher
3. Create teacher assignment (subject mapping)
4. Login as Teacher → Mark attendance → Show parent notification
5. Login as Parent → View child attendance, Create leave request
6. Login as Admin → Approve leave → Show attendance auto-update

### Full Demo (30 minutes)
1. Complete Quick Demo
2. Show Timetable management (create slots, generate from template)
3. Show Teacher "My Schedule" view
4. Show Leave/Early Departure approval workflow
5. Show Notifications system (bell, dropdown, full page)
6. Show Dashboard widgets for different roles

---

## Technical Highlights

- **Backend**: NestJS with TypeScript, Supabase client, JWT auth, BranchGuard
- **Frontend**: Next.js 14 App Router, React Query, Mantine v7, TypeScript strict
- **Database**: PostgreSQL (Supabase) with RLS policies, proper indexes
- **API Format**: Consistent `{ data, meta, error }` response structure
- **Error Handling**: Proper TypeScript error guards, user-friendly messages
- **Validation**: Zod (frontend), class-validator (backend)

---

*Last Updated: After Prompt 7 (Timetable Management) Implementation*





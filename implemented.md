# School Management System - Implementation Log

> **Status**: Prompt 0 (Initial Project Setup) - ✅ COMPLETED  
> **Last Updated**: Current Session  
> **Tech Stack**: Next.js 14 (App Router) + Mantine v7 + NestJS + Supabase (PostgreSQL)  
> **Structure**: `frontend/` and `backend/` directories (NOT monorepo)

---

## 📋 Table of Contents

1. [Completed Implementation](#completed-implementation)
2. [Project Structure](#project-structure)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Frontend Components](#frontend-components)
6. [Configuration & Environment](#configuration--environment)
7. [Issues Resolved](#issues-resolved)
8. [How to Run](#how-to-run)
9. [Next Steps](#next-steps)

---

## ✅ Completed Implementation

### Prompt 0: Initial Project Setup

#### Phase 0.1: Backend Scaffolding ✅

**NestJS Project Setup**
- ✅ NestJS project initialized in `backend/` with TypeScript strict mode
- ✅ Dependencies installed:
  - `@supabase/supabase-js` - Supabase client
  - `@nestjs/config` - Configuration management
  - `@nestjs/jwt` - JWT token validation
  - `class-validator`, `class-transformer` - DTO validation
  - `@nestjs/platform-express` - Express adapter

**Common Infrastructure Created**
- ✅ `backend/src/common/config/supabase.config.ts`
  - Singleton Supabase client initialization
  - Uses `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
  - Configured with `autoRefreshToken: false`, `persistSession: false` (server-side)

- ✅ `backend/src/common/filters/http-exception.filter.ts`
  - Global exception filter
  - Formats all errors to `{ error: { code, message } }` structure
  - Handles `string | string[]` message types from class-validator
  - Logs errors with context

- ✅ `backend/src/common/interceptors/response.interceptor.ts`
  - Global response interceptor
  - Wraps all responses in `{ data: T, meta?: Meta }` format
  - Ensures consistent API response structure

- ✅ `backend/src/common/decorators/current-user.decorator.ts`
  - `@CurrentUser()` decorator to extract authenticated user from request
  - Returns `{ id, email, roles?, branch_id? }`

- ✅ `backend/src/common/guards/jwt-auth.guard.ts`
  - `@UseGuards(JwtAuthGuard)` to protect routes
  - Validates Supabase JWT token from `Authorization: Bearer <token>` header
  - Extracts user info and attaches to request object
  - Uses `SUPABASE_JWT_SECRET` for verification

**Configuration**
- ✅ CORS configured for frontend origin (`http://localhost:3000`)
- ✅ Health check endpoint: `GET /health`
- ✅ `.env.example` created with required variables

**Verification**: ✅ Backend runs on port 3001, health endpoint returns 200

---

#### Phase 0.2: Frontend Scaffolding ✅

**Next.js 14 Project Setup**
- ✅ Next.js 14 initialized in `frontend/` with App Router
- ✅ TypeScript configured with strict mode
- ✅ Dependencies installed:
  - `@mantine/core`, `@mantine/hooks`, `@mantine/notifications` - UI components
  - `@mantine/form` - Form handling
  - `@tanstack/react-query` - Data fetching and caching
  - `@supabase/ssr` - Supabase SSR support
  - `axios` - HTTP client
  - `zod` - Schema validation
  - `@tabler/icons-react` - Icons

**Core Library Files Created**
- ✅ `frontend/src/lib/api-client.ts`
  - Axios instance pointing to NestJS backend (`http://localhost:3001`)
  - Request interceptor: Injects `Authorization: Bearer <token>` from Supabase session
  - Response interceptor: Handles 401 errors, redirects to login
  - Typed methods: `get<T>`, `post<T>`, `put<T>`, `patch<T>`, `delete<T>`
  - Returns `ApiResponse<T>` format

- ✅ `frontend/src/lib/supabase/client.ts`
  - Browser Supabase client using `createBrowserClient` from `@supabase/ssr`
  - Configured with cookie handling for SSR
  - Uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

- ✅ `frontend/src/lib/supabase/server.ts`
  - Server-side Supabase client (for future server components)

- ✅ `frontend/src/lib/supabase/types.ts`
  - Database type definitions (generated from Supabase)

- ✅ `frontend/src/lib/query-client.ts`
  - React Query client configuration
  - Default options: `retry: false`, `refetchOnWindowFocus: false`

- ✅ `frontend/src/lib/auth.ts`
  - `signIn(email, password)` - Supabase auth sign in
  - `signOut()` - Supabase auth sign out
  - `getSession()` - Get current Supabase session

**App Structure**
- ✅ `frontend/src/app/layout.tsx` - Root layout with MantineProvider, QueryClientProvider
- ✅ `frontend/src/app/providers.tsx` - Client-side providers wrapper
- ✅ `frontend/src/app/page.tsx` - Root page redirects to `/dashboard`

**Type Definitions**
- ✅ `frontend/src/types/api.ts` - `ApiResponse<T>` type
- ✅ `frontend/src/types/auth.ts` - `User` interface

**Configuration**
- ✅ `.env.local.example` created with required variables

**Verification**: ✅ Frontend runs on port 3000, Mantine styles applied, no console errors

---

#### Phase 0.3: Authentication Flow ✅

**Database (Supabase Migration)**
- ✅ `profiles` table created:
  ```sql
  CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```
- ✅ RLS policies enabled:
  - Users can view own profile
  - Users can update own profile

**Backend Auth Module**
- ✅ `backend/src/modules/auth/auth.module.ts` - Auth module with JWT configuration
- ✅ `backend/src/modules/auth/auth.controller.ts`:
  - `GET /api/v1/auth/me` - Returns current user with profile
  - `POST /api/v1/auth/validate` - Validates JWT, returns user context
- ✅ `backend/src/modules/auth/auth.service.ts`:
  - `getCurrentUser(userId)` - Fetches user from `auth.users` and profile from `profiles`
  - Handles missing profiles gracefully
- ✅ `backend/src/modules/auth/dto/user-response.dto.ts`:
  - `UserResponseDto` with `id`, `email`, `fullName`, `avatarUrl`, `roles`

**Frontend Auth Implementation**
- ✅ `frontend/src/app/(auth)/login/page.tsx`:
  - Login form with email/password validation (Zod schema)
  - Mantine form components
  - Error handling and notifications
  - Redirects to `/dashboard` on success
  - Uses `window.location.href` for full page reload after login

- ✅ `frontend/src/app/(auth)/layout.tsx`:
  - Centered auth layout with Container

- ✅ `frontend/src/components/common/AuthGuard.tsx`:
  - Protects routes, redirects to `/login` if not authenticated
  - Checks Supabase session directly (single source of truth)
  - Shows loading state while checking session
  - **Important**: Only checks Supabase session, NOT API call (prevents redirect loops)

- ✅ `frontend/src/hooks/useAuth.ts`:
  - React Query hook for fetching current user
  - Calls `GET /api/v1/auth/me`
  - Returns `{ user, isLoading, isAuthenticated, error, refetch }`

**Verification**: ✅ Can login, session persists on refresh, logout clears session, protected routes redirect

---

#### Phase 0.4: App Shell & Navigation ✅

**Dashboard Layout**
- ✅ `frontend/src/app/dashboard/layout.tsx`:
  - Wraps children with `AuthGuard` and `AppShell`
  - Client component (`'use client'`)

- ✅ `frontend/src/app/dashboard/page.tsx`:
  - Dashboard home page (placeholder: "Dashboard coming soon")
  - Client component

**Layout Components**
- ✅ `frontend/src/components/layout/AppShell.tsx`:
  - Mantine AppShell with responsive sidebar
  - Mobile burger menu toggle
  - Header height: 60px
  - Navbar width: 300px, collapses on mobile

- ✅ `frontend/src/components/layout/Sidebar.tsx`:
  - Navigation menu with NavLink components
  - Routes: Dashboard, Students, Attendance, Reports, Settings
  - Uses Tabler icons
  - Active route highlighting
  - Responsive (hidden on mobile, toggleable)

- ✅ `frontend/src/components/layout/Header.tsx`:
  - App title: "School Management System"
  - Notifications icon (placeholder)
  - UserMenu component

- ✅ `frontend/src/components/layout/UserMenu.tsx`:
  - Avatar with user initials
  - Dropdown menu with Profile, Settings (disabled), Logout
  - Uses `useAuth()` hook for user data
  - Logout calls `signOut()` from `@/lib/auth`

**Placeholder Pages**
- ✅ `frontend/src/app/dashboard/students/page.tsx` - "Students management coming soon"
- ✅ `frontend/src/app/dashboard/attendance/page.tsx` - "Attendance management coming soon"
- ✅ `frontend/src/app/dashboard/reports/page.tsx` - "Reports coming soon"
- ✅ `frontend/src/app/dashboard/settings/page.tsx` - "Settings coming soon"

**Verification**: ✅ Authenticated user sees sidebar, can navigate routes, responsive on mobile

---

#### Phase 0.5: Centralized Theme System & UI Consistency ✅

**Centralized Theme System (Mantine v7)**
- ✅ Added centralized theme configuration (single source of truth):
  - `frontend/src/lib/theme/themeConfig.ts` (`ThemeConfig`, `generateThemeConfig`)
  - `frontend/src/lib/utils/themeColors.ts` (`generateThemeColors`, color utilities)
  - `frontend/src/lib/utils/createDynamicTheme.ts` (`createDynamicTheme` → Mantine theme override)
- ✅ Added theme state + hooks:
  - `frontend/src/lib/store/theme-store.ts` (Zustand store for primary color + version)
  - `frontend/src/lib/hooks/use-theme.ts` (light/dark mode hook)
  - `frontend/src/lib/hooks/use-theme-color.ts` (primary color hook)
  - `frontend/src/lib/hooks/use-theme-colors.ts` (theme-derived status colors: success/error/info/warning)
  - `frontend/src/lib/utils/theme.ts` (theme helpers + `DEFAULT_THEME_COLOR`)
- ✅ Added `DynamicThemeProvider`:
  - `frontend/src/components/providers/DynamicThemeProvider.tsx`
  - Applies theme via CSS variables + CSS injection for consistent component styling (AppShell, Buttons, Inputs, Tables, Tabs, Titles)
- ✅ Integrated theme system into app providers:
  - `frontend/src/app/providers.tsx` now builds Mantine theme via `createDynamicTheme()` and wraps app with `DynamicThemeProvider`

**Fonts (Consistent with RMS reference)**
- ✅ Updated root layout to load and apply fonts via Next.js `next/font/google`:
  - Primary: Saira (`--font-primary`)
  - Heading: Rajdhani (`--font-heading`)
  - Mono: JetBrains Mono (`--font-mono`)
  - Implemented in `frontend/src/app/layout.tsx`

**Auth UI (RMS-style)**
- ✅ Updated auth layout to RMS-style split gradient layout and card container:
  - `frontend/src/app/(auth)/layout.tsx`
- ✅ Updated login page UI to RMS-style (icons, spacing, alert styling, buttons/links):
  - `frontend/src/app/(auth)/login/page.tsx`
- ✅ Added placeholder language selector for auth UI header:
  - `frontend/src/components/layout/LanguageSelector.tsx`

**Dashboard Page Consistency / Layout Adjustments**
- ✅ Fixed dashboard page title/description visibility by keeping page layout consistent with other dashboard pages:
  - `frontend/src/app/dashboard/page.tsx`
- ✅ Adjusted AppShell and main content padding alignment so content starts cleanly after sidebar:
  - `frontend/src/components/layout/AppShell.tsx`
  - `frontend/src/components/providers/DynamicThemeProvider.tsx`

**Rules / Guardrails**
- ✅ Added strict rules enforcing centralized theme usage for all future UI:
  - `.cursor/rules/frontend.mdc` (detailed UI/theming rules)
  - `.cursor/rules/global-rules.mdc` (global reminder: no hardcoded colors/fonts, no custom CSS files)

---

### Additional Fixes & Improvements

#### Next.js Middleware for Supabase SSR ✅
- ✅ `frontend/src/middleware.ts` created:
  - Handles Supabase session cookie refresh on each request
  - Uses `createServerClient` from `@supabase/ssr`
  - Properly manages cookies for SSR
  - Matches all routes except static assets

#### Route Structure Fix ✅
- ✅ **Issue**: Route group `(dashboard)/page.tsx` wasn't recognized by Next.js
- ✅ **Fix**: Moved to explicit route structure `app/dashboard/page.tsx`
- ✅ All nested routes moved to `app/dashboard/[nested]/page.tsx`
- ✅ Routes now properly recognized: `/dashboard`, `/dashboard/students`, etc.

#### Authentication Flow Fixes ✅
- ✅ **Issue**: AuthGuard checking both Supabase session AND API call caused redirect loops
- ✅ **Fix**: AuthGuard now only checks Supabase session (single source of truth)
- ✅ Login flow improved: Added delay after sign-in, uses `window.location.href` for full reload
- ✅ Supabase client cookie handling properly configured

#### TypeScript Fixes ✅
- ✅ Cookie handler types added (`Cookie`, `CookieOptions` interfaces)
- ✅ All TypeScript strict mode errors resolved

---

## 📁 Project Structure

```
ntg-sms-v1/
├── backend/
│   ├── src/
│   │   ├── common/
│   │   │   ├── config/
│   │   │   │   └── supabase.config.ts
│   │   │   ├── decorators/
│   │   │   │   └── current-user.decorator.ts
│   │   │   ├── filters/
│   │   │   │   └── http-exception.filter.ts
│   │   │   ├── guards/
│   │   │   │   └── jwt-auth.guard.ts
│   │   │   └── interceptors/
│   │   │       └── response.interceptor.ts
│   │   ├── modules/
│   │   │   └── auth/
│   │   │       ├── auth.controller.ts
│   │   │       ├── auth.module.ts
│   │   │       ├── auth.service.ts
│   │   │       └── dto/
│   │   │           └── user-response.dto.ts
│   │   ├── app.controller.ts
│   │   ├── app.module.ts
│   │   ├── app.service.ts
│   │   └── main.ts
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── layout.tsx
│   │   │   │   └── login/
│   │   │   │       └── page.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── attendance/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx
│   │   │   │   ├── reports/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── settings/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── students/
│   │   │   │       └── page.tsx
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   └── providers.tsx
│   │   ├── components/
│   │   │   ├── common/
│   │   │   │   └── AuthGuard.tsx
│   │   │   └── layout/
│   │   │       ├── AppShell.tsx
│   │   │       ├── Header.tsx
│   │   │       ├── Sidebar.tsx
│   │   │       └── UserMenu.tsx
│   │   ├── hooks/
│   │   │   └── useAuth.ts
│   │   ├── lib/
│   │   │   ├── api-client.ts
│   │   │   ├── auth.ts
│   │   │   ├── query-client.ts
│   │   │   └── supabase/
│   │   │       ├── client.ts
│   │   │       ├── server.ts
│   │   │       └── types.ts
│   │   ├── types/
│   │   │   ├── api.ts
│   │   │   └── auth.ts
│   │   └── middleware.ts
│   ├── .env.local.example
│   └── package.json
│
├── mistakes.md          # Common mistakes log
├── prompts.md           # Implementation prompts
├── overallcontext.md    # Project context summary
└── implemented.md       # This file
```

---

## 🗄️ Database Schema

### Tables Created

#### `public.profiles`
- **Purpose**: User profile information linked to Supabase Auth
- **Columns**:
  - `id` (UUID, PK) - References `auth.users(id)`
  - `full_name` (TEXT, NOT NULL)
  - `avatar_url` (TEXT, nullable)
  - `created_at` (TIMESTAMPTZ)
  - `updated_at` (TIMESTAMPTZ)
- **RLS Policies**:
  - Users can view own profile
  - Users can update own profile
- **Status**: ✅ Created and configured

---

## 🔌 API Endpoints

### Authentication (`/api/v1/auth`)

#### `GET /api/v1/auth/me`
- **Purpose**: Get current authenticated user
- **Auth**: Required (JWT token)
- **Response**: `{ data: UserResponseDto }`
- **UserResponseDto**: `{ id, email, fullName, avatarUrl, roles }`
- **Status**: ✅ Implemented

#### `POST /api/v1/auth/validate`
- **Purpose**: Validate JWT token
- **Auth**: Required (JWT token)
- **Response**: `{ data: UserResponseDto }`
- **Status**: ✅ Implemented

### Health Check

#### `GET /health`
- **Purpose**: Health check endpoint
- **Auth**: Not required
- **Response**: `{ status: 'ok' }`
- **Status**: ✅ Implemented

---

## 🎨 Frontend Components

### Layout Components

#### `AuthGuard`
- **Location**: `frontend/src/components/common/AuthGuard.tsx`
- **Purpose**: Protect routes, redirect to login if not authenticated
- **Behavior**: Checks Supabase session only (not API call)
- **Status**: ✅ Implemented

#### `AppShell`
- **Location**: `frontend/src/components/layout/AppShell.tsx`
- **Purpose**: Main application shell with sidebar and header
- **Features**: Responsive, mobile burger menu
- **Status**: ✅ Implemented

#### `Sidebar`
- **Location**: `frontend/src/components/layout/Sidebar.tsx`
- **Purpose**: Navigation menu
- **Routes**: Dashboard, Students, Attendance, Reports, Settings
- **Status**: ✅ Implemented

#### `Header`
- **Location**: `frontend/src/components/layout/Header.tsx`
- **Purpose**: Top header with title and user menu
- **Status**: ✅ Implemented

#### `UserMenu`
- **Location**: `frontend/src/components/layout/UserMenu.tsx`
- **Purpose**: User dropdown menu with logout
- **Status**: ✅ Implemented

### Pages

#### Login Page
- **Location**: `frontend/src/app/(auth)/login/page.tsx`
- **Features**: Email/password form, validation, error handling
- **Status**: ✅ Implemented

#### Dashboard Pages
- **Location**: `frontend/src/app/dashboard/*/page.tsx`
- **Pages**: Dashboard, Students, Attendance, Reports, Settings
- **Status**: ✅ Placeholder pages implemented

---

## ⚙️ Configuration & Environment

### Backend Environment Variables

**File**: `backend/.env`

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# Server Configuration
PORT=3001
NODE_ENV=development

# CORS
FRONTEND_URL=http://localhost:3000
```

### Frontend Environment Variables

**File**: `frontend/.env.local`

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## 🐛 Issues Resolved

### 1. Dashboard Route 404
- **Issue**: Route group `(dashboard)/page.tsx` wasn't recognized by Next.js
- **Root Cause**: Route groups don't always work reliably with root `page.tsx`
- **Solution**: Moved to explicit route structure `app/dashboard/page.tsx`
- **Status**: ✅ Fixed

### 2. Authentication Redirect Loop
- **Issue**: After login, user redirected back to login page
- **Root Cause**: AuthGuard checking both Supabase session AND API call; API failures caused redirects
- **Solution**: AuthGuard now only checks Supabase session (single source of truth)
- **Status**: ✅ Fixed

### 3. Session Cookie Persistence
- **Issue**: Session not persisting after login
- **Root Cause**: Missing Next.js middleware for Supabase SSR cookie handling
- **Solution**: Created `middleware.ts` to refresh session cookies on each request
- **Status**: ✅ Fixed

### 4. TypeScript Cookie Handler Error
- **Issue**: `Parameter 'cookiesToSet' implicitly has an 'any' type`
- **Root Cause**: Missing type annotations for Supabase SSR cookie handler
- **Solution**: Added `Cookie` and `CookieOptions` interfaces
- **Status**: ✅ Fixed

---

## 🚀 How to Run

### Prerequisites
- Node.js 18+ installed
- Supabase project created
- Environment variables configured

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your Supabase credentials
npm run start:dev
```

**Backend runs on**: `http://localhost:3001`

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials
npm run dev
```

**Frontend runs on**: `http://localhost:3000`

### Database Setup

1. Create Supabase project
2. Run migration to create `profiles` table (see Phase 0.3 above)
3. Configure RLS policies

---

## 📝 Next Steps

### Prompt 1: System Configuration & Settings
- [ ] Phase 1.1: Academic Year Management
- [ ] Phase 1.2: Core Lookup Tables (Subjects, Classes, Sections)
- [ ] Phase 1.3: Timing Templates & Holidays
- [ ] Phase 1.4: Assessment Types & Grade Templates

### Prompt 2: Multi-Branch Support
- [ ] Phase 2.1: Branch Management
- [ ] Phase 2.2: User-Branch Assignment
- [ ] Phase 2.3: Branch-Scoped Data Foundation

### Future Prompts
- Prompt 3: User & Role Management
- Prompt 4: Student Management
- Prompt 5: Attendance Management
- ... (see `prompts.md` for full list)

---

## 📚 Key Files Reference

### Backend
- **Main Entry**: `backend/src/main.ts`
- **App Module**: `backend/src/app.module.ts`
- **Auth Module**: `backend/src/modules/auth/`
- **Common Config**: `backend/src/common/config/supabase.config.ts`
- **JWT Guard**: `backend/src/common/guards/jwt-auth.guard.ts`

### Frontend
- **Main Entry**: `frontend/src/app/layout.tsx`
- **Middleware**: `frontend/src/middleware.ts`
- **API Client**: `frontend/src/lib/api-client.ts`
- **Auth Guard**: `frontend/src/components/common/AuthGuard.tsx`
- **Dashboard Layout**: `frontend/src/app/dashboard/layout.tsx`
- **Theme System**: `frontend/src/lib/theme/themeConfig.ts`, `frontend/src/components/providers/DynamicThemeProvider.tsx`

---

## 🔍 Testing Checklist

### Authentication Flow
- [x] Can login with valid credentials
- [x] Session persists on page refresh
- [x] Logout clears session
- [x] Protected routes redirect to login when not authenticated
- [x] Dashboard accessible after login

### Navigation
- [x] Sidebar navigation works
- [x] Active route highlighting works
- [x] Mobile responsive (burger menu)
- [x] All placeholder pages accessible

### API Integration
- [x] Backend health check works
- [x] Auth endpoints return correct format
- [x] Error handling works (401 redirects to login)
- [x] Token injection in API requests works

---

## 📖 Additional Notes

- **Architecture**: Frontend calls NestJS backend API, NEVER Supabase directly (except auth)
- **Auth Flow**: Supabase Auth → JWT Token → NestJS Backend API
- **Session Management**: Supabase handles auth sessions, middleware refreshes cookies
- **Type Safety**: TypeScript strict mode enabled, all types properly defined
- **Code Style**: Follows project rules in `.cursor/rules/`
- **Common Mistakes**: See `mistakes.md` for resolved issues

---

**Last Updated**: Current Session  
**Status**: ✅ Prompt 0 Complete - Ready for Prompt 1

---

### Prompt 1: System Configuration & Settings ✅

#### Phase 1.1: Academic Year Management ✅

- **Database**
  - `academic_years` table with fields: `id`, `name`, `start_date`, `end_date`, `is_active`, `is_locked`, timestamps.
  - Unique partial index enforcing a single active academic year at a time.
  - RLS enabled.
- **Backend**
  - `AcademicYearsModule` with `academic-years.controller.ts`, `academic-years.service.ts`, DTOs for list/create/query.
  - Endpoints:
    - `GET /api/v1/academic-years` (paginated list).
    - `GET /api/v1/academic-years/active` (current active year).
    - `POST /api/v1/academic-years` (create year).
    - `PATCH /api/v1/academic-years/:id/activate` (set active).
    - `PATCH /api/v1/academic-years/:id/lock` (lock year).
- **Frontend**
  - Page: `app/settings/academic-years/page.tsx`.
  - Components:
    - `AcademicYearCard` – card view with active/locked badges and actions.
    - `AcademicYearForm` – create/edit modal with validation.
  - Hook: `useAcademicYears.ts` (React Query CRUD and active year).

#### Phase 1.2: Core Lookup Tables (Subjects, Classes, Sections, Levels) ✅

- **Database**
  - `subjects`, `classes`, `sections`, `levels`, `level_classes` tables with sort order and timestamps.
  - RLS enabled on all lookup tables.
- **Backend**
  - `CoreLookupsModule` with:
    - `subjects.controller.ts`, `classes.controller.ts`, `sections.controller.ts`, `levels.controller.ts`.
    - `core-lookups.service.ts` with paginated list + create methods and nested level→classes resolution.
    - DTOs for query, create, and response types.
  - Endpoints:
    - `GET /api/v1/subjects`, `POST /api/v1/subjects`.
    - `GET /api/v1/classes`, `POST /api/v1/classes` (optional `levelId` filter).
    - `GET /api/v1/sections`, `POST /api/v1/sections`.
    - `GET /api/v1/levels`, `POST /api/v1/levels` (with class assignment).
- **Frontend**
  - Page: `app/settings/academic/page.tsx` – tabbed view for Subjects, Classes, Sections, Levels.
  - Components:
    - `SubjectList` – list/reorder subjects.
    - `ClassList` – class cards with sort order.
    - `SectionList` – simple list with sort order.
    - `LevelManager` – levels with class chip assignments.
  - Hook: `useCoreLookups.ts` – subjects/classes/sections/levels queries + create mutations.
- **Seed Data**
  - Classes 1–10 with increasing `sort_order`.
  - Core Egyptian-style subjects (Arabic, Mathematics, English, Science, Social Studies, Religious Education, Computer Studies, Art, PE, French).
  - Sections A, B, C.
  - Levels: Primary, Middle, Secondary.
  - `level_classes` mapping:
    - Primary → Classes 1–6.
    - Middle → Classes 7–9.
    - Secondary → Class 10.

#### Phase 1.3: Timing & Schedule Settings ✅

- **Database**
  - `school_days`, `timing_templates`, `class_timing_assignments`, `public_holidays` tables with timestamps and constraints.
  - RLS enabled.
- **Backend**
  - `ScheduleModule` with `schedule.controller.ts`, `schedule.service.ts`, DTOs.
  - Endpoints:
    - `GET /api/v1/settings/school-days`, `PUT /api/v1/settings/school-days`.
    - `GET /api/v1/timing-templates`, `POST /api/v1/timing-templates`.
    - `PUT /api/v1/timing-templates/:id/assign-classes`.
    - `GET /api/v1/public-holidays`, `POST /api/v1/public-holidays`, `PUT /api/v1/public-holidays/:id`, `DELETE /api/v1/public-holidays/:id`.
- **Frontend**
  - Page: `app/settings/schedule/page.tsx`.
  - Components:
    - `SchoolDaysSelector` – checkbox matrix for days of week with Save.
    - `TimingTemplateForm` + `TimingTemplateCard` – create and view templates with assigned classes.
    - `HolidayCalendar` – CRUD for public holidays inside active academic year.
  - Hook: `useScheduleSettings.ts` – school days, timing templates, assignments, holidays.
- **Seed Data**
  - School days configured.
  - Timing templates:
    - Primary Morning Schedule (shorter day, 40-min periods).
    - Middle Morning Schedule (45-min periods).
    - Secondary Morning Schedule (50-min periods).
  - Template→class mapping aligned with levels.
  - Iraqi-oriented 2026 public holidays for the 2026–2027 academic year (national + Islamic holidays).

#### Phase 1.4: Assessment Types & Grade Templates ✅

- **Database**
  - `assessment_types`, `grade_templates`, `grade_ranges`, `class_grade_assignments`, `leave_settings` tables.
  - RLS enabled.
- **Backend**
  - `AssessmentModule` with `assessment.controller.ts`, `assessment.service.ts`, DTOs.
  - Endpoints:
    - `GET /api/v1/assessment-types`, `POST /api/v1/assessment-types`.
    - `GET /api/v1/grade-templates`, `POST /api/v1/grade-templates`, `PUT /api/v1/grade-templates/:id`.
    - `PUT /api/v1/grade-templates/:id/assign-classes` (per-class grade template + minimum passing grade).
    - `GET /api/v1/grade-templates/assignments` (class→template mapping with names).
    - `GET /api/v1/settings/leave-quota`, `PUT /api/v1/settings/leave-quota`.
  - Grade range validation to prevent overlaps and ensure consistent letters.
- **Frontend**
  - Page: `app/settings/assessment/page.tsx` with tabs:
    - Assessment types.
    - Grade templates.
    - Assignments.
    - Leave quota.
  - Components:
    - `AssessmentTypeList` – CRUD list for assessment types.
    - `GradeTemplateBuilder` – modal + table for templates and ranges.
    - `GradeTemplateAssignment` – form + table showing existing class assignments.
    - `LeaveQuotaSetting` – per-academic-year quota.
  - Hook: `useAssessmentSettings.ts` – assessment types, grade templates, assignments, leave quota.
- **Seed Data**
  - Assessment types suitable for our context: Classwork, Homework, Quizzes, Midterm Exam, Final Exam, Practical/Lab, Project, Participation.
  - Grade templates:
    - Template 1 (A/B/C/F) – 4 contiguous ranges.
    - Template 2 (A/B/C/D/E/F) – 6 contiguous ranges.
  - Class→template assignments:
    - Classes 1–4 → Template 1, minimum passing grade **C**.
    - Classes 5–10 → Template 2, minimum passing grade **D**.

#### Phase 1.5: Communication & Behavior Settings ✅

- **Database**
  - `system_settings` table for flexible JSON-based system configuration (RLS enabled).
- **Backend**
  - `SystemSettingsModule` with `system-settings.controller.ts`, `system-settings.service.ts`.
  - Endpoints:
    - `GET /api/v1/settings` – list all settings.
    - `GET /api/v1/settings/:key` – get by key.
    - `PUT /api/v1/settings/:key` – upsert `{ key, value }`.
  - Reused across:
    - `communication_direction` – teacher↔student/parent messaging directions.
    - `behavioral_assessment` – enable/mandatory/attributes.
    - `leave_quota` and future settings.
- **Frontend**
  - Page: `app/settings/communication/page.tsx` (Communication + Library categories).
  - Components:
    - `CommunicationSettings` – messaging direction controls using Mantine checkboxes (teacher↔student, teacher↔parent).
    - `LibraryCategoryEditor` – configurable library categories (for future use).
  - Page: `app/settings/behavior/page.tsx`.
  - Component:
    - `BehaviorSettings` – toggle behavioral assessment, mandatory flag, dynamic attribute list.
  - Hook: `useSystemSettings.ts` – get/update system settings by key.
- **Seed Data**
  - `communication_direction`:
    - Teacher↔Student: `teacher_only`.
    - Teacher↔Parent: `both`.
  - `behavioral_assessment`:
    - Initially disabled with empty attributes, ready for admin configuration.

---

### Prompt 2: Multi-Branch Support – Backend ✅ (Frontend ⏳)

#### Phase 2.0 & 2.1: Tenants (Schools) & Branch Management ✅ (Backend)

- **Database**
  - `tenants` table created to represent each school/customer:
    - Columns: `id`, `name`, `code`, `domain`, `is_active`, `created_at`, `updated_at` (RLS enabled).
  - `branches` table created and linked to tenants:
    - Columns: `id`, `tenant_id`, `name`, `name_ar`, `code`, `address`, `phone`, `email`, `storage_quota_gb`, `storage_used_bytes`, `is_active`, timestamps.
    - Index on `tenant_id` for efficient tenant filtering.
  - `user_branches` table created for many-to-many user↔branch mapping:
    - Columns: `user_id`, `branch_id`, `is_primary`, `created_at`.
    - PK `(user_id, branch_id)` plus RLS so users see only their own rows.
  - `profiles.current_branch_id` column added for storing the user’s currently selected branch.
  - Tenant + branch columns added to Prompt 1 “settings” tables:
    - `subjects`, `classes`, `sections`, `levels`.
    - `timing_templates`, `public_holidays`.
    - `assessment_types`, `grade_templates`.
    - Each has `tenant_id` and `branch_id` FKs to `tenants`/`branches` with supporting indexes.

- **Backend – Branches Module**
  - New `BranchesModule` added and wired into `AppModule`.
  - `branches.controller.ts`:
    - `GET /api/v1/branches` – paginated list with search on `name`/`code`.
    - `GET /api/v1/branches/:id` – single branch details.
    - `POST /api/v1/branches` – create branch (name, optional code/address/etc.).
    - `PUT /api/v1/branches/:id` – update branch fields.
    - `GET /api/v1/branches/:id/storage` – returns quota, used bytes, and percentage.
  - `branches.service.ts`:
    - Implements list/get/create/update/storage logic using Supabase service role client.
    - Maps DB rows to `BranchDto` with strict typing.
  - DTOs in `branches/dto`:
    - `BranchDto`, `CreateBranchDto`, `UpdateBranchDto`, `QueryBranchesDto` (extends `BasePaginationDto`).

#### Phase 2.2: User-Branch Assignment & Auth Context ✅ (Backend)

- **Database**
  - `user_branches` and `profiles.current_branch_id` used as source of truth for branch assignment and current branch selection.

- **Backend – Auth Module Extensions**
  - `UserResponseDto` extended with:
    - `branches: BranchSummaryDto[]`.
    - `currentBranch: BranchSummaryDto | null`.
  - New `BranchSummaryDto` introduced for lightweight branch info in auth responses.
  - `AuthService`:
    - `getCurrentUser(userId)` now:
      - Fetches Supabase `auth.users` + `profiles`.
      - Joins `user_branches` → `branches` to build `branches` list.
      - Reads `profiles.current_branch_id` and resolves `currentBranch`.
    - `getMyBranches(userId)` – returns branches assigned to user.
    - `selectBranch(userId, branchId)` – validates access via `user_branches` then updates `profiles.current_branch_id`.
    - `getCurrentBranch(userId)` – returns the currently selected branch or `null`.
  - `AuthController`:
    - Existing:
      - `GET /api/v1/auth/me` – now returns user + branches + currentBranch.
      - `POST /api/v1/auth/validate` – unchanged contract, enriched payload.
    - New endpoints:
      - `GET /api/v1/auth/my-branches` – list of branches for current user.
      - `POST /api/v1/auth/select-branch` – body `{ branchId }`, sets current branch if user has access.
      - `GET /api/v1/auth/current-branch` – returns current branch context.

#### Phase 2.3: Tenant- & Branch-Scoped Data Foundation ✅ (Backend)

- **BranchGuard & CurrentBranch Decorator**
  - New `BranchGuard` (`common/guards/branch.guard.ts`):
    - Reads `X-Branch-Id` header or falls back to `profiles.current_branch_id` for the authenticated user.
    - Verifies:
      - The user is assigned to the branch via `user_branches`.
      - The branch exists and has a valid `tenant_id`.
    - Attaches `{ branchId, tenantId }` onto the Express request as `request.branch`.
  - New `@CurrentBranch()` decorator (`common/decorators/current-branch.decorator.ts`) to inject `{ branchId, tenantId }` into controllers when needed.

- **Guard Application (Configuration/Settings APIs)**
  - `JwtAuthGuard` remains the primary auth guard; `BranchGuard` is layered on top for tenant/branch isolation:
    - `CoreLookups` controllers:
      - `SubjectsController`, `ClassesController`, `SectionsController`, `LevelsController` now use `@UseGuards(JwtAuthGuard, BranchGuard)`.
    - `ScheduleController` (`/api/v1/...` for school days, timing templates, holidays, vacations).
    - `AssessmentController` (`/api/v1/...` for assessment types, grade templates, leave quota).
    - `SystemSettingsController` (`/api/v1/settings/...`).
  - Result:
    - Any call to these configuration endpoints requires:
      - Valid JWT.
      - Valid branch context accessible to the user (branch/tenant enforced).

- **Tenant + Branch Columns on Prompt 1 Tables**
  - Migrations (`prompt2_01_tenants_and_branches`, `prompt2_02_add_tenant_and_branch_to_prompt1_tables`) ensure:
    - Tenant root (`tenants`) and `branches` exist.
    - Prompt 1 tables now carry `tenant_id` and `branch_id` where they represent tenant-specific configuration.
  - This prepares the ground for full RLS hardening so that all settings data is isolated per tenant + branch.

> **Note:** Frontend branch selection UI, header branch switcher, and branch-aware React Query hooks for Prompt 2 are still pending and will be documented once implemented.


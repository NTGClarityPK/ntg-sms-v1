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

---

### Prompt 4: Academic Structure & Teacher Mapping ✅

#### Phase 4.1: Class-Section Management ✅

**Database**
- ✅ `class_sections` table created with:
  - `id` (UUID, PK), `class_id` (FK to `classes`), `section_id` (FK to `sections`)
  - `branch_id` (FK to `branches`), `academic_year_id` (FK to `academic_years`)
  - `capacity` (INT, default 30), `is_active` (BOOLEAN, default TRUE)
  - Unique constraint: `(class_id, section_id, branch_id, academic_year_id)`
  - Index on `(branch_id, academic_year_id)`
  - RLS enabled with branch isolation policy
- ✅ Migration: `1706000000004_create_class_sections_table.sql`

**Backend**
- ✅ `ClassSectionsModule` created with:
  - `class-sections.service.ts`: CRUD operations, student counting, bulk create support
  - `class-sections.controller.ts`: REST endpoints with pagination, filtering
  - DTOs: `ClassSectionDto`, `CreateClassSectionDto`, `BulkCreateClassSectionDto`, `UpdateClassSectionDto`, `QueryClassSectionsDto`
- ✅ Endpoints:
  - `GET /api/v1/class-sections` - Paginated list with filters (classId, sectionId, isActive, academicYearId)
  - `GET /api/v1/class-sections/:id` - Get single with student count
  - `POST /api/v1/class-sections` - Create single or bulk (accepts both `CreateClassSectionDto` and `BulkCreateClassSectionDto`)
  - `PUT /api/v1/class-sections/:id` - Update capacity/isActive
  - `DELETE /api/v1/class-sections/:id` - Delete (validates no students enrolled)
  - `GET /api/v1/class-sections/:id/students` - List students in class-section
- ✅ All endpoints use `@UseGuards(JwtAuthGuard, BranchGuard)` and `@CurrentBranch()`

**Frontend**
- ✅ Page: `frontend/src/app/academic/class-sections/page.tsx` (moved from `/dashboard/academic/class-sections`)
- ✅ Components:
  - `ClassSectionGrid.tsx` - Visual grid (classes as rows, sections as columns)
  - `ClassSectionCard.tsx` - Card with class-section name, student count/capacity, class teacher name, actions
  - `CreateClassSectionModal.tsx` - Modal for single/bulk creation with pre-population support
  - `ClassSectionStudentsModal.tsx` - Modal listing students in class-section
- ✅ Hook: `useClassSections.ts` - React Query hooks for CRUD operations
- ✅ Bulk create functionality: "Create All" button to create all missing class-section combinations at once

#### Phase 4.2: Class Teacher Assignment ✅

**Database**
- ✅ `class_teacher_id` column added to `class_sections` table
- ✅ Migration: `1706000000005_add_class_teacher_id_to_class_sections.sql`

**Backend**
- ✅ `class-sections.service.ts` updated:
  - `assignClassTeacher(classSectionId, staffId, branchId)` - Assign teacher
  - `unassignClassTeacher(classSectionId, branchId)` - Remove teacher assignment
  - `getClassSectionById` includes teacher info (joins with `staff` and `profiles`)
- ✅ `class-sections.controller.ts` updated:
  - `PUT /api/v1/class-sections/:id/class-teacher` - Body: `{ staffId: string | null }`
- ✅ `staff.service.ts` updated:
  - `getAssignments(staffId, branchId)` - Returns `{ classTeacherOf: Array<...>, subjectAssignments: Array<...> }`

**Frontend**
- ✅ `ClassSectionCard.tsx` updated to display class teacher name
- ✅ `AssignClassTeacherModal.tsx` - Modal for assigning/unassigning class teacher with staff dropdown

#### Phase 4.3: Subject-Teacher Mapping (List View) ✅

**Database**
- ✅ `teacher_assignments` table created with:
  - `id` (UUID, PK), `staff_id` (FK to `staff`), `subject_id` (FK to `subjects`)
  - `class_section_id` (FK to `class_sections`), `academic_year_id` (FK to `academic_years`)
  - `branch_id` (FK to `branches`), `created_at` (TIMESTAMPTZ)
  - Unique constraint: `(subject_id, class_section_id, staff_id, academic_year_id)` - **Supports co-teaching**
  - Indexes on `staff_id` and `class_section_id`
  - RLS enabled with branch isolation policy
- ✅ Migration: `1706000000006_create_teacher_assignments_table.sql`
- ✅ Migration: `1706000000008_update_teacher_assignments_unique_constraint.sql` - Updated to support co-teaching

**Backend**
- ✅ `TeacherAssignmentsModule` created with:
  - `teacher-assignments.service.ts`: CRUD operations, validation (subjects are global, not branch-specific)
  - `teacher-assignments.controller.ts`: REST endpoints
  - DTOs: `TeacherAssignmentDto`, `CreateTeacherAssignmentDto`, `UpdateTeacherAssignmentDto`, `QueryTeacherAssignmentsDto`
- ✅ Endpoints:
  - `GET /api/v1/teacher-assignments` - Paginated list with filters (staffId, classSectionId, subjectId, academicYearId)
  - `POST /api/v1/teacher-assignments` - Create assignment (validates co-teaching uniqueness)
  - `PUT /api/v1/teacher-assignments/:id` - Update assignment
  - `DELETE /api/v1/teacher-assignments/:id` - Remove assignment
  - `GET /api/v1/teacher-assignments/by-teacher/:staffId` - Get teacher's assignments
  - `GET /api/v1/teacher-assignments/by-class/:classSectionId` - Get class's subjects/teachers

**Frontend**
- ✅ Page: `frontend/src/app/academic/teacher-mapping/page.tsx` (moved from `/dashboard/academic/teacher-mapping`)
- ✅ Components:
  - `TeacherMappingList.tsx` - List view with pagination
  - `CreateAssignmentModal.tsx` - Modal for creating assignments (filters to only teacher roles)
- ✅ Hook: `useTeacherAssignments.ts` - React Query hooks for CRUD operations

#### Phase 4.4: Subject-Teacher Mapping (Matrix View) ✅

**Frontend**
- ✅ `TeacherMappingMatrix.tsx` - Matrix view (class-sections as rows, subjects as columns)
- ✅ `MatrixCell.tsx` - Editable cell component supporting:
  - Multiple teachers per cell (co-teaching)
  - Click assigned teacher → "Unassign" option only
  - Dotted "+ Assign" button below assigned teachers to add more
  - Filters out already-assigned teachers from dropdown
  - Only shows teachers with `class_teacher` or `subject_teacher` roles
- ✅ Toggle between List View and Matrix View on teacher mapping page

#### Phase 4.5: Teacher Schedule View ✅

**Backend**
- ✅ `staff.service.ts` updated:
  - `getAssignments(staffId, branchId)` - Returns full schedule with class teacher and subject assignments
- ✅ `staff.controller.ts` updated:
  - `GET /api/v1/staff/:id/schedule` - Get teacher's full schedule
  - `GET /api/v1/staff/me` - Get current user's staff record (placed before `/:id` to avoid route conflicts)

**Frontend**
- ✅ Page: `frontend/src/app/staff/[id]/schedule/page.tsx` (moved from `/dashboard/staff/[id]/schedule`)
- ✅ Page: `frontend/src/app/my-schedule/page.tsx` - "My Schedule" page for logged-in teachers
- ✅ Hook: `useStaffSchedule.ts` - React Query hook for fetching staff schedule
- ✅ Hook: `useMyStaff.ts` - React Query hook for fetching current user's staff record
- ✅ "View Schedule" button (calendar icon) added to Staff table for all staff members
- ✅ "My Schedule" navigation tab added to Sidebar (visible only to users with `class_teacher` or `subject_teacher` roles)

#### Navigation Updates ✅

- ✅ Sidebar updated:
  - Removed nested "Academic" menu item
  - Added top-level "Class Sections" link (`/academic/class-sections`)
  - Added top-level "Teacher Mapping" link (`/academic/teacher-mapping`)
  - Added conditional "My Schedule" link (`/my-schedule`) for teachers only
  - All routes moved from `/dashboard/*` to root level (e.g., `/staff`, `/users`, `/students`, `/academic/*`)

---

### Post-Implementation Improvements & Fixes (Prompt 4)

#### Route Structure Fix ✅
- ✅ **Issue**: Routes were incorrectly nested under `/dashboard` (e.g., `/dashboard/academic/class-sections`)
- ✅ **Fix**: Moved all functional routes to root level:
  - `/academic/class-sections` (was `/dashboard/academic/class-sections`)
  - `/academic/teacher-mapping` (was `/dashboard/academic/teacher-mapping`)
  - `/staff/[id]/schedule` (was `/dashboard/staff/[id]/schedule`)
  - `/staff`, `/users`, `/students`, `/reports` (all moved to root level)
- ✅ **Reason**: Route groups `(folder)` are for layout organization only, not URL paths. Functional routes should be at root level.
- ✅ **Files Updated**: All page files moved, `Sidebar.tsx` updated with new routes

#### User/Staff/Student Separation ✅
- ✅ **Clarification**: Clear separation between:
  - `/users` - Generic user accounts (non-students) with roles and permissions
  - `/staff` - Staff-specific employment records (employee ID, department, join date)
  - `/students` - Student-specific academic records (student ID, class, section, enrollment)
- ✅ **Implementation**: 
  - `staff` table populated from existing users with staff roles via migration `1706000000007_populate_staff_from_existing_users.sql`
  - Staff service refactored to fetch `user_roles` and `profiles` separately (Supabase relationship limitations)
  - Updated page descriptions to clarify purpose of each section

#### Database Validation Fixes ✅
- ✅ **Issue**: Backend was validating that `classes` and `sections` belong to the current branch
- ✅ **Fix**: Classes and sections are **global entities**, not branch-specific
  - Removed `branch_id` check from `class-sections.service.ts` when validating `classId` and `sectionId`
  - Updated error messages to reflect global nature
- ✅ **Issue**: Backend was validating that `subjects` belong to the current branch
- ✅ **Fix**: Subjects are **global entities**, not branch-specific
  - Removed `branch_id` check from `teacher-assignments.service.ts` when validating `subjectId`
  - Updated error messages to reflect global nature

#### UI Improvements ✅
- ✅ **Class Sections Page**:
  - Fixed "Create Class-Section" button spacing (moved to right end, properly spaced from heading)
  - Added "Create All" button to bulk create all missing class-section combinations
  - Pre-population of class and section fields when clicking "Create" on specific grid card
  - Form resets on modal close
- ✅ **Teacher Mapping Page**:
  - Fixed "List View/Matrix View" toggle and "Create Assignment" button spacing (moved to right end, lowered slightly)
- ✅ **Staff Table**:
  - Added "View Schedule" button (calendar icon) for all staff members
  - Initially restricted to teachers only, then restored for all staff (school admins may need to view any schedule)

#### Teacher Role Filtering ✅
- ✅ **Issue**: Teacher assignment dropdowns showed non-teacher roles (e.g., "school admin")
- ✅ **Fix**: 
  - Backend: Updated `staff.service.ts` to return `role.name` instead of `role.display_name` for consistency
  - Frontend: Filtered staff options to only include active staff with `class_teacher` or `subject_teacher` roles
  - Applied in: `MatrixCell.tsx`, `CreateAssignmentModal.tsx`

#### Co-Teaching Support ✅
- ✅ **Feature**: Allow multiple teachers to be assigned to the same subject-class-section combination
- ✅ **Database**: Updated unique constraint on `teacher_assignments` to include `staff_id`:
  - Old: `UNIQUE(subject_id, class_section_id, academic_year_id)`
  - New: `UNIQUE(subject_id, class_section_id, staff_id, academic_year_id)`
- ✅ **Backend**: Updated `teacher-assignments.service.ts` to check if the *specific teacher* is already assigned (not just if any teacher is assigned)
- ✅ **Frontend**: 
  - `TeacherMappingMatrix.tsx` updated to store arrays of assignments per cell
  - `MatrixCell.tsx` updated to:
    - Display multiple assigned teachers as separate buttons
    - Clicking assigned teacher shows only "Unassign" option
    - Dotted "+ Assign" button appears below assigned teachers to add more
    - Filters out already-assigned teachers from assign menu

#### "My Schedule" Feature for Teachers ✅
- ✅ **Backend**: 
  - Added `getStaffByUserId(userId, branchId)` method to `staff.service.ts`
  - Added `GET /api/v1/staff/me` endpoint to get current user's staff record
- ✅ **Frontend**:
  - Added `useMyStaff()` hook in `useStaff.ts`
  - Created `/my-schedule/page.tsx` for logged-in teachers to view their own schedule
  - Added conditional "My Schedule" navigation tab in Sidebar (visible only to teachers)
  - Shows class teacher assignments and subject assignments

#### Loading State Improvements ✅
- ✅ **Issue**: "No records found" message flashed briefly when navigating between tabs before data loaded
- ✅ **Fix**: Updated conditional rendering logic to distinguish between "no data yet" (loading) and "data loaded but empty" (empty state)
- ✅ **Pattern Applied**:
  ```typescript
  // ✅ Correct - Show loader when data is undefined
  {query.isLoading || !query.data ? (
    <Loader />
  ) : query.error ? (
    <Error />
  ) : query.data.data.length === 0 ? (
    <EmptyState />
  ) : (
    <Table />
  )}
  ```
- ✅ **Files Updated**: `staff/page.tsx`, `users/page.tsx`, `students/page.tsx`

#### Staff Service Refactoring ✅
- ✅ **Issue**: Supabase relationship syntax failed for indirect relationships (`staff` → `user_roles` → `roles`, `staff` → `profiles`)
- ✅ **Fix**: Refactored `listStaff` and `getStaffById` to:
  - Fetch `staff` data first
  - Fetch `user_roles` and `profiles` separately using extracted `user_id` values
  - Combine data in application code using Maps for efficient lookups
  - Client-side filtering for `full_name` search (database only searches `employee_id`)
- ✅ **Reason**: Supabase relationship syntax only works for direct foreign key relationships recognized in schema cache

#### Missing Component Imports Fixed ✅
- ✅ Fixed `ReferenceError: Group is not defined` in:
  - `StaffForm.tsx` - Added `Group` to imports
  - `ClassSectionStudentsModal.tsx` - Added `Group` to imports

---

**Last Updated**: Current Session  
**Status**: ✅ Prompt 4 Complete - All phases implemented with post-implementation improvements

---

### Parent–Student Associations (Admin Screen) ✅

- **Database**
  - `parent_students` table seeded via Supabase MCP to enable parent-facing features testing.
- **Backend**
  - Parents module endpoints used:
    - `GET /api/v1/parents/associations` (paginated list with branch scope)
    - `POST /api/v1/parents/:id/children` (link child)
    - `DELETE /api/v1/parents/:id/children/:studentId` (unlink child)
  - Refactored parent-student reads to **avoid Supabase relationship syntax** for `parent_students` (schema cache FK issues) by fetching related `profiles`/`students` separately and hydrating in code.
- **Frontend**
  - New admin page: `/parent-associations` (old route `/users/parent-associations` redirects)
  - New hooks/components:
    - `useParentAssociations.ts`
    - `ParentAssociationTable`, `CreateParentAssociationModal`
  - Added Sidebar link: “Parent Associations” → `/parent-associations`

---

### Prompt 5.4: Parent Attendance View & Notifications – Notification UI/UX Fixes ✅

> This session focused on stabilising and polishing the **notifications experience for parents**, especially for attendance alerts, after the core Prompt 5.4 plan was implemented.

- **Backend – Notifications Filtering Fix**
  - Updated `backend/src/modules/notifications/dto/query-notifications.dto.ts`:
    - **Issue**: With global `ValidationPipe` configured as:
      - `transform: true` and `transformOptions.enableImplicitConversion = true`,
      - query param `?isRead=false` was being implicitly converted to `false` *before* the DTO `@Transform` ran.
      - The original transform only handled string values `'true'/'false'`, so a boolean `false` became `undefined` and the `is_read` filter was **skipped**, returning all notifications.
    - **Fix**: Transform now handles both booleans and strings:
      - `if (value === true || value === 'true') return true;`
      - `if (value === false || value === 'false') return false;`
      - Ensures `isRead` is correctly set to `true`/`false` and `listNotifications` always applies `.eq('is_read', query.isRead)` when provided.

- **Frontend – Notifications Dropdown & Layout**
  - `NotificationBell.tsx`:
    - Adjusted bell popover dropdown sizing to avoid “View All Notifications” button overflowing:
      - Increased width to `380px`, added `maxHeight: '500px'` and `overflow: 'hidden'`.
    - Bell badge (`useUnreadCount`) now shows a **true unread count**, not just the size of a filtered list.
  - `NotificationDropdown.tsx`:
    - Wrapped content Stack with flex + maxHeight to keep header, list, and footer button within popover bounds.
    - Reduced `ScrollArea` height (approx. `350px`) and made it flex-fill so the “View All Notifications” button stays visible.
    - Made “View All Notifications” button compact (`size="sm"`) and ensured it routes to `/notifications` then closes the dropdown.

- **Frontend – `/notifications` Page Integration & Tabs**
  - Added `frontend/src/app/notifications/layout.tsx`:
    - Wraps notifications page in `AuthGuard` + `AppShell`, so `/notifications` opens inside the main layout with sidebar (same behaviour as `/dashboard`).
  - `Sidebar.tsx`:
    - Added a dedicated **“Notifications”** nav item with `IconBell`, pointing to `/notifications`.
  - `frontend/src/app/notifications/page.tsx`:
    - Ensured the header bar uses the standard `page-title-bar` pattern with proper spacing from content.
    - Implemented **four tabs** with consistent counts:
      - **All** – all notifications (single query via `useNotifications({ limit: 100 })`).
      - **Unread** – derived on the client: `allNotifications.filter(n => !n.isRead)`.
      - **Read** – derived on the client: `allNotifications.filter(n => n.isRead)`.
      - **Attendance** – still uses `useNotifications({ type: 'attendance', limit: 100 })`.
    - All three core tabs (`All`, `Unread`, `Read`) share the **same loading state** (`isLoadingAll`), ensuring consistent UX.

- **Frontend – Unread Count (Bell Badge)**
  - `useNotifications.ts` → `useUnreadCount()`:
    - **Issue**: Previously fetched `/api/v1/notifications?isRead=false&limit=...` and used `response.data.length`, which broke when backend filtering failed or when limits changed.
    - **Fix**: Unread count now uses backend **totals**:
      - Fetch total notifications with `?limit=1` and read `meta.total` (fallback to `data.length` if meta missing).
      - Fetch total **read** notifications with `?isRead=true&limit=1` and read `meta.total`.
      - Compute `unread = total - read`, clamped at `>= 0`.
    - This makes the bell badge robust to page size and consistent with database truth (e.g., All 27, Read 1 → Unread badge 26).
  - **React Query invalidation**:
    - `useMarkAsRead` and `useMarkAllAsRead` now invalidate:
      - `['notifications']` – covers all list queries (`useNotifications` with different params).
      - `['notifications', 'unread-count']` – keeps bell badge in sync.

- **Behaviour Summary for Parent User (e.g., `parent1@parents.alahmar.edu`)**
  - `/notifications` page:
    - **All**: 27.
    - **Read**: 1 (after marking a notification as read).
    - **Unread**: 26, derived from the All list.
    - **Attendance**: 27 (all notifications of type `attendance`).
  - Bell badge:
    - Shows **26**, matching `All − Read`.
  - Notification dropdown:
    - Shows the latest unread notifications with “Mark all read” and a “View All Notifications” button that correctly navigates into the AppShell-wrapped `/notifications` page.

> These changes ensure the notifications experience is **numerically consistent**, **layout-safe**, and aligned with multi-tenant backend truth, especially important for Prompt 5.4 parent attendance notifications.



---

### Performance Optimisation: Attendance, Notifications, React Query & Supabase (Performance Plan v1) ✅

> This section logs only the improvements implemented during the performance audit/implementation sessions described in `performancefindings.md` and the associated plan.

#### Backend – Attendance Module Optimisations (`attendance.service.ts`) ✅

- **List & Detail Queries**
  - Kept `listAttendance`, `getAttendanceByClassAndDate`, and `getAttendanceByStudent` aligned with the existing API contracts but optimised their internal hydration logic:
    - Hydrate related entities (students, profiles, class_sections, classes, sections, marked_by profiles) using **batched Supabase queries** instead of per-row lookups.
    - Use `Set`-based ID de-duplication and `Map` lookups in Node to minimise repeated work while preserving DTO shapes.
  - `updateAttendance`:
    - Stopped using `listAttendance` as a post-update rehydration hack.
    - Introduced a private `hydrateSingleAttendanceRow(row: AttendanceRow)` helper that:
      - Loads the specific student, class_section, class, section, and marked_by profile in **parallel** via `Promise.all`.
      - Builds a single `AttendanceDto` instance for the updated record only.

- **Bulk Mark Attendance**
  - `bulkMarkAttendance` now:
    - Uses a **single `upsert`** on `attendance` (`onConflict: 'student_id,date,academic_year_id'`) with a pre-computed `nowIso` timestamp.
    - Hydrates all updated rows in one pass:
      - Fetches all referenced students and their profiles in bulk.
      - Builds a set of `AttendanceDto` objects ordered by unique `student_id`.
    - Sends attendance notifications via `notificationsService.createAttendanceNotification` in a **fire-and-forget** fashion (`void ...catch(...)`) so notification failures never block the API.

- **Attendance Summaries (moved aggregation to SQL)**
  - `getAttendanceSummaryByStudent`:
    - Previously: loaded all matching rows (`select('status')`) and counted in memory.
    - Now:
      - Fetches academic year date range as before.
      - Builds a reusable base query on `attendance` filtered by `student_id`, `branch_id`, `academic_year_id`, and academic year dates.
      - Executes four **parallel `count` queries** using `select('id', { head: true, count: 'exact' })` for statuses `present`, `absent`, `late`, `excused`.
      - Derives `presentDays`, `absentDays`, `lateDays`, `excusedDays`, `totalDays`, and `percentage` from those counts, keeping the `AttendanceSummaryDto` shape and semantics exactly the same.
  - `getAttendanceSummaryByClass`:
    - Previously: loaded all rows for the class-section and counted statuses in memory.
    - Now:
      - Verifies class-section as before.
      - Builds a base query on `attendance` filtered by `class_section_id`, `branch_id`, `academic_year_id`, and optional `startDate` / `endDate`.
      - Executes the same four **parallel `count` queries** for `present`, `absent`, `late`, `excused`.
      - Calculates `totalDays` and `percentage` consistently with the student summary.

#### Backend – Notifications Module Optimisations ✅

- **Unread Count Endpoint**
  - Added `NotificationsService.getUnreadNotificationsCount(userId: string)`:
    - Performs a single **aggregate-style query** with `select('id', { head: true, count: 'exact' })` filtered by `user_id` and `is_read = false`.
    - Returns `{ count: number }` without materialising any notification rows.
  - Added controller route `GET /api/v1/notifications/unread-count`:
    - Guarded the same way as other notifications endpoints.
    - Returns `{ data: { count }, meta: null, error: null }` following the global `{ data, meta, error }` API response format.

#### Frontend – Notifications Hooks and Page ✅

- **`useNotifications.ts`**
  - `useUnreadCount`:
    - Switched from inferring unread count via list queries to calling the new backend endpoint:
      - Uses `apiClient.get<{ data: { count: number } }>(/api/v1/notifications/unread-count)` and returns `data.count`.
      - Adds `staleTime: 30000` (30 seconds) to avoid over-polling a relatively stable metric.
  - `useNotifications`:
    - Added `staleTime: 30000` to reduce unnecessary refetches while users are reading notifications.
    - Left query keys and shapes unchanged so all existing consumers continue to work.

- **`/notifications` Page**
  - Removed a redundant second `useNotifications` call that re-fetched only attendance notifications.
    - Now derives “attendance-only” notifications on the client for non-critical views, or uses a single type-filtered query where necessary.
  - Ensured the tabbed UI reuses the **single base dataset** where possible to avoid duplicate network calls on tab switches.

#### Frontend – Lookup & Settings Hooks (React Query Caching) ✅

- Marked semi-static configuration data as effectively static at runtime:
  - `useAcademicYears.ts`
  - `useCoreLookups.ts`
  - `useSystemSettings.ts`
  - `useScheduleSettings.ts`
  - All now opt into `staleTime: Infinity` (and compatible options), so:
    - Data is fetched once per session unless explicitly invalidated.
    - Page switches no longer refetch unchanged configuration on every mount.

#### Frontend – Students & Staff Data Fetching / UX ✅

- **Hooks**
  - `useStudents.ts`:
    - Clarified the API expectations in comments (alignment with `{ data, meta }` backend format).
    - Centralised all query params building (pagination, classIds/sectionIds arrays, search, sorting) in a single, typed hook.
    - Left the query key as `['students', branchId, params]` for correct cache separation by branch and filter set.
  - `useStaff.ts`:
    - Ensured consistent query keying and error handling.

- **Pagination & Search UX**
  - `students/page.tsx` and `staff/page.tsx`:
    - Use Mantine’s `useDebouncedValue` for search inputs (e.g., student name/ID, staff name/employee ID) to avoid API calls on every keystroke.
    - Kept the existing table layout and filters but significantly reduced React Query churn and backend load.

#### Frontend – TypeScript & React Query v5 Fixes ✅

- Fixed multiple build-time TypeScript errors uncovered by `npm run build`:
  - Several components and pages (`students`, `staff`, academic teacher-mapping components, parent association components) were assuming `query.data` was a plain array instead of `{ data, meta }`.
    - Updated access patterns to:
      - Guard for `'data' in query.data` or use proper DTO typing before reading `.data`.
      - Provide safe fallbacks (`[]`) for empty states.
  - Removed deprecated React Query options:
    - `keepPreviousData` is no longer supported in the current React Query version.
    - Removed it from `useStudents` and `useStaff` options to restore type-safety while keeping UX smooth via debounced inputs and stable query keys.
- Verified **both**:
  - `cd backend && npm run build`
  - `cd frontend && npm run build`
  - Build and type-check cleanly after all performance changes.

#### Supabase – Indexing & RLS Performance Tuning ✅

- **Indexes (Attendance)**
  - Applied targeted Supabase migrations:
    - `CREATE INDEX IF NOT EXISTS idx_attendance_academic_year ON public.attendance (academic_year_id);`
    - `CREATE INDEX IF NOT EXISTS idx_attendance_class_section ON public.attendance (class_section_id);`
    - `CREATE INDEX IF NOT EXISTS idx_attendance_marked_by ON public.attendance (marked_by);`
  - Rationale:
    - These cover common filter combinations used by attendance listings, summaries, and reports, and address Supabase advisor “unindexed foreign keys” hints for `attendance` without duplicating existing compound indexes.

- **RLS Optimisation (Notifications)**
  - Updated the `Users see own notifications` policy on `public.notifications`:
    - From: `USING (user_id = auth.uid())`
    - To: `USING (user_id = (SELECT auth.uid()))`
    - Behaviour remains identical, but Supabase no longer re-evaluates `auth.uid()` for every row, improving performance at scale in line with Supabase’s `auth_rls_initplan` advisory.


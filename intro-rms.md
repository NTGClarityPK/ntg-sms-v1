# Introduction

Welcome to the **NTG School Management System (SMS)** documentation.

This GitBook space is intended to document **the SMS application as implemented in this repository** (`ntg-sms-v1`) — covering the user-facing portal, the backend API, and the operational setup used by our team.

## What this SMS is

The SMS is a **multi-tenant, multi-branch** school platform built around:

- **Supabase Auth** for authentication (email/password, session cookies)
- A **NestJS API** (single gateway for all data access)
- A **Next.js 14 portal** (Mantine UI + React Query) with role-based navigation

All authenticated features run inside a single portal layout (header + sidebar) so navigation is consistent and fast across modules.

## Who uses it (roles implemented)

The app supports multiple roles (role names are used throughout the portal and API):

- **School Admin**, **Principal**, **Academic Coordinator**
- **Class Teacher**, **Subject Teacher**
- **Guidance Counsellor**
- **Parent** (including child selection / “act as child” mode in the portal)
- **Student**
- **Super Admin** (full access)

Access to features is permission-driven; the sidebar only shows what the current role can view.

## What’s included (current portal modules)

The portal currently includes pages and flows for:

- **Authentication**: login, reset password, signup, auth callback, optional **PIN-based** auth mode, branch selection during login (when applicable)
- **Multi-branch context**: branch-aware behaviour via `X-Branch-Id` (backend) and persisted current branch (frontend)
- **Dashboard**: role-aware landing within the authenticated portal
- **Users & Roles**
  - Users management
  - Roles/permissions-based visibility in the UI
- **Students & Parents**
  - Students listing and management
  - Parent–student associations
  - “My children” experience for parents
- **Academic structure**
  - Class sections
  - Teacher mapping / assignments
  - Subject templates (settings)
- **Attendance**
  - Attendance overview and history
  - Attendance marking (staff)
  - Child attendance view (parent/student context)
- **Assessments & grading**
  - Assessments list, create, edit
  - Assessment grades + statistics pages
  - “My assessments” for teaching roles
- **Timetable & schedules**
  - Timetable views
  - “My timetable” and “My schedule” pages
  - Children timetable view
  - Conflict management page (timetable/events/assessments conflicts)
- **Behavioural**
  - Behavioural overview
  - Behavioural assessment entry flow (role-limited)
- **Leaves & early departure**
  - Leave requests (raise, review, approve/reject/cancel)
  - Early departure requests (raise, review, approve/reject)
- **Events**
  - Events list, create, view, edit
  - “My events” page
- **Notifications**
  - Notifications page (all/unread/read/attendance)
  - Notification bell in the header with unread counts and “mark all read”
- **Messages**
  - Messages page (portal entry point)
- **Library**
  - Library page (portal entry point)
- **Uniform inventory**
  - Inventory dashboard + items + requests + history
  - Uniform request page (parent flow)
- **Reports & results**
  - Reports index + student report pages + class reports + administrative reports
  - Public report/statistics pages (branch-code based route)
  - Results page
- **Storage**
  - Admin storage page (portal)
- **Settings**
  - Academic years
  - Academic lookups/settings
  - Schedule settings
  - Assessment settings
  - Communication settings
  - Behaviour settings
  - Permissions settings
  - Theme settings
- **Audit trail**
  - Admin portal pages for audit trail and related admin-only operations

## Language, RTL, and PWA support

- **Internationalisation**: implemented with `next-intl` (locale stored via `NEXT_LOCALE` cookie) with **LTR/RTL** switching.
- **PWA**: the frontend includes PWA support and an **Offline Documents** area to access content when connectivity is limited.

## System boundaries (how the app is built)

To keep data access consistent and secure, the architecture follows one strict rule:

- **Frontend → NestJS API → Supabase (Postgres)**  
  The frontend does not query Supabase directly (except for Supabase Auth/session).

The backend enforces:

- **Standard API shape**: all responses follow `{ data, meta? }` via a global response interceptor
- **JWT validation**: Supabase JWT is validated on protected routes
- **Branch context**: branch isolation is applied through request context (e.g. `X-Branch-Id`) and server-side guards/policies

## Repository structure (as in this repo)

This repository is organised as:

- `frontend/`: Next.js 14 portal (Mantine UI, React Query, next-intl, PWA)
- `backend/`: NestJS API (Swagger, guards/interceptors, Supabase service client)
- `supabase/`: migrations and related database assets
- `docs/`, `documentations/`, `developmentguide/`: internal implementation and team guides

## Quick start (local development)

### Prerequisites

- Node.js (for both `frontend/` and `backend/`)
- A Supabase project (URL, anon key for frontend; service key + JWT secret for backend)

### Run the backend (NestJS)

- Configure environment variables in `backend/.env` (see `backend/.env.example`)
- Start dev server:
  - `npm install`
  - `npm run start:dev`
- Health check: `GET /health`
- Swagger: `GET /api/docs`

### Run the frontend (Next.js)

- Configure environment variables in `frontend/.env.local` (see `frontend/.env.local.example`)
- Start dev server:
  - `npm install`
  - `npm run dev`

## Deployment (Docker)

This repo includes Docker Compose definitions:

- `docker-compose.yml` for production-like deployment (frontend + backend)
- `docker-compose-staging.yml` for staging-like deployment

These compose files expose:

- Frontend on port `3000` (mapped to `9000` in `docker-compose.yml`)
- Backend on port `3001` (mapped to `9001` in `docker-compose.yml`)

## Where to go next in this GitBook

Suggested starting points (depending on your audience):

- **Product overview**: portal modules, roles, and branch/tenant concepts
- **User journeys**: login → branch selection → core workflows (attendance, leaves, assessments, timetable, reports)
- **Admin setup**: academic years, lookups, schedule settings, permissions, and templates
- **Developer reference**: API conventions, response format, and environment setup

## 1. What's already done by me: 

```
* All rules files are added:


.<project>/.cursor/rules/, and you have:
.cursor/rules/backend.mdc
.cursor/rules/database.mdc
.cursor/rules/frontend.mdc
.cursor/rules/global-rules.mdc


* In documentations directory, I have added detailed scope file.


```

## 2. Project Structure

```
your-project/
├── frontend/                    # Next.js + Mantine
│   ├── .cursor/rules/          # Frontend-specific rules
│   ├── src/
│   │   ├── app/                # App router pages
│   │   ├── components/
│   │   │   ├── common/         # Shared components
│   │   │   ├── layout/         # Shell, nav, sidebar
│   │   │   └── features/       # Feature-specific
│   │   ├── hooks/              # React Query hooks
│   │   ├── lib/                # API client, utils
│   │   └── types/              # TypeScript interfaces
│   └── AGENTS.md
│
├── backend/                     # NestJS
│   ├── .cursor/rules/          # Backend-specific rules
│   ├── src/
│   │   ├── modules/            # Feature modules
│   │   │   └── [feature]/
│   │   │       ├── dto/
│   │   │       ├── entities/
│   │   │       ├── *.controller.ts
│   │   │       ├── *.service.ts
│   │   │       └── *.module.ts
│   │   └── common/             # Guards, decorators, filters
│   └── AGENTS.md
│
├── docs/
│   ├── scope/                  # Your feature scope documents
│   ├── contracts.md            # API contracts (FE↔BE)
│   └── architecture.md
│
├── .cursor/rules/              # Root-level rules
│   ├── global.mdc
│   ├── frontend.mdc
│   ├── backend.mdc
│   └── database.mdc
│
├── overallcontext.txt          # Project scope summary (AI reads this)
├── mistakes.md                 # Track AI's repeated mistakes
└── AGENTS.md                   # Root agent instructions
```

---


# Context Files Reference Guide

This following text explains the key context files used in this project and how they work together with Cursor AI.

---

## 1. overallcontext.txt

### What It Is
A living summary of your entire project that AI reads before implementing any feature. Think of it as the AI's "project memory."

### Location
`/overallcontext.txt` (project root)

### What It Contains
- Project purpose (2-3 sentences)
- User roles and permissions summary
- Feature categories overview
- Completed features and their status
- Key technical decisions
- Integration points between features

### Example
```
# Project Context: School Management System

## Purpose
Multi-branch school management system for Iraqi schools with 9 user roles, 
supporting academic tracking, attendance, and parent communication.

## User Roles
- Parent/Guardian: View child data, attendance, grades
- Student: View own academic info
- Principal: Full system access
- School Admin: Administrative operations
- Class Teacher: Attendance, grades for own class
- Subject Teacher: Grades for own subject
- Academic Coordinator: Curriculum, scheduling
- Guidance Counselor: Student support records
- Admin Assistant: Administrative support

## Completed Features
- [x] Authentication: Supabase Auth with role selection
- [x] User Management: CRUD via /api/v1/users
- [ ] Roles & Permissions: IN PROGRESS

## Technical Decisions
- Frontend calls NestJS API, never Supabase directly (except auth)
- Multi-tenant by branch_id on all tables
- React Query for all data fetching

## Integration Notes
- User module used by all features for auth context
- Branch selection affects all subsequent queries
```

### When to Update
- After completing a feature
- After making architectural decisions
- When starting a new major feature

---

## 2. docs/contracts.md

### What It Is
The API contract between frontend and backend. Defines exactly what endpoints exist and what data they accept/return.

### Location
`/docs/contracts.md`

### What It Contains
- All API endpoints with HTTP methods
- Request body/query parameters
- Response format with example
- Authentication requirements

### Example
```markdown
# API Contracts

## Users Module

### GET /api/v1/users
**Auth**: Required (Admin, Principal)
**Query Params**:
- page (number, default: 1)
- limit (number, default: 20)
- search (string, optional)
- role (string, optional)

**Response**:
{
  "data": [
    {
      "id": "uuid",
      "email": "teacher@school.iq",
      "fullName": "Ahmed Hassan",
      "roles": ["class_teacher"],
      "branchId": "uuid",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20
  }
}

### POST /api/v1/users
**Auth**: Required (Admin)
**Body**:
{
  "email": "string (required)",
  "fullName": "string (required)",
  "password": "string (required, min 8)",
  "roles": ["string"] (required),
  "branchId": "uuid (required)"
}

**Response**: Same as single user object
```

### When to Update
- Before implementing a new feature (define contract first)
- When changing API response structure
- When adding new endpoints

---

## 3. mistakes.md

### What It Is
A log of repeated mistakes AI makes in this project. AI reads this before coding to avoid repeating errors.

### Location
`/mistakes.md` (project root)

### What It Contains
- Categorized list of mistakes
- What was wrong
- What the correct approach is
- Date when discovered (for recent issues)

### Example
```markdown
# Common Mistakes - DO NOT REPEAT

## Styling
- ❌ Using Tailwind classes → ✅ Use Mantine components only
- ❌ Inline styles for static values → ✅ Use Mantine props (p="md", color="blue")
- ❌ Creating custom CSS files → ✅ Use CSS Modules only if Mantine insufficient

## API Calls
- ❌ Calling Supabase from frontend → ✅ Call NestJS API endpoints
- ❌ Not including branchId in queries → ✅ Always filter by user's branchId

## Types
- ❌ Using `any` type → ✅ Define proper interface
- ❌ Optional fields without `?` → ✅ Mark optional: `field?: string`

## Components
- ❌ Putting 'use client' on every file → ✅ Only when using hooks/interactivity
- ❌ Fetching in useEffect → ✅ Use React Query hooks

## NestJS
- ❌ Business logic in controller → ✅ Keep logic in service
- ❌ Raw Supabase errors to client → ✅ Throw NestJS exceptions

## Recently Discovered
- [2024-01-15] ❌ Forgot JwtAuthGuard on new endpoint → ✅ Add to ALL endpoints
- [2024-01-14] ❌ Used string for date, broke sorting → ✅ Use ISO string format
```

### When to Update
- Immediately when you catch AI making a repeated mistake
- After code review reveals patterns
- When onboarding reveals common confusion points

---

## How They Work Together

```
┌─────────────────────────────────────────────────────────┐
│                   AI Receives Task                       │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  1. Read overallcontext.txt                             │
│     → Understand project scope                          │
│     → Know what features exist                          │
│     → Understand technical decisions                    │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  2. Read docs/contracts.md                              │
│     → Know API endpoint formats                         │
│     → Match request/response structures                 │
│     → Ensure consistency                                │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  3. Read mistakes.md                                    │
│     → Avoid known pitfalls                              │
│     → Follow correct patterns                           │
│     → Learn from past errors                            │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  4. Implement Feature                                   │
│     → With full context                                 │
│     → Following contracts                               │
│     → Avoiding mistakes                                 │
└─────────────────────────────────────────────────────────┘
```

---

## Quick Reference

| File | Purpose | Update When |
|------|---------|-------------|
| `overallcontext.txt` | Project memory | Feature complete, decisions made |
| `docs/contracts.md` | API definitions | Before/after API changes |
| `mistakes.md` | Error prevention | AI makes repeated mistake |

---

## For Cursor Rules

Reference these files in your global rules:
```
@overallcontext.txt - Project scope and status
@docs/contracts.md - API contracts
@mistakes.md - Patterns to avoid
```

AI should:
- READ these files before implementing features
- UPDATE overallcontext.txt after completing features
- LOG mistakes to mistakes.md when patterns emerge


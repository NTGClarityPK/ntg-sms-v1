# 🎯 Vibe Coding Guide
## Next.js + Mantine UI + NestJS + Supabase

---

## 1. Core Philosophy

**Garbage In, Garbage Out** - Your prompt quality determines output quality.

**Plan First, Code Second** - Never skip planning. AI without structure produces chaos.

**Step Up the Vibe** - Build 10-30 lines at a time, not 200 lines then "it's broken."

**Vibe but Verify** - Cross-validate with multiple LLMs when unsure.

**Context is King** - What the AI "sees" determines everything.

**Save Like a Maniac** - Commit after every working change. You'll thank yourself.

---

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


## 4. The overallcontext.txt Strategy

This is your AI's "project memory." Generate it ONCE at project start:

### How to Generate It

Give your full scope document to Claude/Gemini and ask:

```
Read this scope document and generate a project context summary that includes:
1. Project purpose (2-3 sentences)
2. All user roles and their high-level permissions
3. Each feature category summarized (1-2 sentences each)
4. Key technical decisions (API patterns, auth flow, etc.)
5. Integration points between features

Keep under 800 words. This will be fed to AI agents as context.
```

### How to Use It

Add this to your global.mdc:

```
Before implementing ANY feature:
1. Read @overallcontext.txt for project scope
2. Check @docs/contracts.md for API specs
3. Review @mistakes.md for patterns to avoid
```

### When to Update It

After completing each major feature, append a brief note:
- "User Management: COMPLETE - uses /api/v1/users endpoints"
- "Roles System: COMPLETE - RBAC via role_permissions junction table"

---

## 5. The Vibe Coding Workflow

### Overview Flow

```
┌─────────────────────────────────────────────────┐
│  1. PLANNING                                    │
│     Read feature scope → Break into phases      │
│     → Define API contracts → Update context     │
├─────────────────────────────────────────────────┤
│  2. BACKEND FIRST                               │
│     Database schema → DTOs → Service →          │
│     Controller → Test endpoints                 │
├─────────────────────────────────────────────────┤
│  3. FRONTEND SECOND                             │
│     Types (match DTOs) → API hooks →            │
│     Components → Pages → Test UI                │
├─────────────────────────────────────────────────┤
│  4. INTEGRATION                                 │
│     Wire together → E2E test → Security review  │
├─────────────────────────────────────────────────┤
│  5. COMMIT & DOCUMENT                           │
│     Commit all → Update overallcontext.txt      │
│     → Update contracts.md                       │
└─────────────────────────────────────────────────┘
```

---

## 6. Feature Implementation Process

Using your example: **User Roles & Permissions**

### Step 1: Break Down the Feature

Don't prompt: "Build user roles and permissions"

Instead, ask Claude/Gemini (NOT Cursor yet):

```
I need to implement User Roles & Permissions with these requirements:
[paste requirements]

Break this into 4-6 implementation phases where each phase:
- Is independently testable
- Builds on the previous
- Has clear deliverables (DB, API, UI)

Tech stack: Next.js + Mantine + NestJS + Supabase
```

You'll get something like:
- Phase 1: Database schema (roles, permissions, user_roles tables + RLS)
- Phase 2: Backend role CRUD (entity, DTOs, service, controller)
- Phase 3: Backend permission assignment
- Phase 4: Frontend role management UI
- Phase 5: Integration with auth guards

### Step 2: Define Contracts First

Before coding, document the API contract in docs/contracts.md:

```
## Roles API

GET /api/v1/roles - List all roles (paginated)
POST /api/v1/roles - Create role
PUT /api/v1/roles/:id - Update role
DELETE /api/v1/roles/:id - Delete role
POST /api/v1/roles/:id/permissions - Assign permissions to role

Response format: { data, meta, error }
```

### Step 3: Execute Phase by Phase

For each phase, use this prompt structure:

---

## 7. Prompt Templates

### Planning Prompt (Use Outside Cursor First)

```
FEATURE: [Feature name]
REQUIREMENTS:
[Paste requirements]

Break into implementation phases (4-6) where each is testable.
For each phase specify: Database changes, API endpoints, UI components.
Tech stack: Next.js + Mantine + NestJS + Supabase
```

### Backend Implementation Prompt

```
CONTEXT:
- Project: @overallcontext.txt
- Contracts: @docs/contracts.md
- Patterns: @backend/src/modules/[existing-module]/

TASK: Implement [Phase X] for [Feature]

Deliverables:
1. [Specific file 1]
2. [Specific file 2]
3. [Specific file 3]

CONSTRAINTS:
- Follow NestJS patterns from referenced module
- Use class-validator for DTOs
- Handle errors with NestJS exceptions
- All endpoints require JWT guard

DO NOT:
- Modify files I didn't mention
- Add features not specified
- Skip validation
```

### Frontend Implementation Prompt

```
CONTEXT:
- Project: @overallcontext.txt
- API is ready: [list endpoints]
- Patterns: @frontend/src/components/features/[similar]/

TASK: Build UI for [Feature Phase]

Deliverables:
1. [Component 1]
2. [Component 2]
3. [API hook]

CONSTRAINTS:
- Mantine UI ONLY (no Tailwind, no custom CSS)
- React Query for data fetching
- Handle loading, error, empty states
- Types must match backend DTOs exactly

DO NOT:
- Use any Tailwind classes
- Skip error states
- Create types that don't match API
```

### Bug Fix Prompt

```
ERROR: [Paste exact error]
FILE: @[file-path]
EXPECTED: [What should happen]
ACTUAL: [What's happening]

Fix this specific issue. Don't refactor other code.
```

### Review Prompt

```
Review these files for:
1. Security vulnerabilities
2. Type mismatches
3. Missing error handling
4. Pattern violations

@[file1]
@[file2]

List issues with severity (Critical/High/Medium/Low).
```

---

## 8. Multi-Agent Approach (Manual)

You don't need fancy tooling. Use role-based prompting:

### Architect Agent (Planning)
Start new features with:
```
Act as a Senior Software Architect.
[Planning task]
Don't write code - just the plan.
```

### Backend Agent
```
Act as a Senior NestJS Developer.
[Implementation task with backend context]
```

### Frontend Agent
```
Act as a Senior Next.js + Mantine Developer.
[Implementation task with frontend context]
```

### Review Agent
```
Act as a Security Expert and Code Reviewer.
[Review task]
```

### Handoff Between Agents

When switching contexts or starting new chat:

```
Continuing work on [Feature].
Completed: [list]
Current task: [task]
Key files: @[file1], @[file2]
Project context: @overallcontext.txt
```

---

## 9. Feature Wiring & Continuity

### The Problem
Features don't exist in isolation. User Management connects to Roles, which connects to Permissions, which gates every other feature.

### The Solution: contracts.md + overallcontext.txt

**contracts.md** tracks:
- All API endpoints
- Request/response formats
- Which features use which endpoints

**overallcontext.txt** tracks:
- Completed features
- Key decisions made
- Integration points

### Before Starting a New Feature

```
I'm starting [New Feature].

Current context: @overallcontext.txt
Existing contracts: @docs/contracts.md

This feature needs to integrate with:
- [Existing Feature 1]: [How]
- [Existing Feature 2]: [How]

Review the contracts and tell me what interfaces I need to respect.
```

### After Completing a Feature

Update overallcontext.txt with:
```
## [Feature Name]: COMPLETE
- API: /api/v1/[resource]
- Key files: [list main files]
- Integrates with: [list dependencies]
- Important decisions: [any non-obvious choices]
```

---

## 10. Error Handling: The 3-Strike Rule

**Strike 1**: Paste error, ask for fix
**Strike 2**: Add more context, ask again
**Strike 3**: STOP fixing. Ask this instead:

```
Stop trying to fix directly.

1. List the 5 most likely root causes
2. For each, tell me how to verify it
3. Add diagnostic logs
4. Tell me what output to share

Help me investigate, don't guess.
```

---

## 11. Context Management

### The @ Reference Guide

| Need | Use |
|------|-----|
| Single file | `@file:path/to/file.ts` |
| Similar patterns | `@folder:path/to/similar/` |
| Project scope | `@overallcontext.txt` |
| API contracts | `@docs/contracts.md` |
| Mistakes to avoid | `@mistakes.md` |

### When to Start New Chat

- Switching features
- After ~20 exchanges
- AI starts forgetting patterns
- Switching between FE/BE work
- After completing a milestone

### New Chat Starter

```
Continuing [Feature], [Phase X].
Done: [list]
Current: [task]
Files: [list]
Context: @overallcontext.txt
```

---

## 12. The mistakes.md File

Track AI's repeated errors. Reference it in prompts.

Example entries:
```
## Styling
- ❌ Using Tailwind classes - ALWAYS use Mantine
- ❌ Inline styles for static values

## Types
- ❌ Using `any` - Define proper types
- ❌ Not handling null/undefined

## Architecture
- ❌ Business logic in controllers - Keep in services
- ❌ Calling Supabase from frontend - Go through API

## Recently Added
- [Date]: [New mistake discovered]
```

---

## 13. Security Checklist

Run this review after each feature:

```
Act as a Security Expert.

Review @[controller] and @[service] for:
1. SQL Injection - Parameterized queries?
2. IDOR - Ownership verified?
3. Auth bypass - All endpoints protected?
4. Input validation - All inputs validated?
5. Data exposure - Sensitive fields filtered?

List issues with severity and fixes.
```

---

## 14. Git Workflow

### The Golden Rule
Never be more than 30 minutes from a working state.

### Commands to Live By
```bash
# Before risky AI operation
git add -A && git commit -m "checkpoint: before [change]"

# After working change
git add -A && git commit -m "feat(scope): description"

# When AI breaks things
git checkout -- .

# See what AI changed
git diff
```

### Commit Message Format
```
feat(users): implement role assignment
fix(auth): handle token refresh race condition
refactor(api): extract pagination logic
```

---

## 15. Quick Reference

### Red Flags (Stop & Reassess)
- 🚩 AI suggesting Tailwind classes
- 🚩 Same error after 3 attempts
- 🚩 AI changing files you didn't mention
- 🚩 Types using `any`
- 🚩 Missing error handling
- 🚩 Direct Supabase calls in frontend

### Green Flags (Proceed)
- ✅ Code follows existing patterns
- ✅ Types fully defined
- ✅ Error states handled
- ✅ Matches API contracts
- ✅ Uses Mantine correctly

### Daily Checklist
```
Morning:
□ git pull
□ Review yesterday's work
□ Plan today's phases

During:
□ One phase at a time
□ Commit every 30 min
□ New chat for new context

End:
□ All changes committed
□ Update mistakes.md if needed
□ Update overallcontext.txt if feature done
```

---

## 16. Your Workflow Summary

```
1. Read feature from scope doc
2. Break into phases (outside Cursor)
3. Define API contracts
4. For each phase:
   a. Backend first (schema → service → controller)
   b. Frontend second (types → hooks → components)
   c. Test integration
   d. Commit
5. Update overallcontext.txt
6. Move to next feature
```

**The key insight**: Structure beats improvisation. A well-organized project with good context files will outperform "just vibe it" every single time.

Happy vibing! 🎯

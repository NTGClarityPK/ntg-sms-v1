## Compact Lessons - Common Mistakes (Use as Rules)

> This is a compact, prescriptive version of `mistakes.md`. Treat every bullet as a rule or checklist item during implementation and reviews.

### 1. TypeScript Strict Mode & Error Handling
- **Catch blocks**: Always treat `error` as `unknown`. Derive messages with `error instanceof Error ? error.message : 'Unknown error'`.
- **Union to single type**: Never assign `string | string[]` directly to `string`. Handle arrays explicitly (e.g. `Array.isArray(value) ? value.join(', ') : value`).
- **DTO properties**: In strict mode, DTO fields must either be initialised or use definite assignment (`id!: string`) when using `Object.assign`.
- **Library types**: Re‑use library‑provided prop types (e.g. `IconProps`) instead of custom interfaces that narrow them.
- **Axios config**: Type configs with `AxiosRequestConfig`, never `unknown` or `any`.

### 2. Next.js App Router & Layout Consistency
- **Route groups**: Do not rely on `(group)/page.tsx` for root routes. Use explicit paths like `app/dashboard/page.tsx`.
- **Dashboard layout**: Keep dashboard pages visually consistent – same `Container`, spacing, and `Title`/`Text` patterns.

### 3. Authentication, Cookies & Session
- **Auth source of truth**: Use Supabase session as the single truth for auth; do not block UI on `/auth/me` API failures to avoid redirect loops.
- **Cookie typing**: Define explicit `Cookie` and `CookieOptions` interfaces; never leave cookie handlers implicitly `any`.

### 4. React Query & State Sync
- **API response shape**: Always align generics with actual backend response. If backend sends `{ data: T[], meta }`, use `apiClient.get<T[]>()` and treat the whole response as `ApiResponse<T[]>`.
- **Local vs server state**: Keep local derived state (like permission matrices) in sync via simple `useEffect` that re‑maps whenever props change; avoid over‑complicated comparison logic.
- **Loading vs empty**: Distinguish “still loading” (`isLoading || !data`) from “loaded but empty” (`data && data.data.length === 0`) to prevent “No records” flashes.
- **Hook return types**: Explicitly type values returned from custom hooks (e.g. `user: User | undefined`) so consumers get correct types.
- **TanStack Query v5**: Do not use `onSuccess` / `onError` on `useQuery`. Handle side‑effects in components or `useEffect`. Reserve those callbacks for `useMutation`.

### 5. API Response Structure & Nested Data - CRITICAL
- **Standard shape**: Treat the HTTP JSON body as `ApiResponse<T>` = `{ data: T; meta? }`. For lists, `T` is usually `TItem[]`.
- **Hook return pattern - NEVER BREAK THIS:**
  - **Paginated lists** (`GET /resource` with `meta`): Hook returns `response` (full object), component accesses `query.data?.data`
  - **Single items** (`GET /resource/:id`): Hook returns `response.data`, component accesses `query.data`
  - **Mutations**: Hook returns `response.data`, component uses `mutation.data` directly
- **NEVER use `response.data.data` in hooks** - This is almost always wrong! The pattern depends on endpoint type.
- **Hook/Component contract**: Before writing any hook, check an existing similar hook in the codebase and follow its pattern exactly. Ensure hook return matches component expectations.

### 6. NestJS Modules, Routes & Server Behaviour
- **Graceful shutdown**: Implement shutdown handlers (`SIGINT`, `SIGTERM`, `uncaughtException`, `unhandledRejection`) and a timeout to avoid port conflicts in watch mode.
- **Kill existing ports**: Use a pre‑start script to clear dev ports before `start:dev`.
- **Providers**: Whenever a service injects `SupabaseConfig` (or any dependency), add it to the module `providers` array. Never rely on "global magic".
- **Service exports**: When a service needs to be injected in other modules, add it to the module's `exports` array. Just importing the module is not enough - the service must be explicitly exported for cross-module dependency injection.
- **Route ordering**: Always put specific routes (e.g. `@Get('by-tenant')`) before parameterised routes (`@Get(':id')`) to avoid accidental matches.
- **Controller base paths**: Do not share base paths for controllers that have overlapping patterns (`/settings` + `/:key`). Give them distinct base paths.

### 7. Supabase & Database Access
- **Relationship shortcuts**: Do not assume Supabase relationship syntax will work without explicit FKs; for complex joins fetch in multiple queries and combine in code.
- **Partial selects**: When selecting only some columns, use inline types that match the selected fields instead of full row types that require extra properties.
- **Column existence**: Only filter/search by columns that exist in that table. For cross‑table filters (e.g. `email` in `auth.users`), fetch separately and merge.
- **Admin API robustness**: For `supabase.auth.admin.listUsers()`, add strong error handling and a fallback (`getUserById`) so critical fields like email are never silently empty.

### 8. Frontend Data Display & UX
- **List + meta**: The backend often already returns `{ data: T[], meta }`; the interceptor passes it through. Do not wrap again or expect extra nesting.
- **Empty vs error**: For list pages, render in this order: loading → error → empty → table. Never show empty states when `data` is still `undefined`.
- **Schedule/derived views**: Hooks must return full responses when components access `.data`. Keep hook data shape and component access perfectly aligned.

### 9. Validation, Limits & Guards
- **Query param transforms**: When using NestJS `ValidationPipe` with `enableImplicitConversion`, DTO transforms must support already‑converted types (e.g. booleans for `isRead`) as well as strings.
- **Unread counts**: Do not derive unread counts from page‑sized lists. Prefer backend totals (`meta.total`) and compute `unread = total − read`, or derive unread/read segments client‑side from a single authoritative list.
- **Pagination limits - CRITICAL**: 
  - **Backend default max is 100** (`@Max(100)` in `BasePaginationDto`)
  - **NEVER use arbitrary large numbers** like `limit: 1000` or `limit: 9999` - this causes `HTTP 400: limit must not be greater than 100` errors
  - **Before setting any limit**, check existing hooks in the codebase to see what they use
  - **If you need "all items"**, use `limit: 100` (the max) or implement proper pagination
  - **Common mistake**: Using `limit: 1000` in dropdowns/forms causes validation errors
  - **Rule**: When in doubt, use `limit: 100` or check an existing similar hook first
- **Context‑aware guards**: Before calling guarded endpoints (e.g. branch‑guarded routes), ensure required context exists (like `currentBranch`) and gate React Query with `enabled`.

### 10. Mantine v7 & Theming
- **Component APIs**: Use Mantine v7‑compatible components only. Replace removed components (e.g. `TimeInput`) with supported alternatives (e.g. `TextInput` with `type="time"`). Do not use deprecated props like `Stepper.breakpoint`.
- **Imports**: Every JSX Mantine component must be imported explicitly (`Group`, `Title`, `Card`, etc.). Missing imports are a recurring cause of runtime errors.
- **Theme hook**: Use the actual properties returned by `useThemeColors()` (`success`, `error`, `warning`, `info`). If you need different names, alias them in destructuring.
- **Variable shadowing**: Avoid naming collisions such as `error` for both a colour and an error object. Use aliases (`errorColor`, `successColor`) when destructuring.

### 11. Forms, Filters & Editing Flows
- **Edit forms**: `useForm` `initialValues` are used only once on mount. For edit flows, sync form values via `useEffect` whenever the entity prop changes, and reset on `null`.
- **Multi‑filters**: Where users need multi‑selection (roles, classes, sections, etc.), use `MultiSelect` and backend DTOs that accept arrays with appropriate validation and `.in()` filters.
- **Branch‑dependent features**: For any feature that assumes a current branch, check branch availability first and show a clear UI message if absent instead of allowing API failures.

### 12. Notifications System Specifics
- **`isRead` filtering**: Ensure DTO transform converts both boolean and string query params (`true`/`'true'`, `false`/`'false'`) so filters are always applied.
- **Tabs semantics**: Align tab labels with actual filters (e.g. tab “Read” should use `isRead=true`). Do not rely on naming that contradicts behaviour.
- **React Query invalidation**: When mutating notifications (mark read / mark all read), invalidate all relevant keys, including list and unread‑count queries.

### 13. Navigation & UI Completeness
- **Sidebar and navigation**: Whenever you add a new page/route, update the navigation (e.g. sidebar) so the feature is discoverable.
- **Backend–frontend parity**: Do not mark a feature “done” if only the backend exists. Ensure hooks, UI components, and layout integration are all present and visually verified.
- **Visual verification**: For every feature, manually confirm: “Can I see it? Can I interact with it? Does it work end‑to‑end?”

### 14. Null Safety & Defensive Coding
- **Optional arrays**: Treat possibly undefined arrays defensively using `?? []` before accessing `.length` or other methods.
- **Error visibility**: Where appropriate, surface meaningful feedback (notifications, alerts) instead of silent failures, but do not rely on `console.log` in production code.

### 15. Frontend Page Layout Consistency
- **Never use `Container` for main pages**: Application pages (lists, CRUD, dashboards) need full-width layouts, not centered containers. `Container` is for content articles only.
- **Always use `<Title order={1}>`** for main page headings - not `order={2}`. H1 gives proper visual hierarchy.
- **Follow `page-title-bar` pattern**: Use `<div className="page-title-bar">` with full-width `Group` for consistent headers across all pages.
- **Review existing pages FIRST**: Before implementing any new page, check `/users/page.tsx` or `/leaves/page.tsx` for the established layout pattern and follow it exactly.
- **Layout rules**: Full-width header with H1 title → Content area with controlled padding using CSS variables → No Container wrappers on main pages.

### 16. Meta‑Lessons & Workflow
- **Fix root causes**: When you see many similar type errors, fix the root utilities/hooks rather than patching each usage.
- **Version awareness**: Always confirm library versions (Mantine, TanStack Query, etc.) and follow the correct, version‑specific patterns.
- **Checklists**: Use simple checklists per feature:
  - **Backend**: DTOs ✓ validation ✓ service ✓ controller ✓ module providers ✓
  - **Frontend**: hook ✓ types ✓ UI components ✓ navigation ✓ loading/empty/error states ✓ **layout consistency** ✓
  - **Integration**: branch/auth context ✓ correct headers ✓ response shape aligned ✓ manual test ✓

### 17. Mutation error messages – show backend message, not Axios generic
- **Why “Request failed” appears**: When the API returns 4xx/5xx, Axios rejects with an **AxiosError**. Its **`.message`** is set by Axios (e.g. `"Request failed with status code 400"`), not the backend body. Using `error instanceof Error ? error.message` in mutation **onError** therefore shows that generic text to the user.
- **Where the real message is**: The backend (e.g. Nest `HttpExceptionFilter`) sends the actual message in the **response body**, e.g. `{ error: { code, message } }` or `{ message }`. That lives on **`error.response.data`**, not on `error.message`.
- **Rule**: In **useMutation** **onError**, never rely only on `error.message` for user-facing notifications. Read the body first: e.g. `(error as any).response?.data?.error?.message ?? (error as any).response?.data?.message`, then fall back to `Error.message`, then a fallback string. Prefer a small helper (e.g. `getApiErrorMessage(error, fallback)`) and use it in all mutation **onError** handlers so users see the backend message (e.g. “An early departure request for this student on the same date and time already exists.”) instead of “Request failed with status code 400”.


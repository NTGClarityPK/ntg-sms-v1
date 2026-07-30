# Common Mistakes - DO NOT REPEAT

## TypeScript Strict Mode

### Catch Block Error Handling
- ❌ Accessing `.message` directly on `catch (error)` → Error: 'error' is of type 'unknown'
- ✅ Use type guard: `error instanceof Error ? error.message : 'Unknown error'`

**Example:**
```typescript
// ❌ Wrong
catch (error) {
  console.log(error.message); // TypeScript error!
}

// ✅ Correct
catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  console.log(errorMessage);
}
```

### Type Assignments
- ❌ Assigning `string | string[]` to `string` variable → Type error
- ✅ Handle array case explicitly: `Array.isArray(value) ? value.join(', ') : value`

**Example:**
```typescript
// ❌ Wrong
let message: string = exceptionResponse.message; // May be string[]

// ✅ Correct
const responseMessage = exceptionResponse.message;
message = Array.isArray(responseMessage) 
  ? responseMessage.join(', ')
  : responseMessage || message;
```

### DTO Property Initialization
- ❌ Properties without initializers in strict mode → Property 'x' has no initializer
- ✅ Use definite assignment assertion (`!`) when constructor guarantees initialization via `Object.assign()`

**Example:**
```typescript
// ❌ Wrong
export class UserDto {
  id: string; // Error: no initializer
}

// ✅ Correct
export class UserDto {
  id!: string; // ! = "I guarantee this is assigned in constructor"
  
  constructor(partial: Partial<UserDto>) {
    Object.assign(this, partial);
  }
}
```

### Icon Component Type Mismatch
- ❌ Using custom interface `{ size?: number }` for third-party icons → Type mismatch with actual icon props
- ✅ Import and use the actual prop type from the icon library (e.g., `IconProps` from `@tabler/icons-react`)

**Why:** Tabler icons accept `size?: string | number`, but custom interface only allows `number`, causing type incompatibility.

**Example:**
```typescript
// ❌ Wrong
interface NavItem {
  icon: React.ComponentType<{ size?: number }>; // Too restrictive!
}
import { IconHome } from '@tabler/icons-react'; // IconHome accepts string | number

// ✅ Correct
import { IconHome, type IconProps } from '@tabler/icons-react';
interface NavItem {
  icon: React.ComponentType<IconProps>; // Matches actual icon props
}
```

### UUID user-reference columns (created_by, updated_by, marked_by)
- ❌ Storing **username** or **email** in columns that are type **UUID** (e.g. `created_by`, `updated_by`, `marked_by` that reference `auth.users(id)`) → `invalid input syntax for type uuid: "admin"`
- ✅ Use **user ID** (UUID) from `user.id` for any column that is UUID and references the user. Use username/email only for **text** columns or for **audit logging** (AuditLogService expects `userEmail` for the audit log entry, which is correct).

**Tables with UUID user columns (must use `user.id` in controller → service):**
- `assessments`: `created_by`, `updated_by` (UUID)
- `events`: `created_by` (UUID)
- `attendance`: `marked_by` (UUID)

**All other tables** that have `created_by`/`updated_by` as **text** can continue to use username (e.g. from `extractUsernameFromEmail(userEmail)`).

**Example:**
```typescript
// ❌ Wrong – assessments.created_by is UUID
const created = await this.assessmentsService.createAssessment(body, branchId, tenantId, user.email, user.email);

// ✅ Correct
const created = await this.assessmentsService.createAssessment(body, branchId, tenantId, user.id, user.email);
```

### Axios Config Type Mismatch
- ❌ Using `unknown` for Axios config parameters → Error: 'unknown' is not assignable to 'AxiosRequestConfig'
- ✅ Import and use `AxiosRequestConfig` from axios for config parameters

**Why:** Axios methods expect `AxiosRequestConfig` type, but `unknown` is too generic and causes type errors.

**Example:**
```typescript
// ❌ Wrong
async get<T>(url: string, config?: unknown): Promise<ApiResponse<T>> {
  const response = await this.client.get(url, config); // Type error!
}

// ✅ Correct
import { AxiosRequestConfig } from 'axios';
async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
  const response = await this.client.get(url, config); // Works!
}
```

## Next.js App Router

### Route Groups Not Recognizing Root Pages
- ❌ Placing `page.tsx` directly in route group `(dashboard)/page.tsx` → Route not recognized, returns 404
- ✅ Use explicit route structure: `app/dashboard/page.tsx` instead of `app/(dashboard)/page.tsx`

**Why:** Next.js route groups `(folder)` are for layout organization and don't always work reliably with root `page.tsx` at the same level. Explicit routes are more reliable.

**Example:**
```typescript
// ❌ Wrong - Route group with root page
app/
  (dashboard)/
    page.tsx          // May not be recognized as /dashboard
    layout.tsx
    students/
      page.tsx        // Works as /students (not /dashboard/students)

// ✅ Correct - Explicit route structure
app/
  dashboard/
    page.tsx          // Works as /dashboard
    layout.tsx
    students/
      page.tsx        // Works as /dashboard/students
```

### Dashboard Page Looked \"Invisible\" While Other Pages Rendered
- ❌ `/dashboard` page had different layout wrapper/spacing than sibling pages (e.g., used a different container component/props), causing the title/description to appear missing under the global theme/layout CSS.
- ✅ Keep all dashboard pages consistent: same wrapper (`Container size=\"lg\" py=\"xl\"`), same `Title`/`Text` pattern.

**Why:** Global layout + injected theme CSS makes subtle wrapper differences show up as big visual issues (misalignment, overlap, or low contrast), even if the React tree renders fine.

**Fix Pattern:**
```tsx
import { Container, Title, Text } from '@mantine/core';

export default function Page() {
  return (
    <Container size="lg" py="xl">
      <Title order={1} mb="md">Page Title</Title>
      <Text c="dimmed">Description</Text>
    </Container>
  );
}
```

## Authentication & Session Management

### AuthGuard Checking Both Session and API Call
- ❌ Checking both Supabase session AND API call (`/api/v1/auth/me`) → Infinite redirect loop if API fails
- ✅ Use Supabase session as single source of truth, don't block on API call failures

**Why:** If the API call fails (401, network error, etc.), `isAuthenticated` becomes false even though the user has a valid Supabase session, causing redirect loops.

**Example:**
```typescript
// ❌ Wrong - Blocks on API call
const { user, isLoading, isAuthenticated } = useAuth(); // API call
if (!isAuthenticated) router.push('/login'); // Redirects even with valid session

// ✅ Correct - Check Supabase session only
const session = await getSession(); // Direct Supabase check
if (!session?.access_token) router.push('/login');
```

### Supabase SSR Cookie Handler Type Error
- ❌ Missing type annotations for `setAll` cookie handler → Error: Parameter implicitly has 'any' type
- ✅ Define proper interfaces for `Cookie` and `CookieOptions` types

**Why:** TypeScript strict mode requires explicit types. The `@supabase/ssr` cookie handlers need proper type definitions.

**Example:**
```typescript
// ❌ Wrong
setAll(cookiesToSet) { // Error: implicitly has 'any' type
  cookiesToSet.forEach(({ name, value, options }) => { ... });
}

// ✅ Correct
interface CookieOptions {
  maxAge?: number;
  domain?: string;
  path?: string;
  sameSite?: 'strict' | 'lax' | 'none';
  secure?: boolean;
  httpOnly?: boolean;
}

interface Cookie {
  name: string;
  value: string;
  options?: CookieOptions;
}

setAll(cookiesToSet: Cookie[]) {
  cookiesToSet.forEach(({ name, value, options }) => { ... });
}
```

## React Query & State Management

### Permission Matrix UI Not Reflecting Saved Database Values
- ❌ **Issue**: User saved permissions (set to "edit" for all features), database was updated correctly, but UI showed "none" after page refresh
- 🔍 **Cause**: 
  1. API response type mismatch: `apiClient.get<{ data: PermissionMatrix[] }>()` expected nested structure, but backend returns `{ data: PermissionMatrix[] }` directly
  2. `useEffect` dependency on `permissions` array wasn't properly triggering state sync due to reference equality issues
  3. Local state wasn't being updated when permissions prop changed after refetch
- ✅ **Solution**: 
  1. Fixed API response type: Changed to `apiClient.get<PermissionMatrix[]>()` to match actual response structure
  2. Simplified `useEffect` to always sync `localPermissions` when `permissions` prop changes (removed complex comparison logic)
  3. Ensured `usePermissions` hook correctly extracts array from `response.data`

**Why:** React Query returns data in a specific structure. If the TypeScript type doesn't match the actual API response, data extraction fails silently. Also, `useEffect` with array dependencies can miss updates if the reference doesn't change.

**Example:**
```typescript
// ❌ Wrong - Type mismatch
const response = await apiClient.get<{ data: PermissionMatrix[] }>('/api/v1/permissions');
return response.data; // Returns { data: PermissionMatrix[] }, not PermissionMatrix[]
const permissions = data?.data || []; // Tries to access nested data that doesn't exist

// ✅ Correct - Match actual API response structure
const response = await apiClient.get<PermissionMatrix[]>('/api/v1/permissions');
return response.data || []; // response.data is PermissionMatrix[]
const permissions = data || [];

// ❌ Wrong - Complex useEffect that might miss updates
useEffect(() => {
  // Complex comparison logic that might prevent updates
  if (newSerialized !== currentSerialized) {
    setLocalPermissions(newMap);
  }
}, [permissions]);

// ✅ Correct - Always sync when permissions change
useEffect(() => {
  const newMap = new Map<string, Permission>();
  permissions.forEach((p) => {
    const key = `${p.roleId}-${p.featureId}`;
    newMap.set(key, p.permission);
  });
  setLocalPermissions(newMap);
  setHasChanges(false);
}, [permissions]);
```

**Lesson:** Always verify API response structure matches TypeScript types. Use simple, direct state synchronization in `useEffect` rather than complex comparison logic that might prevent necessary updates.

## NestJS Development Server

### Backend Port Conflict on File Changes (Watch Mode)
- ❌ **Issue**: Backend crashed with `EADDRINUSE: address already in use :::3001` error whenever Cursor made code changes, requiring manual port killing and server restart
- 🔍 **Cause**: 
  1. NestJS watch mode doesn't gracefully shutdown the old process before starting a new one
  2. No graceful shutdown handlers to close the server properly on termination signals
  3. No pre-start script to kill existing processes on the port
- ✅ **Solution**: 
  1. Added graceful shutdown handlers in `main.ts` for `SIGTERM`, `SIGINT`, `uncaughtException`, and `unhandledRejection`
  2. Created `scripts/kill-port.js` to kill processes on port 3001 before starting dev server
  3. Added `prestart:dev` npm script to automatically run kill-port before `start:dev`
  4. Added timeout to graceful shutdown to prevent hanging (5 seconds)
  5. Improved error handling for port conflicts with helpful error messages

**Why:** Development servers in watch mode need to handle process restarts gracefully. Without proper shutdown handling, the old process can remain bound to the port, preventing the new process from starting.

**Example:**
```typescript
// ✅ Correct - Add graceful shutdown in main.ts
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  try {
    await Promise.race([
      app.close(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Shutdown timeout')), 5000),
      ),
    ]);
    console.log('Application closed successfully.');
    process.exit(0);
  } catch (error: any) {
    if (error.message === 'Shutdown timeout') {
      console.warn('Shutdown timeout reached, forcing exit...');
    }
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

```json
// ✅ Correct - Add pre-start script in package.json
{
  "scripts": {
    "prestart:dev": "node scripts/kill-port.js",
    "start:dev": "nest start --watch --preserveWatchOutput",
    "kill:port": "node scripts/kill-port.js"
  }
}
```

**Lesson:** Always implement graceful shutdown handlers for development servers, especially when using watch mode. Add pre-start scripts to ensure clean port availability. This prevents the need for manual intervention during development.

### Missing Navigation Links for Implemented Features
- ❌ **Issue**: Users page was fully implemented (backend + frontend) but not accessible because it was missing from the Sidebar navigation menu
- 🔍 **Cause**: When implementing features, the navigation menu (`Sidebar.tsx`) was not updated to include links to new pages, even though the pages themselves were created
- ✅ **Solution**: Added "Users" link to the Sidebar navigation items array
- **Lesson**: When implementing a new feature with a page/route, ALWAYS update the navigation menu (`Sidebar.tsx` or equivalent) to include the link. Create a checklist: "Page created ✓, Components created ✓, API endpoints created ✓, Navigation link added ✓"

### Missing Mantine Component Imports
- ❌ **Issue**: `ReferenceError: Group is not defined` (or similar for other Mantine components) when using components in JSX without importing them
- 🔍 **Cause**: Component is used in JSX (e.g., `<Group>`) but not included in the import statement from `@mantine/core`
- ✅ **Solution**: Add the missing component to the import statement: `import { ..., Group } from '@mantine/core'`
- **Lesson**: When using any Mantine component in JSX, ensure it's imported. Common components that are often forgotten: `Group`, `Text`, `Title`, `Card`, `Paper`, `Badge`, `Alert`. Before committing, verify all used components are in the import statement. Use TypeScript/ESLint to catch missing imports automatically.

### Supabase Relationship Syntax Not Working for Cross-Table Joins
- ❌ **Issue**: `Could not find a relationship between 'profiles' and 'user_roles' in the schema cache` error when trying to use Supabase's relationship syntax (e.g., `user_roles!inner(...)`)
- 🔍 **Cause**: Supabase's relationship syntax only works when there's a recognized foreign key relationship in the schema cache. If tables are related indirectly (e.g., `profiles.id` → `auth.users.id` → `user_roles.user_id`), or if the FK relationship isn't properly recognized, the relationship syntax fails
- ✅ **Solution**: Fetch related data in separate queries and combine them in code:
  1. Query the main table (e.g., `profiles`)
  2. Extract IDs from results
  3. Query related tables separately (e.g., `user_roles`, `roles`)
  4. Combine data using Maps for efficient lookups
- **Lesson**: Don't rely on Supabase's relationship syntax for complex joins. Always fetch related data separately and combine in application code. This is more reliable and gives you better control over the query logic. The same pattern applies to any cross-table relationships that don't have direct foreign keys.

### TypeScript Type Mismatch When Using Partial Type Definitions
- ❌ **Issue**: TypeScript errors like `Property 'assigned_at' is missing in type '{ user_id: any; role_id: any; branch_id: any; }' but required in type 'UserRoleRow'` when using a full type definition for partial query results
- 🔍 **Cause**: When querying Supabase with `.select('user_id, role_id, branch_id')`, the returned data only contains those three fields, but the `UserRoleRow` type requires all fields including `assigned_at`. TypeScript correctly flags this mismatch
- ✅ **Solution**: Use inline types that match exactly what you're selecting from the database, rather than using a full type definition:
  - Instead of: `(ur: UserRoleRow) => ur.role_id`
  - Use: `(ur: { user_id: string; role_id: string; branch_id: string }) => ur.role_id`
- **Lesson**: When working with partial database queries, use inline types that match the selected fields rather than full type definitions. This ensures type safety matches the actual data structure. Only use full type definitions (like `UserRoleRow`) when you're selecting all fields or when the type explicitly marks fields as optional.

### Students Not Visible on Frontend `/students` Page
- ❌ **Issue**: Students list was not displaying on the frontend `/students` page, even though the API was returning data correctly
- 🔍 **Cause**: 
  1. Response structure mismatch between backend and frontend expectations
  2. Backend service returns `{ data: StudentDto[], meta: {...} }` which is already in the correct `ApiResponse<T>` format
  3. ResponseInterceptor passes it through as-is (since it already has `data` property)
  4. Frontend hook was incorrectly trying to access nested `response.data.data` instead of `response.data`
  5. TypeScript type parameter in `apiClient.get<T>()` was set incorrectly, causing confusion about the response structure
- ✅ **Solution**: 
  1. Fixed `useStudents` hook to use `apiClient.get<Student[]>()` instead of `apiClient.get<{ data: Student[], meta: {...} }>()`
  2. Return `response` directly from the hook (which is `ApiResponse<Student[]>` = `{ data: Student[], meta: {...} }`)
  3. In the component, access `studentsQuery.data.data` for the array and `studentsQuery.data.meta` for pagination
  4. Added proper empty state handling in `StudentTable` component

**Why:** The backend `ResponseInterceptor` checks if the response already has a `data` property. If it does, it returns it as-is. Since the service returns `{ data: StudentDto[], meta: {...} }`, the interceptor doesn't wrap it again. The HTTP response is `{ data: StudentDto[], meta: {...} }`, which matches the `ApiResponse<T>` structure. When using `apiClient.get<Student[]>()`, the response is `ApiResponse<Student[]>` = `{ data: Student[], meta: {...} }`, so `response.data` is the array and `response.meta` is the meta object.

**Example:**
```typescript
// ❌ Wrong - Incorrect type parameter and nested access
const response = await apiClient.get<{
  data: Student[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}>('/api/v1/students');
return response.data; // This would be { data: Student[], meta: {...} }
// Then trying to access response.data.data in component - wrong!

// ✅ Correct - Use array type directly
const response = await apiClient.get<Student[]>('/api/v1/students');
// response is ApiResponse<Student[]> = { data: Student[], meta: {...} }
return response;
// In component: studentsQuery.data.data (array) and studentsQuery.data.meta (pagination)
```

**Flow Understanding:**
1. Backend service returns: `{ data: StudentDto[], meta: {...} }`
2. Controller returns it directly
3. ResponseInterceptor sees `'data' in data` → returns as-is: `{ data: StudentDto[], meta: {...} }`
4. HTTP response body: `{ data: StudentDto[], meta: {...} }`
5. Axios `response.data`: `{ data: StudentDto[], meta: {...} }`
6. `apiClient.get<Student[]>()` returns: `ApiResponse<Student[]>` = `{ data: Student[], meta: {...} }`
7. Hook returns: `response` (which is `{ data: Student[], meta: {...} }`)
8. Component accesses: `studentsQuery.data.data` (array) and `studentsQuery.data.meta` (pagination)

**Lesson:** When the backend service already returns `{ data: T[], meta: {...} }`, the ResponseInterceptor passes it through unchanged. Use `apiClient.get<T[]>()` (not `apiClient.get<{ data: T[], meta: {...} }>()`) to get `ApiResponse<T[]>` = `{ data: T[], meta: {...} }`. Always trace the response flow: Service → Controller → Interceptor → HTTP → Axios → apiClient → Hook → Component.

### Database Query Searching Non-Existent Columns
- ❌ **Issue**: Users list API returns empty results even though users exist in the database, or query fails silently
- 🔍 **Cause**: Query attempts to search/filter by columns that don't exist in the queried table. For example, trying to search by `email` in the `profiles` table using `.or('full_name.ilike.%search%,email.ilike.%search%')`, but `email` column doesn't exist in `profiles` (it exists in `auth.users` table)
- ✅ **Solution**: 
  1. Only search by columns that exist in the queried table (e.g., `full_name` in `profiles`)
  2. For columns in other tables (like `email` in `auth.users`), fetch the related data separately and filter client-side after fetching
  3. Use separate queries for data in different tables, then combine and filter in application code
- **Lesson**: Always verify that all columns referenced in Supabase queries actually exist in the target table. Check the table schema before writing queries. If you need to search across multiple tables, fetch data separately and filter client-side. Never assume a column exists - check the database schema or migration files first.

### Edit Forms Not Pre-Populated and Single Filter Limitations
- ❌ **Issue**: When implementing edit functionality for entities (users, students, etc.), the edit form opens with empty fields instead of pre-populating with existing data. Also, filter dropdowns only support single selection, limiting users' ability to filter by multiple values simultaneously.
- 🔍 **Cause**: 
  1. Form components use `initialValues` in `useForm` hook, but these values are only set once when the component mounts. When the `user`/`student` prop changes (e.g., when opening edit modal), the form doesn't reset with new values.
  2. Filter dropdowns use `Select` component (single selection) instead of `MultiSelect` component (multiple selection).
  3. Backend DTOs and services only accept single filter values (e.g., `role?: string`) instead of arrays (e.g., `roles?: string[]`).
- ✅ **Solution**: 
  1. **Edit Form Pre-Population**: Add a `useEffect` hook that watches the entity prop (e.g., `user`, `student`) and calls `form.setValues()` when it changes. Reset form when prop is null (for create mode).
  2. **Multiple Filters**: 
     - Change `Select` to `MultiSelect` component in the UI
     - Update state from `string | undefined` to `string[]`
     - Update backend DTO to accept arrays with proper validation: `@IsArray()`, `@IsUUID(undefined, { each: true })`, and `@Transform` decorator to handle both single values and arrays
     - Update backend service to use `.in('field', array)` instead of `.eq('field', value)`
     - Update frontend hooks to send multiple values as query parameters
     - Maintain backward compatibility with single filter parameter
- **Lesson**: When implementing CRUD forms, always ensure edit forms pre-populate with existing data using `useEffect` to sync form state with prop changes. When implementing filters, consider whether users might want to filter by multiple values simultaneously. Use `MultiSelect` for filters that benefit from multiple selections (roles, classes, sections, etc.). Always implement both frontend (UI state) and backend (DTO validation, service logic) changes together. Create a checklist when implementing similar features across multiple screens: "Edit form pre-population ✓, Multiple filters support ✓, Backend DTO updated ✓, Service logic updated ✓".

### Missing UI Components Despite Backend Implementation
- ❌ **Issue**: Backend API endpoints and data structures are implemented (e.g., branch selection endpoints, user data includes branches), but the corresponding UI components are missing, making the feature unusable from the frontend
- 🔍 **Cause**: 
  1. Implementation focused on backend API endpoints and data flow, but forgot to create the frontend UI components
  2. Plan documents mention UI components (e.g., "BranchSwitcher.tsx should be integrated into Header.tsx"), but these were not implemented
  3. No visual verification that UI components exist after backend implementation
  4. Assumed that if backend works, frontend will automatically have UI (false assumption)
- ✅ **Solution**: 
  1. **Always create UI components in parallel with backend**: When implementing a feature, create both backend endpoints AND frontend UI components together
  2. **Reference plan documents during implementation**: Check the plan file to ensure ALL mentioned components are created (backend + frontend)
  3. **Visual verification checklist**: After implementing a feature, manually verify:
     - Can I see the UI element? (e.g., branch switcher in header)
     - Can I interact with it? (e.g., click to switch branches)
     - Does it work end-to-end? (e.g., switching branch updates data)
  4. **Component inventory**: Before marking a feature as "completed", verify all components mentioned in the plan exist:
     - Backend endpoints ✓
     - Frontend hooks ✓
     - Frontend UI components ✓
     - Integration into layouts ✓
- **Lesson**: Backend implementation alone is not enough - users need UI to interact with features. Always implement backend AND frontend together. When following a plan, check off each component (backend service, controller, frontend hook, frontend component, layout integration) as you implement it. Before marking a feature complete, do a visual walkthrough: "Can I see it? Can I click it? Does it work?" If the plan mentions a UI component (like "BranchSwitcher.tsx"), it MUST exist in the codebase. Create a feature completion checklist: "Backend API ✓, Frontend Hook ✓, UI Component ✓, Integration ✓, Manual Test ✓".

### CORS Error Blocking Specific Endpoints Despite Configuration
- ❌ **Issue**: CORS error blocking `/api/v1/auth/me` endpoint even though CORS was configured for `http://localhost:3000` and other API endpoints appeared to be working fine
- 🔍 **Cause**: 
  1. CORS configuration was too restrictive - it only allowed the exact origin `http://localhost:3000` as a string, not using a function to handle dynamic origins
  2. Browser preflight (OPTIONS) requests might have been failing silently for some endpoints but not others, depending on request complexity (headers, methods)
  3. The `/auth/me` endpoint is typically the first API call made after login, so it's the first to hit CORS issues
  4. Other endpoints might have been cached or not yet called, giving the false impression they were working
  5. Missing `X-Branch-Id` header in `allowedHeaders` list, which could cause preflight failures for requests that include this header
  6. CORS errors can be inconsistent - some requests might succeed if they don't trigger preflight, while others fail
- ✅ **Solution**: 
  1. Changed CORS configuration to use a function-based origin check that allows any localhost port for development:
     ```typescript
     origin: (origin, callback) => {
       if (!origin) return callback(null, true);
       if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
         return callback(null, true);
       }
       if (origin === frontendUrl) {
         return callback(null, true);
       }
       callback(new Error('Not allowed by CORS'));
     }
     ```
  2. Added `X-Branch-Id` to `allowedHeaders` array
  3. Added `exposedHeaders` configuration for better compatibility
  4. Added logging to verify CORS configuration is active
- **Lesson**: CORS configuration must be flexible for development environments. Use function-based origin checking instead of static strings to allow localhost on any port. Always include all custom headers (like `X-Branch-Id`) in the `allowedHeaders` list. CORS errors can be misleading - if one endpoint fails, check if it's the first request (which triggers preflight) or if it includes custom headers. Don't assume other endpoints are working just because you haven't tested them yet. When debugging CORS issues, check the Network tab for OPTIONS (preflight) requests and their responses. Always test the first API call after authentication, as it's most likely to expose CORS issues. For development, allow all localhost origins; for production, use strict origin matching.

### Missing SupabaseConfig Provider in NestJS Modules
- ❌ **Issue**: NestJS dependency injection error: `Nest can't resolve dependencies of the ClassSectionsService (?, AcademicYearsService). Please make sure that the argument SupabaseConfig at index [0] is available in the ClassSectionsModule context.` Similar error for `TeacherAssignmentsService`.
- 🔍 **Cause**: 
  1. When creating new NestJS modules that use `SupabaseConfig` in their services, the `SupabaseConfig` provider was not added to the module's `providers` array
  2. NestJS dependency injection requires all dependencies to be explicitly provided in the module context
  3. Even though `SupabaseConfig` is used in the service constructor, it must be declared as a provider in the module for NestJS to inject it
- ✅ **Solution**: 
  1. Import `SupabaseConfig` from `'../../common/config/supabase.config'` in the module file
  2. Add `SupabaseConfig` to the `providers` array in the `@Module` decorator
  3. Follow the same pattern used in other modules like `AcademicYearsModule` and `StudentsModule`
- **Lesson**: When creating new NestJS modules that inject `SupabaseConfig` (or any other service/provider) in their services, ALWAYS add that provider to the module's `providers` array. NestJS dependency injection requires explicit provider declarations. Before marking a module as complete, verify all injected dependencies are listed in the `providers` array. Check existing modules (like `AcademicYearsModule`, `StudentsModule`, `StaffModule`) as reference for the correct pattern. Create a checklist when creating new modules: "Service created ✓, Controller created ✓, Module created ✓, All dependencies in providers array ✓".

### React Query Loading State vs Empty State - Preventing Flash of Empty Messages
- ✅ **Good Design Pattern**: Properly distinguish between "data is still loading" and "data loaded but empty" to prevent confusing UX flashes
- 🔍 **Issue**: When navigating between tabs/pages, users see a brief flash of "No records found" or "No staff found" messages before the actual data loads and displays. This creates a poor user experience where it appears there's no data, then suddenly data appears.
- 🔍 **Cause**: 
  1. React Query can have `isLoading: false` while `data` is still `undefined` (especially during initial load or when query key changes)
  2. The conditional logic checks `isLoading` first, but if `isLoading` is false and `data` is undefined, it falls through to the empty state check
  3. The empty state condition `!query.data || !query.data.data || query.data.data.length === 0` evaluates to `true` when `data` is `undefined`, showing "No records found" prematurely
  4. This happens because `!query.data` is `true` when data hasn't loaded yet, not just when it's empty
- ✅ **Solution**: 
  1. Check for `isLoading || !query.data` to show loader (covers both initial load and when data is undefined)
  2. Only show empty state when `query.data` exists but `query.data.data.length === 0` (data loaded but actually empty)
  3. This ensures loader shows during initial load, and empty state only shows after data has been fetched and confirmed to be empty

**Why:** React Query's `isLoading` can be `false` even when data hasn't loaded yet (e.g., when query is enabled conditionally, or during query key changes). The key distinction is: `data === undefined` means "still loading", while `data !== undefined && data.data.length === 0` means "loaded but empty". Users should never see "No records found" before data has actually been fetched.

**Example:**
```typescript
// ❌ Wrong - Shows empty state when data is undefined
{query.isLoading ? (
  <Loader />
) : query.error ? (
  <Error />
) : !query.data || !query.data.data || query.data.data.length === 0 ? (
  <EmptyState /> // ❌ Shows when data is undefined!
) : (
  <Table />
)}

// ✅ Correct - Distinguish between loading and empty
{query.isLoading || !query.data ? ( // ✅ Show loader when data is undefined
  <Loader />
) : query.error ? (
  <Error />
) : query.data.data.length === 0 ? ( // ✅ Only check length when data exists
  <EmptyState />
) : (
  <Table />
)}
```

**Alternative (Even Smoother):**
```typescript
// ✅ Best - Also handles refetching state smoothly
{query.isLoading || (query.isFetching && !query.data) ? (
  <Loader />
) : query.error ? (
  <Error />
) : query.data && query.data.data.length === 0 ? (
  <EmptyState />
) : (
  <Table />
)}
```

**Lesson**: Always distinguish between "no data yet" (loading state) and "data loaded but empty" (empty state). When using React Query, check `isLoading || !data` to show loader, and only show empty state when `data` exists but is empty (`data.data.length === 0`). This prevents confusing flashes of "No records found" messages before data actually loads. The key principle: `data === undefined` = still loading, `data !== undefined && data.data.length === 0` = actually empty. Apply this pattern consistently across all list pages (staff, users, students, etc.) for a smooth user experience.

## API Response Structure & Type Safety (Multiple Cascading Errors)

### Nested API Response Data Access
- ❌ **Issue**: Type errors like `Property 'find' does not exist on type '{ data: T[] }'` when calling array methods on API responses
- 🔍 **Cause**: 
  1. `apiClient.get<T>()` returns the Axios response, where `response.data` is the parsed JSON body
  2. The API response structure is `{ data: T[], meta?: {...} }` (wrapped in `data` property)
  3. So `response.data` is `{ data: T[] }`, not `T[]` directly
  4. Trying to call `.find()`, `.map()`, `.filter()` on `response.data` fails because it's an object, not an array
- ✅ **Solution**: Access `response.data.data` to get the actual array:
  ```typescript
  // ❌ Wrong
  const response = await apiClient.get<{ data: Staff[] }>('/api/v1/staff');
  return response.data.find(s => s.id === id); // Error! response.data is { data: Staff[] }

  // ✅ Correct
  const response = await apiClient.get<{ data: Staff[] }>('/api/v1/staff');
  return response.data.data.find(s => s.id === id); // response.data.data is Staff[]
  ```
- **Lesson**: Always remember the API response structure: `response` → `response.data` (JSON body) → `response.data.data` (actual array). When you see "Property 'X' does not exist on type '{ data: T[] }'", you need to add another `.data` accessor.

### useAuth() Hook Returning Untyped User Object
- ❌ **Issue**: Type errors like `Property 'id' does not exist on type '{}'` or `Property 'currentBranch' does not exist on type '{}'` when accessing user properties throughout the codebase
- 🔍 **Cause**: 
  1. The `useAuth()` hook uses React Query's `useQuery` to fetch user data
  2. TypeScript couldn't properly infer the return type of the query data
  3. The hook returned `{ user, ... }` where `user` was typed as `{}` (empty object) instead of `User | undefined`
  4. This caused ALL components using `useAuth()` to have type errors when accessing `user.id`, `user.currentBranch`, `user.roles`, etc.
- ✅ **Solution**: Explicitly cast the return type in the hook:
  ```typescript
  // ❌ Wrong - user typed as {}
  return {
    user,
    isLoading,
    // ...
  };

  // ✅ Correct - explicitly type the user
  return {
    user: user as User | undefined,
    isLoading,
    // ...
  };
  ```
- **Lesson**: When React Query's type inference fails, explicitly type the returned values in your custom hooks. This is a single fix point that resolves type errors across the entire codebase. Check hooks that wrap React Query if you see widespread type errors on returned objects.

### TanStack Query v5 - Removed onSuccess/onError from useQuery
- ❌ **Issue**: Build error: `Object literal may only specify known properties, and 'onSuccess' does not exist in type 'UseQueryOptions'`
- 🔍 **Cause**: 
  1. TanStack Query v5 removed `onSuccess` and `onError` callbacks from `useQuery`
  2. These callbacks only exist in `useMutation` now
  3. Code written for Query v4 (or copied from v4 examples) will fail in v5
- ✅ **Solution**: Remove the callbacks and handle side effects differently:
  ```typescript
  // ❌ Wrong - v4 pattern doesn't work in v5
  const { data } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchCurrentUser,
    onSuccess: (data) => {
      localStorage.setItem('branchId', data.currentBranch.id);
    },
    onError: (error) => {
      console.error(error);
    },
  });

  // ✅ Correct - v5 pattern
  const { data } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchCurrentUser,
  });
  
  // Handle side effects in component body or useEffect
  if (data?.currentBranch?.id) {
    localStorage.setItem('branchId', data.currentBranch.id);
  }
  ```
- **Lesson**: When upgrading to or using TanStack Query v5, remove `onSuccess`/`onError` from `useQuery` calls. Check query options if you see "property does not exist" errors. Only `useMutation` retains these callbacks in v5.

### Theme Colors Property Naming Mismatch
- ❌ **Issue**: Type error: `Property 'successColor' does not exist on type '{ primary: string; success: string; error: string; ... }'`
- 🔍 **Cause**: 
  1. `useThemeColors()` returns `{ success, error, warning, info }` (short names)
  2. Code was trying to destructure `{ successColor, errorColor }` (suffixed names)
  3. The property names don't match the actual return type
- ✅ **Solution**: Use the correct property names or alias them:
  ```typescript
  // ❌ Wrong - these properties don't exist
  const { successColor, errorColor } = useThemeColors();

  // ✅ Correct - use actual property names
  const { success, error } = useThemeColors();

  // ✅ Also correct - alias with destructuring
  const { success: successColor, error: errorColor } = useThemeColors();
  ```
- **Lesson**: Always check the actual return type of hooks before destructuring. Use TypeScript's hover feature to see what properties are available. When you need different variable names, use destructuring aliases (`{ actual: aliasName }`).

### Variable Shadowing in Callback Functions
- ❌ **Issue**: Type error: `Type 'Error' is not assignable to type 'DefaultMantineColor'` when using `color: error` in a notification
- 🔍 **Cause**: 
  1. Destructured `{ success, error } = useThemeColors()` where `error` is a color string
  2. In `onError: (error: Error) => { ... }`, the `error` parameter shadows the theme color
  3. When using `color: error`, TypeScript sees the `Error` object, not the color string
- ✅ **Solution**: Use different names to avoid shadowing:
  ```typescript
  // ❌ Wrong - error parameter shadows error color
  const { success, error } = useThemeColors();
  useMutation({
    onError: (error: Error) => {
      notifications.show({
        color: error, // ❌ This is the Error object, not the color!
      });
    },
  });

  // ✅ Correct - alias to avoid shadowing
  const { success: successColor, error: errorColor } = useThemeColors();
  useMutation({
    onError: (error: Error) => {
      notifications.show({
        color: errorColor, // ✅ This is the color string
        message: error.message, // ✅ This is the Error object
      });
    },
  });
  ```
- **Lesson**: When naming variables, consider all scopes where they'll be used. Callback parameters commonly named `error`, `data`, `response` can shadow outer variables. Use aliases (`errorColor`, `responseData`) or prefixes when there's potential for shadowing. If you see a type mismatch in a callback, check if a parameter is shadowing an outer variable.

### Cascading Type Errors - The Real Cost
- ❌ **Issue**: A single build revealed 10+ type errors across 8 different files, requiring iterative fixes
- 🔍 **Cause**: Multiple independent issues compounded:
  1. `useAuth()` hook returning untyped `user` → affected every file using `useAuth()`
  2. Nested `response.data.data` access pattern → affected every API call
  3. TanStack Query v5 deprecated callbacks → affected `useAuth` and other hooks
  4. Theme colors naming mismatch → affected multiple hooks using notifications
  5. Variable shadowing → affected all mutation hooks with `onError`
- ✅ **Solution**: 
  1. Fix root cause issues first (hook return types, shared utilities)
  2. Use `replace_all` for systematic fixes of the same pattern
  3. Run build after each fix to catch remaining errors
- **Lesson**: When you see one type error, there are often more with the same root cause. Fix the source (e.g., hook return type) rather than patching each usage. Before implementing, verify:
  1. API response structure matches type definitions
  2. Custom hooks have explicit return types
  3. Library versions match code patterns (v4 vs v5)
  4. Variable names don't conflict across scopes

**Prevention Checklist:**
- [ ] Check API response structure: `response.data` vs `response.data.data`
- [ ] Verify hook return types are explicitly typed
- [ ] Confirm TanStack Query version and use correct patterns
- [ ] Use aliased destructuring to avoid shadowing (`{ error: errorColor }`)
- [ ] Run `npm run build` after changes to catch type errors early

## NestJS Module Configuration & Route Conflicts

### Missing Provider in Module for Dependency Injection
- ❌ **Issue**: `Nest can't resolve dependencies of the SettingsStatusService (?). Please make sure that the argument SupabaseConfig at index [0] is available in the SettingsStatusModule context.`
- 🔍 **Cause**: 
  1. When creating a new NestJS module (`SettingsStatusModule`), the service (`SettingsStatusService`) injects `SupabaseConfig` in its constructor
  2. `SupabaseConfig` was not added to the module's `providers` array
  3. NestJS dependency injection requires all dependencies to be explicitly provided in the module context where they're used
- ✅ **Solution**: 
  1. Import `SupabaseConfig` from `'../../common/config/supabase.config'` in the module file
  2. Add `SupabaseConfig` to the `providers` array in the `@Module` decorator
  3. Follow the same pattern used in other modules that use `SupabaseConfig`
- **Lesson**: When creating new NestJS modules, if a service injects any dependency (like `SupabaseConfig`, other services, etc.), that dependency MUST be listed in the module's `providers` array. NestJS cannot inject dependencies that aren't explicitly provided in the module context. Before marking a module as complete, verify all constructor-injected dependencies are in the `providers` array. Check existing modules as reference for the correct pattern.

### Route Order Conflict - Parameterized Routes Matching Specific Routes
- ❌ **Issue**: `HTTP 400 Error: invalid input syntax for type uuid: "by-tenant"` when calling `/api/v1/branches/by-tenant`
- 🔍 **Cause**: 
  1. In `BranchesController`, the route order was incorrect: `@Get(':id')` was defined before `@Get('by-tenant')`
  2. NestJS matches routes in the order they're defined
  3. When requesting `/api/v1/branches/by-tenant`, NestJS matched it to `@Get(':id')` first, treating "by-tenant" as the `id` parameter
  4. The service then tried to parse "by-tenant" as a UUID, causing the validation error
- ✅ **Solution**: 
  1. Reordered routes so that specific routes (`@Get('by-tenant')`) come before parameterized routes (`@Get(':id')`)
  2. Moved `@Get('by-tenant')` before `@Get(':id')` in the controller
- **Lesson**: In NestJS (and most routing frameworks), route order matters. Always define specific routes (like `@Get('by-tenant')`, `@Get('status')`) BEFORE parameterized routes (like `@Get(':id')`, `@Get(':key')`). If a parameterized route comes first, it will match and consume requests meant for specific routes. The rule: **More specific routes must be defined before more general/parameterized routes**. When adding new routes, check existing route order to ensure no conflicts.

### Route Base Path Conflict Between Controllers
- ❌ **Issue**: `HTTP 404 Error: Setting not found` when calling `/api/v1/settings/status`
- 🔍 **Cause**: 
  1. `SettingsStatusController` had base path `api/v1/settings` with route `@Get('status')` → `/api/v1/settings/status`
  2. `SystemSettingsController` also had base path `api/v1/settings` with route `@Get(':key')` → `/api/v1/settings/:key`
  3. When requesting `/api/v1/settings/status`, NestJS matched it to `SystemSettingsController`'s `@Get(':key')` route, treating "status" as the `key` parameter
  4. The service then tried to find a setting with key "status", which didn't exist, causing the 404 error
- ✅ **Solution**: 
  1. Changed `SettingsStatusController` base path from `api/v1/settings` to `api/v1/settings-status`
  2. Updated routes to `/api/v1/settings-status/status` and `/api/v1/settings-status/copy-from-branch`
  3. Updated frontend API calls to use the new paths
- **Lesson**: When multiple controllers share the same base path, route conflicts can occur. Use distinct base paths for different controllers to avoid conflicts. If controllers serve different purposes (e.g., `SystemSettingsController` for key-value settings, `SettingsStatusController` for initialization status), use different base paths (e.g., `api/v1/settings` vs `api/v1/settings-status`). When you see 404 errors for routes that should exist, check if another controller's parameterized route is matching first. Always use unique, descriptive base paths for controllers.

## Frontend Component Compatibility & API Validation

### Mantine v7 Component API Changes
- ❌ **Issue**: Type errors: `TimeInput` is not exported from `@mantine/core` and `Property 'breakpoint' does not exist on type 'StepperProps'`
- 🔍 **Cause**: 
  1. Code was using `TimeInput` component which exists in Mantine v6 but was removed/changed in Mantine v7
  2. `Stepper` component's `breakpoint` prop was available in Mantine v6 but removed in Mantine v7
  3. The codebase uses Mantine v7, but code was written using v6 patterns
- ✅ **Solution**: 
  1. Replaced `TimeInput` with `TextInput` with `type="time"` attribute for time input fields
  2. Removed `breakpoint` prop from `Stepper` component (not needed in v7)
- **Lesson**: When using UI libraries, always check the version-specific API documentation. Component APIs can change between major versions. Before using a component, verify it exists in the current version and check its props. If you see "is not exported" or "does not exist" errors, check the library version and migration guide. For Mantine v7, use `TextInput` with `type="time"` instead of `TimeInput`, and remove `breakpoint` prop from `Stepper`.

### TypeScript Null Safety - Potentially Undefined Array Access
- ❌ **Issue**: Type error: `'branches' is possibly 'undefined'` when accessing `branches.length`
- 🔍 **Cause**: 
  1. `userData.branches` could be `undefined` or `null`
  2. Code was accessing `branches.length` without checking if `branches` exists first
  3. TypeScript strict mode flags this as a potential runtime error
- ✅ **Solution**: 
  1. Used nullish coalescing operator (`?? []`) to provide a default empty array
  2. Changed `branches.length` to `(branches ?? []).length` or `const branches = userData.branches ?? []`
- **Lesson**: Always handle potentially undefined/null values before accessing their properties. Use nullish coalescing (`??`) or optional chaining (`?.`) to safely access properties. When working with arrays that might be undefined, provide a default empty array (`?? []`) before calling array methods. TypeScript strict mode helps catch these issues - don't ignore the warnings.

### API Request Validation - Exceeding Backend Limits
- ❌ **Issue**: `HTTP 400 Error: limit must not be greater than 100` when calling `/api/v1/notifications?isRead=false&limit=1000`
- 🔍 **Cause**: 
  1. Frontend `useUnreadCount` hook was using `limit=1000` to fetch all unread notifications for counting
  2. Backend has validation that enforces maximum limit of 100 (defined in `base-pagination.dto.ts` with `@Max(100)`)
  3. The request exceeded the backend's maximum allowed limit
- ✅ **Solution**: 
  1. Changed `limit=1000` to `limit=100` in `useUnreadCount` hook
  2. Note: This means if there are more than 100 unread notifications, the count will show as 100 (acceptable limitation)
- **Lesson**: Always respect backend validation constraints. Before making API requests with limit parameters, check the backend DTOs to see what the maximum allowed value is. Don't assume you can request unlimited data - pagination limits exist for performance reasons. If you need to count all records, consider:
  1. Using a dedicated count endpoint (e.g., `/api/v1/notifications/count`)
  2. Accepting the limitation and using the maximum allowed limit
  3. Implementing pagination to fetch all records in batches
When you see validation errors about limits, check the backend DTO validation decorators (`@Max`, `@Min`, etc.) to understand the constraints.

### Branch Guard Requiring Branch Selection
- ❌ **Issue**: `HTTP 400 Error: Branch context required` when calling `/api/v1/settings-status/status` for users with no branches assigned
- 🔍 **Cause**: 
  1. `BranchGuard` requires a branch to be selected (via `X-Branch-Id` header or branch context)
  2. Some users may not have any branches assigned in the `user_branches` table
  3. The settings page was calling the status endpoint without checking if a branch is available first
  4. This caused the API call to fail for users with no branch access
- ✅ **Solution**: 
  1. Added branch availability check in `useSettingsStatus` hook using `enabled: hasCurrentBranch`
  2. Added early return in settings page with alert message if no branch is selected
  3. Prevents API call when branch context is not available
- **Lesson**: When using guards that require specific context (like `BranchGuard` requiring a branch), always check if that context is available before making API calls. Use React Query's `enabled` option to conditionally enable queries based on prerequisites. For features that require branch selection, show helpful messages to users who don't have branch access rather than letting API calls fail silently. Always handle edge cases where required context might not be available.

### Email Fetching Failure in User/Staff Management - Missing Fallback Mechanism
- ❌ **Issue**: Emails were not showing in User Management and Staff Management tables, even though users existed in the database. The email column appeared empty for all users.
- 🔍 **Cause**: 
  1. The `supabase.auth.admin.listUsers()` call was failing silently (likely due to environment configuration issues, incorrect `SUPABASE_SERVICE_KEY`, insufficient permissions, or network issues)
  2. When `listUsers()` failed, the `emailMap` remained empty, leaving no email data to populate in the UI
  3. The code didn't have a fallback mechanism to fetch emails individually if the bulk `listUsers()` call failed
  4. This resulted in empty email fields in the UI, making it impossible to identify users by their email addresses
  5. The error was silently swallowed, making it difficult to diagnose the root cause
- ✅ **Solution**: 
  1. Reverted to using Supabase Admin API (`supabase.auth.admin.listUsers()` and `supabase.auth.admin.getUserById()`) with robust error handling
  2. Added a try-catch block around `listUsers()` to catch failures gracefully
  3. Implemented a fallback mechanism: if `listUsers()` fails or returns incomplete data, fetch emails individually for each user using `getUserById()`
  4. This ensures emails are always fetched and displayed, even if the bulk `listUsers()` call fails
  5. Added console warnings to help diagnose issues during development

**Why:** Supabase Admin API methods can fail due to various reasons (environment configuration, permissions, network issues). Relying on a single bulk operation without a fallback creates a single point of failure. By implementing a fallback to individual lookups, the feature remains functional even when the bulk operation fails.

**Example:**
```typescript
// ❌ Wrong - No fallback, fails silently
const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
if (!listError && authUsers?.users) {
  authUsers.users.forEach((u) => {
    if (u.email) emailMap.set(u.id, u.email);
  });
}
// If listUsers() fails, emailMap remains empty - no emails shown!

// ✅ Correct - Fallback to individual lookups
const emailMap = new Map<string, string>();
try {
  const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
  if (!listError && authUsers?.users) {
    authUsers.users
      .filter((u) => userIds.includes(u.id))
      .forEach((u) => {
        if (u.email) emailMap.set(u.id, u.email);
      });
  }
} catch (error) {
  // If listUsers fails, fetch emails individually
  console.warn('Failed to list users, fetching individually:', error);
}

// Fill in any missing emails by fetching individually
for (const userId of userIds) {
  if (!emailMap.has(userId)) {
    try {
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      if (authUser?.user?.email) {
        emailMap.set(userId, authUser.user.email);
      }
    } catch (error) {
      // Silently continue if individual fetch fails
    }
  }
}
```

**Lesson**: When using Supabase Admin API methods (or any external API calls) that might fail due to environment configuration, permissions, or network issues, always implement a fallback mechanism. Don't rely on a single bulk operation - if it fails, fall back to individual lookups. This ensures the feature works even in suboptimal environments. Always handle errors gracefully and provide alternative paths to fetch the same data. When you see empty data in the UI, check if there's a fallback mechanism for data fetching. For critical data like emails, always have a backup strategy. Add logging/warnings to help diagnose issues during development, but ensure the fallback mechanism works silently in production.

---

### [Backend Issue] Notification Unread Count & `isRead` Filtering Mismatch

- **Issue**: Notification UI showed inconsistent counts:
  - Bell badge unread count did not match actual unread notifications.
  - "Unread" tab (later renamed to "Read") and attendance tab counts were misleading.
  - After marking one notification as read, the UI still showed all notifications as "unread".
- **Cause**:
  1. **Backend DTO transform vs. implicit conversion conflict**:
     - Global `ValidationPipe` was configured with `transform: true` and `enableImplicitConversion: true`.
     - Query param `?isRead=false` was being implicitly converted to boolean `false` before the `@Transform` in `QueryNotificationsDto` ran.
     - The DTO transform only handled string values `'true'`/`'false'`, so a boolean `false` value fell through to `undefined`, causing the service to **skip the `is_read` filter** entirely:
       - `if (query.isRead !== undefined) dbQuery = dbQuery.eq('is_read', query.isRead);`
       - With `isRead` becoming `undefined`, the filter was not applied and **all** notifications (read + unread) were returned.
  2. **Frontend unread count implementation coupled to filtered query**:
     - `useUnreadCount` used `/api/v1/notifications?isRead=false&limit=...` and simply returned `response.data.length`.
     - When backend filtering was broken, this returned the total list size instead of unread count.
  3. **React Query invalidation initially too narrow**:
     - `useMarkAsRead` and `useMarkAllAsRead` only invalidated `['notifications', userId]`, not the separate unread-count query key `['notifications', 'unread-count', userId]`, so the bell badge could remain stale even after backend was fixed.
- **Solution**:
  1. **Fix DTO transform to handle booleans and strings**:
     - Updated `QueryNotificationsDto.isRead` transform to accept both boolean and string:
       - `if (value === true || value === 'true') return true;`
       - `if (value === false || value === 'false') return false;`
       - Ensures `isRead=false` consistently becomes `false` and the `.eq('is_read', query.isRead)` filter always applies.
  2. **Decouple frontend unread views from fragile backend list filters**:
     - **Bell badge** (`useUnreadCount`) now computes unread via backend **totals**:
       - Fetch total notifications with `limit=1` and read `meta.total` (or `data.length` fallback).
       - Fetch total **read** notifications with `isRead=true&limit=1` and read `meta.total`.
       - Compute unread as `total - read`, clamped at `>= 0`.
     - **Notifications page tabs** now derive segments **client-side** from the **All** list:
       - `Unread` = `allNotifications.filter(n => !n.isRead)`
       - `Read` = `allNotifications.filter(n => n.isRead)`
       - `Attendance` tab still uses its own filtered query by `type`.
     - This keeps the UI counts consistent with database truth while avoiding over-dependence on filtered endpoints for derived views.
  3. **Broaden React Query invalidation**:
     - Changed `useMarkAsRead` and `useMarkAllAsRead` to:
       - `queryClient.invalidateQueries({ queryKey: ['notifications'] });`
       - `queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });`
     - This reliably refreshes all notification lists and the bell badge after any read operation.
  4. **Align tab semantics with data**:
     - Renamed the second tab from **"Unread"** to **"Read"** to match the `isRead=true` filter semantics and avoid confusion for parents.
- **Lesson**:
  - When using NestJS `ValidationPipe` with `enableImplicitConversion`, **DTO transforms must handle already-converted types** (e.g., booleans, numbers), not just raw strings; otherwise filters silently break.

### DTO Validation for Route-Determined Fields

- ❌ **Making route-determined fields required in DTOs** → Validation error when field is not in request body
- ✅ **Make route-determined fields optional** since the controller sets them based on the route

**Example:**
```typescript
// ❌ Wrong - Status is required but controller sets it from route
export class UpdateEarlyDepartureStatusDto {
  @IsEnum(['approved', 'rejected'])
  status!: Exclude<EarlyDepartureStatus, 'pending'>; // Required field
}

// Controller sets status: { ...input, status: 'approved' }
// But request body doesn't include status → Validation fails!

// ✅ Correct - Status is optional, controller always sets it
export class UpdateEarlyDepartureStatusDto {
  @IsOptional()
  @IsEnum(['approved', 'rejected'])
  status?: Exclude<EarlyDepartureStatus, 'pending'>; // Optional field
}

// Controller: { ...input, status: 'approved' } → Works!
```

- **Context**: When a controller endpoint determines a field value based on the route (e.g., `/approve` sets `status: 'approved'`), the DTO should not require that field in the request body. The controller will always set it, so make it optional in the DTO.
- **Lesson**: Route-specific endpoints should have optional fields for values determined by the route path, not the request body.

### Missing Service Exports in NestJS Modules - Cross-Module Dependency Injection
- ❌ **Issue**: `Nest can't resolve dependencies of the GradesService (?). Please make sure that the argument AssessmentsService at index [0] is available in the GradesModule context.`
- 🔍 **Cause**: 
  1. `GradesModule` imports `AssessmentsModule` and `GradesService` depends on `AssessmentsService` in its constructor
  2. `AssessmentsService` was not exported from `AssessmentsModule`, making it unavailable for dependency injection in other modules
  3. NestJS requires services to be explicitly exported from their module if they need to be injected into services in other modules
  4. Even though the module is imported, NestJS cannot inject the service unless it's in the module's `exports` array
- ✅ **Solution**: 
  1. Added `exports: [AssessmentsService]` to `AssessmentsModule`
  2. This makes `AssessmentsService` available for dependency injection in any module that imports `AssessmentsModule`
  3. Now `GradesService` can successfully inject `AssessmentsService` in its constructor

**Example:**
```typescript
// ❌ Wrong - Service not exported, causes DI error in dependent modules
@Module({
  imports: [AssessmentModule, AcademicYearsModule, ClassSectionsModule],
  controllers: [AssessmentsController],
  providers: [AssessmentsService, SupabaseConfig],
  // Missing exports!
})
export class AssessmentsModule {}

// GradesModule tries to use it:
@Injectable()
export class GradesService {
  constructor(
    private readonly assessmentsService: AssessmentsService, // ❌ DI fails!
  ) {}
}

// ✅ Correct - Service exported for use in other modules
@Module({
  imports: [AssessmentModule, AcademicYearsModule, ClassSectionsModule],
  controllers: [AssessmentsController],
  providers: [AssessmentsService, SupabaseConfig],
  exports: [AssessmentsService], // ✅ Now available for injection!
})
export class AssessmentsModule {}

// GradesModule can now use it:
@Injectable()
export class GradesService {
  constructor(
    private readonly assessmentsService: AssessmentsService, // ✅ Works!
  ) {}
}
```

- **Lesson**: When creating NestJS modules, if a service needs to be used by other modules, it MUST be added to the `exports` array. NestJS dependency injection has two contexts: 1) Within a module (use `providers`), 2) Across modules (use `exports`). Just importing the module is not enough - the service must be explicitly exported. Before marking a module as complete, verify: "Does any other module need to inject this service? If yes, is it in the `exports` array?" Create a checklist when creating modules with shared services: "Service created ✓, Added to providers ✓, Added to exports ✓, Other modules can import and inject ✓".
  - Never derive critical counts (like "unread notifications") purely from **page-sized list lengths**; prefer backend-provided totals (`count`/`meta.total`) and/or compute segments from a single, authoritative list in the frontend.
  - For React Query, design **query keys and invalidation** together: every derived view (lists, summary counts, badges) needs to be included in invalidation patterns after mutations.
  - Always cross-check UI counts against database truth (e.g., `total`, `read`, `unread` in SQL) when debugging discrepancies, and verify both backend filtering and frontend aggregation logic.

### React Query Hook Response Structure Mismatch - Returning Nested Data Instead of Full Response
- ❌ **Issue**: Schedule data not displaying on `/my-schedule` page even though the API was returning data correctly. The component showed no schedule information despite successful API calls and valid staff assignments in the database.
- 🔍 **Cause**: 
  1. The `useStaffSchedule` hook was returning `response.data` directly (the schedule object: `{ classTeacherOf: [...], subjectAssignments: [...] }`)
  2. The component was accessing `scheduleData?.data`, expecting the response to have a `data` property wrapper
  3. Since the hook returned the unwrapped data, `scheduleData` was the schedule object itself, not `{ data: schedule }`
  4. When the component accessed `scheduleData?.data`, it was trying to access `.data` on the schedule object, which doesn't exist, resulting in `undefined`
  5. The component's conditional rendering (`schedule && schedule.classTeacherOf.length > 0`) failed because `schedule` was `undefined`
- ✅ **Solution**: 
  1. Updated the `useStaffSchedule` hook to return the full `response` object instead of `response.data`
  2. The backend controller returns `{ data: { classTeacherOf: [...], subjectAssignments: [...] } }`
  3. The ResponseInterceptor passes it through as-is: `{ data: StaffSchedule }`
  4. The hook now returns `response` (which is `{ data: StaffSchedule }`), matching what the component expects
  5. The component can now correctly access `scheduleData?.data` to get the `StaffSchedule` object

**Why:** React Query hooks should return the response structure that matches how the component accesses the data. If the component uses `data?.data`, the hook must return an object with a `data` property. If the component uses `data` directly, the hook should return the unwrapped data. Always check how the component accesses the query result before deciding what the hook should return.

**Example:**
```typescript
// ❌ Wrong - Component expects scheduleData?.data but hook returns unwrapped data
export function useStaffSchedule(staffId: string | null) {
  return useQuery({
    queryFn: async () => {
      const response = await apiClient.get<{ data: StaffSchedule }>('/api/v1/staff/${staffId}/schedule');
      return response.data; // Returns { classTeacherOf: [...], subjectAssignments: [...] }
    },
  });
}
// Component: const schedule = scheduleData?.data; // schedule is undefined!

// ✅ Correct - Hook returns full response matching component expectations
export function useStaffSchedule(staffId: string | null) {
  return useQuery({
    queryFn: async () => {
      const response = await apiClient.get<{ data: StaffSchedule }>('/api/v1/staff/${staffId}/schedule');
      return response; // Returns { data: { classTeacherOf: [...], subjectAssignments: [...] } }
    },
  });
}
// Component: const schedule = scheduleData?.data; // schedule is { classTeacherOf: [...], subjectAssignments: [...] } ✓
```

**Lesson**: Always verify that the React Query hook's return value matches how the component accesses the data. If the component uses `query.data?.data`, the hook must return an object with a `data` property. If the component uses `query.data` directly, the hook should return the unwrapped data. Before implementing a hook, check existing similar hooks in the codebase to understand the pattern. When debugging "data not showing" issues, check: 1) Is the API call successful? 2) What is the actual response structure? 3) How is the component accessing the data? 4) Does the hook return value match the component's expectations? Use console.log to verify the data structure at each step: hook return value → component access → rendered data. Create a checklist when implementing new hooks: "API endpoint works ✓, Hook returns correct structure ✓, Component accesses data correctly ✓, Data displays in UI ✓".

---

### Using Redundant Queries Instead of Data Already Available in Response

- **Issue**: Student timetable page showed "No Subject Template Assigned" error even though the student data response already contained `subjectTemplateId` and `subjectTemplateName`. The component was making a separate query to fetch template information when it was already available in the student data.

- **Cause**:
  1. **Redundant data fetching**: The component used `useStudentTemplate()` hook to fetch template information separately, even though `useMyStudent()` already returned student data with `subjectTemplateId` and `subjectTemplateName` fields populated.
  2. **Over-reliance on separate queries**: The component logic checked `templateData?.data` from the separate query, ignoring the template information already present in `myStudentData.data.subjectTemplateId` and `myStudentData.data.subjectTemplateName`.
  3. **Query dependency chain**: The separate template query might fail or return `null` for various reasons (network issues, query parameters, timing), causing the component to show an error even when the data was available.
  4. **Debugging approach**: Multiple fixes were attempted (backend branch filtering, data shape corrections, loading state fixes) before realizing the root cause was using redundant queries instead of available data.

- **Solution**:
  1. **Use data from primary query**: Changed the component to prioritize template information from the student data response:
     ```typescript
     // Use template info from student data if available, otherwise from separate query
     const subjectTemplate = myStudentData?.data?.subjectTemplateId
       ? {
           id: myStudentData.data.subjectTemplateId,
           name: myStudentData.data.subjectTemplateName || 'Unknown Template',
         }
       : templateData?.data;
     ```
  2. **Remove unnecessary loading dependency**: Removed `templateLoading` from the loading check since we're using the student data directly, which is already being loaded.
  3. **Keep fallback for edge cases**: Maintained the separate query as a fallback for cases where student data might not include template information (defensive programming).

- **Lesson**:
  - **Always check what data is already available** in API responses before creating additional queries. If a parent query (e.g., `useMyStudent`) returns related data (e.g., `subjectTemplateId`, `subjectTemplateName`), use that data directly instead of making redundant queries.
  - **Inspect the actual API response structure** in the network tab and console logs to see what fields are available. Don't assume you need a separate query just because a hook exists for it.
  - **When debugging "data not showing" issues**, first verify: 1) What data is in the primary query response? 2) Is the data already available in a different format? 3) Are we making unnecessary queries? 4) Can we use data from an existing query instead?
  - **Performance consideration**: Redundant queries add unnecessary network requests, increase loading time, and create more failure points. Always prefer using data already fetched over making additional queries.
  - **Debugging checklist**: When a feature shows "not found" or "not available" errors: 1) Check network tab - is the data actually being returned? 2) Check console logs - what does the response structure look like? 3) Check component logic - are we checking the right data source? 4) Check if data is available in a different query response - can we use that instead?
  - **Code review principle**: Before adding a new query hook, ask: "Is this data already available in another query response?" If yes, use that data instead of creating a new query.

---

### Inconsistent Page Layout Patterns - Using Containers Instead of Full-Width Layout

- ❌ **Issue**: Assessment pages were built with centered `Container` components (`size="xl"` or `size="md"`) and small headings (`order={2}`), resulting in cramped layouts with excessive side margins and small titles. This was inconsistent with the established pattern used in Users, Leaves, Students, and other pages.

- 🔍 **Cause**:
  1. **Not reviewing existing pages**: Agent implemented new pages without checking the established layout pattern used in similar pages (Users, Leaves, Students)
  2. **Default to Container**: Used Mantine's `Container` component by default, which constrains content width and centers it, leaving large empty spaces on the sides
  3. **Incorrect heading hierarchy**: Used `<Title order={2}>` (H2) instead of `<Title order={1}>` (H1) for main page headings, making titles appear smaller
  4. **Missing page-title-bar pattern**: Didn't use the `page-title-bar` class and custom styling that provides full-width headers with consistent spacing
  5. **Layout inconsistency across features**: Different features ended up with different visual styles, breaking UX consistency

- ✅ **Solution**:
  1. **Removed Container wrappers**: Changed from `<Container size="xl">` to the established full-width pattern with `page-title-bar`
  2. **Fixed heading hierarchy**: Changed all page titles from `order={2}` to `order={1}` for proper prominence
  3. **Applied standard layout structure**:
     ```tsx
     // ✅ Correct full-width pattern
     <>
       <div className="page-title-bar">
         <Group justify="space-between" w="100%">
           <Title order={1}>Page Title</Title>
           <Button>Action</Button>
         </Group>
       </div>
       
       <div style={{
         marginTop: '60px',
         paddingLeft: 'var(--mantine-spacing-md)',
         paddingRight: 'var(--mantine-spacing-md)',
         paddingTop: 'var(--mantine-spacing-sm)',
         paddingBottom: 'var(--mantine-spacing-xl)',
       }}>
         {/* Content uses full width with controlled padding */}
       </div>
     </>
     ```
  4. **Updated all assessment pages**: Applied fix to list, create, edit, grades, and statistics pages

**Why:** `Container` component is designed for content articles and centered layouts, NOT for application pages with tables, forms, and data grids. Application pages need full-width layouts that maximize available space for displaying information. Using `Container` on admin/dashboard pages creates:
- Wasted screen real estate (large empty margins on wide screens)
- Inconsistent user experience across different features
- Cramped content that doesn't scale well with viewport width
- Small headings that don't command proper visual hierarchy

**Example:**
```tsx
// ❌ WRONG - Centered container pattern
export default function AssessmentsPage() {
  return (
    <Container size="xl" py="xl">  {/* ❌ Constrains width, wastes space */}
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={2}>Assessments</Title>  {/* ❌ H2 too small */}
          <Button>Create</Button>
        </Group>
        <Paper p="md" withBorder>
          {/* Table squeezed into narrow container */}
        </Paper>
      </Stack>
    </Container>
  );
}

// ✅ CORRECT - Full-width application pattern
export default function AssessmentsPage() {
  return (
    <>
      <div className="page-title-bar">  {/* ✅ Full-width header */}
        <Group justify="space-between" w="100%">
          <Title order={1}>Assessments</Title>  {/* ✅ H1 proper size */}
          <Button leftSection={<IconPlus size={16} />}>
            Create Assessment
          </Button>
        </Group>
      </div>

      <div style={{
        marginTop: '60px',
        paddingLeft: 'var(--mantine-spacing-md)',
        paddingRight: 'var(--mantine-spacing-md)',
        paddingTop: 'var(--mantine-spacing-sm)',
        paddingBottom: 'var(--mantine-spacing-xl)',
      }}>
        {/* Content uses full available width */}
        <Stack gap="md">
          <Group>
            <TextInput placeholder="Search..." style={{ flex: 1 }} />
            <MultiSelect placeholder="Filter..." style={{ width: 200 }} />
          </Group>
          <Table>
            {/* Table has full width to display data */}
          </Table>
        </Stack>
      </div>
    </>
  );
}
```

- **Lesson**:
  - **ALWAYS review existing similar pages** before implementing new pages. Check `/users/page.tsx`, `/leaves/page.tsx`, `/students/page.tsx` for the established pattern.
  - **Never use `Container` for main application pages** - it's for content articles, not data-heavy admin interfaces.
  - **Always use `<Title order={1}>`** for main page headings - not `order={2}` or lower.
  - **Use `page-title-bar` class** for consistent full-width headers across all features.
  - **Layout consistency is critical** - users expect the same visual structure across all pages in the application.
  - **Before starting a new page**, ask: "What layout pattern do existing pages use?" Then follow that pattern exactly.
  - **Create a mental checklist** when implementing new pages: "Does this match Users page layout? ✓ Full-width? ✓ H1 title? ✓ page-title-bar? ✓"
  - **Content pages vs Application pages**: `Container` is for blog posts and articles; application pages need full-width layouts for tables, forms, and data visualization.
  - **Code review focus**: When reviewing UI implementations, check layout patterns FIRST before diving into functionality. Inconsistent layouts are immediately visible to users.

---

### UI locale flips to Arabic after refresh — dual sources for `NEXT_LOCALE` vs `profiles.preferred_locale`

- ❌ **Issue**: After Bulk Import Setup (or similar flows), the app stayed in English during SPA use, but a **full browser refresh** switched the UI to **Arabic** with no intentional user action. Related symptoms: stale React Query caches for permissions until refresh; confusing behaviour around “which language wins.”

- 🔍 **Cause** (multiple compounding factors):
  1. **Two sources of truth**: **`NEXT_LOCALE` cookie** drives `next-intl` / `getLocale()` on the server, while **`profiles.preferred_locale`** drives login/OAuth flows and `/auth/me`. They were allowed to **diverge** (e.g. cookie `en`, profile `ar`).
  2. **`resolveLocaleFromCookieHeader()` returns `'en'` when the raw `Cookie` header has no `NEXT_LOCALE` segment** — that default is **truthy**, so code that did `locale = fromHeader || fromCookieJar` **never fell through to the cookie jar**, producing a **different** effective locale than `cookies().getAll('NEXT_LOCALE')` until a full refresh “fixed” ordering.
  3. **Login / OAuth unconditionally called `setUiLocaleCookieOnDocument(normalizeUiLocale(preferred_locale))`**, overwriting an existing English cookie whenever the DB still said `ar` (failed PATCH after language switch, signup default, etc.).
  4. **`/auth/me` handler**: when **`NEXT_LOCALE` was missing in `document.cookie`**, syncing **profile → cookie** alone made the **next** full request send `ar` from the profile while the **previous** server render had used default English — flip on refresh.
  5. **Bulk import** `invalidateQueries(['auth', 'me'])` surfaced the bug more often by refetching user context without fixing the underlying contract between cookie and profile.

- ✅ **Solution** (frontend, single policy):
  1. **Canonical server resolution**: One helper **`resolveUiLocaleForRequest({ cookieHeader, cookieJarValues })`** — only treat the header parser’s result as authoritative when **`NEXT_LOCALE=` is actually present** in the header string (`hasNextLocaleInCookieHeader`); otherwise use the Next.js cookie jar (last wins), then default `'en'`.
  2. **Middleware + `i18n/request.ts`** both use that helper; middleware **collapses** duplicate / inconsistent jar values to the canonical locale.
  3. **Login / OAuth**: **`applyPreferredLocaleToCookieOnlyIfUnset(preferred)`** — seed the cookie from **`preferred_locale` only when no `NEXT_LOCALE` cookie exists yet** (never overwrite an existing cookie).
  4. **`fetchCurrentUser`**: repair cookie when absent (align with **`document.documentElement.lang`**, i.e. what the server already rendered), keep the **English-profile + Arabic-cookie** repair where needed, then **`syncProfilePreferredLocaleWithCookie`** — **PATCH `preferred_locale` to match the resolved cookie** when they differ so the DB follows the cookie (cookie wins for SSR).
  5. **LanguageSwitcher**: PATCH **`preferred_locale`** using the **same normalised value** as the cookie (`next` after `normalizeUiLocale`).
  6. **Bulk import `onSuccess`**: invalidate **`['auth', 'me']`** and **`['permissions']`** so matrices and user state stay consistent (separate but often reported together).

- **Lesson**:
  - **Pick one primary driver for SSR locale** — here **`NEXT_LOCALE` is authoritative for what Next renders**. **`preferred_locale` must be kept in sync** from that cookie when they differ, not the other way around on every login.
  - **Never treat “default `en` from a parser” as “header said English”** — distinguish **absent** `NEXT_LOCALE` from **explicit** `en` using something like **`hasNextLocaleInCookieHeader`** before using header-based resolution.
  - **Never unconditionally overwrite `NEXT_LOCALE` from `preferred_locale`** on login/OAuth; only **seed when unset**.
  - **Do not push `preferred_locale` into the cookie when the cookie is missing** without aligning to **what the server already rendered** (e.g. `<html lang>`), or the next refresh will follow the DB and flip the UI.
  - **When debugging “works until refresh”**: trace **full document request** — cookie sent on refresh vs in-memory SPA state; check **duplicate `NEXT_LOCALE` cookies** (last wins) and **middleware** canonicalisation.
  - **Document the contract** in the locale utility module so future changes do not reintroduce a second silent source of truth.

---

### Dashboard loads forever after login/logout — auth bootstrap requests went out without token (race) + branch selection gaps

- ❌ **Issue**: After login (especially **logout → login as a different tenant/user**), `/dashboard` showed skeletons indefinitely (often also missing sidebar + branch name) until doing **Ctrl+Shift+R**. LocalStorage could already contain a valid `currentBranchId`, but the UI still hung.

- 🔍 **Cause**:
  1. **API client race**: The request interceptor in `frontend/src/lib/api-client.ts` treated Supabase session availability as “best effort” and would **send requests without `Authorization`** when `supabase.auth.getSession()` was slow/throwing on first load. That made `/api/v1/auth/me` (and sometimes `/api/v1/auth/select-branch`) run **unauthenticated**, returning incomplete user context (no `currentBranch`).
  2. **Stale cache trap**: With React Query `staleTime` set to 5 minutes, a “bad” `/auth/me` response could stay fresh long enough that the app didn’t refetch immediately, leaving branch-gated queries disabled and the dashboard stuck.
  3. **Branch selection not guaranteed**: Portal layout uses `AuthGuard` only (no `BranchGuard`), so the login flow must ensure a branch is selected before routing to `/dashboard`. Any path that navigated without selecting a branch would amplify the above.

- ✅ **Solution**:
  1. **Auth bootstrap token wait**: For critical bootstrap endpoints (`/api/v1/auth/me`, `/api/v1/auth/select-branch`), the API client now **retries briefly for a Supabase access token** (small bounded loop) instead of firing unauthenticated. Non-critical requests remain best-effort.
  2. **Branch selection before dashboard**: Ensure login routing selects a branch (currentBranch → localStorage hint → first branch) before navigating to `/dashboard`, and avoid mounting dashboard from a cached “no currentBranch” `auth/me`.
  3. **Cache hygiene**: Clear or invalidate `['auth','me']` around branch selection/logout paths so the app cannot boot from stale auth state.

- **Lesson**:
  - **Never allow `/auth/me` to go out without an access token** “just to keep the UI moving.” It’s a bootstrap endpoint — an unauthenticated response can poison caches and strand the app until a hard refresh.
  - **If a layout does not enforce branch selection**, the login flow must do it deterministically before routing to branch-gated screens.
  - **When a bug is fixed by Ctrl+Shift+R**, suspect: cached “bad” auth context, token races, and request interceptors that silently drop auth headers.

---

### Signup/login redirect shows blank portal — blocking side-effects inside React Query auth fetch

- ❌ **Issue**: After signup (and sometimes login), routing to `/dashboard` showed a “blank” portal (often just background / no usable UI) until a manual refresh. Dev diagnostics showed `🟡 FETCH_CURRENT_USER: Got response...` but **never** `🟢 FETCH_CURRENT_USER: Returning user...` — meaning `fetchCurrentUser()` wasn’t completing, so `useAuth()` never reached a stable `user` state.

- 🔍 **Cause**:
  1. **`fetchCurrentUser` (React Query `queryFn`) contained non-critical side effects** (UI locale cookie repair + `syncProfilePreferredLocaleWithCookie()`).
  2. That side-effect path could **throw or hang**, preventing `fetchCurrentUser()` from reaching its `return` and leaving the auth query perpetually “in-flight” / unresolved.
  3. Because `AuthGuard` / portal layout depends on `useAuth()` resolving, the entire portal could appear blank even though `/api/v1/auth/me` itself returned `200`.
  4. This took a long time to diagnose because Network showed `/auth/me` succeeding, which misleadingly suggested “auth is fine,” while the real problem was **post-fetch work blocking the promise resolution**.

- ✅ **Solution**:
  1. **Make `fetchCurrentUser` minimal and deterministic**: only call `/api/v1/auth/me` plus *optional* branch selection (if `currentBranch` missing and a `currentBranchId` hint exists).
  2. **Move locale repair/sync into a separate `useEffect`** that runs **after** `user` has resolved, and wrap that effect in `try/catch` so it can never block auth.
  3. Keep diagnostics gated to **development only** (`process.env.NODE_ENV === 'development'`) to avoid production console noise.

- **Lesson**:
  - **Never put non-critical side effects inside a React Query `queryFn` for bootstrap state like `['auth','me']`**. If it throws/hangs, it blocks the whole app.
  - **If a request “succeeds” in Network but UI is blank**, check whether the promise chain completes (missing “return” log is a strong signal).
  - Prefer: **queryFn = fetch data only**; all “repair/sync” logic belongs in **effects** (non-blocking) or explicit mutation steps with bounded timeouts.

---

### Collapsed sidebar flyout (Popover portal): wrong tint on every row, then hover colours missing or overriding inline styles

- **Issue**: Collapsed-rail **accordion-group flyouts** (rendered in a **Popover portal**, not inside `.mantine-AppShell-navbar`) showed an unwanted **primary/green** fill on rows and repeated regressions: switching Mantine `Button` variant did nothing; later **hover theme colours** disappeared after fixing the tint.

- **Cause** (stacked, easy to mis-diagnose as “one” UI bug):
  1. **`DynamicThemeProvider` injects global CSS with `!important`** aimed at theme consistency. Several selectors apply to **any** matching element in the document, including portaled UI:
     - **`.nav-item-button`** rules for **active/hover** backgrounds used to be **global** → beat **inline styles** on flyout rows (`!important` vs normal inline).
     - **`.mantine-Button-root`** (and **`[style*="background"]`**) rules force **`config.components.button`** colours with **`!important`** → overrides flyout `Button` inline styles; explains solid greens like **`#3D8C40`** and inspector showing **`mantine-active`** (Mantine `Button` pressed/active class), which is **not** the same as app route `data-active`.
  2. **Scoped `.mantine-AppShell-navbar .nav-item-button`** fixed navbar-only nav chrome but **did not** fix **`mantine-Button-root`** globals → flyout **`Button`** rows still wrong.
  3. Replacing with **`UnstyledButton`** removed Button globals, but **CSS `:hover`** inside Mantine `styles` still lost fights against injected **`!important`** or ordering → hover looked “gone”; relying on **`&:hover`** alone was brittle.

- **Solution**:
  1. Keep **navbar-specific** active/hover **`!important`** rules **scoped under `.mantine-AppShell-navbar`** so portaled flyouts are not forced by sidebar chrome rules.
  2. **Do not use Mantine `Button`** for portal flyout links — use **`UnstyledButton`** (or plain `<button>` + tokens) so global **`.mantine-Button-root`** / **`[style*="background"]`** overrides never apply.
  3. Apply **hover/active/default colours** using **`onMouseEnter` / `onMouseLeave`** (pointer-driven state) and **`style={{ backgroundColor, color }}`** on the flyout row so behaviour does not depend on winning a **`!important`** cascade fight.

- **Lesson**:
  - **Portal UI is not “inside the navbar”** — anything scoped to `.mantine-AppShell-navbar` will not apply; globals **will** apply. Audit **`DynamicThemeProvider`** for selectors that match **`button`**, **`.mantine-Button-root`**, **`[style*="…"]`**, and **`.nav-item-button`** without a navbar ancestor before blaming Mantine variants.
  - **`!important` beats inline styles** unless inline also uses `!important` — fixing component props alone is insufficient when globals override.
  - **Inspector clues**: **`mantine-active`** on Mantine `Button` is **component interaction state**, not your **`data-active`** route flag — do not conflate them when debugging colours.
  - **Prefer deterministic hover for heavily themed apps**: pointer state + inline colours for small chrome rows when global theme injection is aggressive.

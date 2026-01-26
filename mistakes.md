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

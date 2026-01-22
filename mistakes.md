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


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


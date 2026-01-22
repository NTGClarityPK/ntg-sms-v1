# Student Database Seeding: Complete Overview

## Example Student: Ahmed Hassan

This document explains how a student is inserted into the database, showing all tables involved and their relationships.

---

## 📊 Database Tables Involved (Insertion Order)

### 1. **`auth.users`** (Supabase Auth Table)
**Purpose**: Core authentication record

**Data for Ahmed Hassan:**
```sql
id: eabf0c22-4f61-4886-b2a4-74318697c8d4
email: ahmed.hassan1@student.school.com
email_confirmed_at: 2026-01-22 06:55:50.834048+00
created_at: 2026-01-22 06:55:50.794802+00
```

**Key Points:**
- This is the **root record** - all other tables reference this `id`
- Managed by Supabase Auth (not directly in `public` schema)
- Contains encrypted password, email confirmation status
- The `id` (UUID) becomes the primary key for all related records

---

### 2. **`public.profiles`** 
**Purpose**: Extended user profile information

**Data for Ahmed Hassan:**
```sql
id: eabf0c22-4f61-4886-b2a4-74318697c8d4  (SAME as auth.users.id)
full_name: Ahmed Hassan
is_active: true
current_branch_id: NULL (can be set later)
created_at: 2026-01-22 06:55:51.162485+00
```

**Relationship:**
- `profiles.id` = `auth.users.id` (1:1 relationship)
- Foreign Key: `profiles.id` → `auth.users.id`
- This is a **one-to-one** relationship - each user has exactly one profile

**Why separate table?**
- `auth.users` is managed by Supabase and has limited fields
- `profiles` extends with custom fields (phone, address, date_of_birth, etc.)
- Allows adding school-specific profile data without modifying auth schema

---

### 3. **`public.user_branches`**
**Purpose**: Links users to branches (multi-branch support)

**Data for Ahmed Hassan:**
```sql
user_id: eabf0c22-4f61-4886-b2a4-74318697c8d4
branch_id: 04e1ae26-dbfe-4443-8e0f-2d50d6c68e6b (Main Branch)
is_primary: false
created_at: 2026-01-22 06:55:51.517391+00
```

**Relationship:**
- `user_branches.user_id` → `auth.users.id` (Many-to-One)
- `user_branches.branch_id` → `branches.id` (Many-to-One)
- This is a **many-to-many** relationship table
- A user can belong to multiple branches
- A branch can have multiple users

**Composite Primary Key:**
- Primary Key: `(user_id, branch_id)` - ensures a user can only be assigned to a branch once

---

### 4. **`public.user_roles`**
**Purpose**: Assigns roles to users per branch (RBAC)

**Data for Ahmed Hassan:**
```sql
user_id: eabf0c22-4f61-4886-b2a4-74318697c8d4
role_id: b67b3f85-ccf0-4270-9a85-f2e12236e6c5 (student role)
branch_id: 04e1ae26-dbfe-4443-8e0f-2d50d6c68e6b
```

**Relationship:**
- `user_roles.user_id` → `auth.users.id` (Many-to-One)
- `user_roles.role_id` → `roles.id` (Many-to-One)
- `user_roles.branch_id` → `branches.id` (Many-to-One)
- This is a **many-to-many-to-many** relationship
- A user can have different roles in different branches
- Example: Same user could be "student" in Branch A and "parent" in Branch B

**Composite Primary Key:**
- Primary Key: `(user_id, role_id, branch_id)` - ensures unique role assignment per branch

---

### 5. **`public.students`**
**Purpose**: Student-specific academic information

**Data for Ahmed Hassan:**
```sql
id: 44da107a-8b4c-4e71-b566-9facdb9ef587 (NEW UUID for student record)
user_id: eabf0c22-4f61-4886-b2a4-74318697c8d4 (links to auth.users)
branch_id: 04e1ae26-dbfe-4443-8e0f-2d50d6c68e6b (Main Branch)
student_id: 2026-Class 1-A-001 (unique identifier: year-class-section-sequence)
class_id: 2f1a9f54-5ff6-412c-9954-bdc8527061d1 (Class 1)
section_id: b3c92545-160c-4202-8eb5-4387a9edecbc (Section A)
academic_year_id: 17bb7c23-81d1-46ea-b356-fc4922f22b68 (2026-2027)
is_active: true
admission_date: 2025-12-23
created_at: 2026-01-22 06:55:52.182989+00
```

**Relationships:**
- `students.user_id` → `auth.users.id` (Many-to-One)
  - Note: Foreign key exists but may not be recognized by Supabase schema cache
- `students.branch_id` → `branches.id` (Many-to-One)
- `students.class_id` → `classes.id` (Many-to-One, nullable)
- `students.section_id` → `sections.id` (Many-to-One, nullable)
- `students.academic_year_id` → `academic_years.id` (Many-to-One)

**Key Constraints:**
- `UNIQUE(student_id, branch_id)` - ensures unique student ID per branch
- A user can have multiple student records (if they're a student in multiple branches)
- This is a **one-to-many** relationship: one user → many student records (across branches)

---

## 🔗 Complete Relationship Diagram

```
auth.users (id: eabf0c22-...)
    │
    ├───> profiles (id = auth.users.id)
    │       │
    │       └───> current_branch_id → branches.id (optional)
    │       └───> current_student_id → students.id (optional, for parents)
    │
    ├───> user_branches (user_id = auth.users.id)
    │       └───> branch_id → branches.id
    │
    ├───> user_roles (user_id = auth.users.id)
    │       ├───> role_id → roles.id
    │       └───> branch_id → branches.id
    │
    └───> students (user_id = auth.users.id)
            ├───> branch_id → branches.id
            ├───> class_id → classes.id
            ├───> section_id → sections.id
            └───> academic_year_id → academic_years.id
```

---

## 📝 Insertion Sequence (Step-by-Step)

### Step 1: Create Auth User
```sql
INSERT INTO auth.users (id, email, encrypted_password, ...)
VALUES (gen_random_uuid(), 'ahmed.hassan1@student.school.com', ...)
RETURNING id;  -- Returns: eabf0c22-4f61-4886-b2a4-74318697c8d4
```

### Step 2: Create Profile
```sql
INSERT INTO public.profiles (id, full_name, is_active, ...)
VALUES (
  'eabf0c22-4f61-4886-b2a4-74318697c8d4',  -- SAME as auth.users.id
  'Ahmed Hassan',
  true,
  ...
);
```

### Step 3: Assign to Branch
```sql
INSERT INTO public.user_branches (user_id, branch_id, is_primary)
VALUES (
  'eabf0c22-4f61-4886-b2a4-74318697c8d4',
  '04e1ae26-dbfe-4443-8e0f-2d50d6c68e6b',  -- Main Branch
  false
);
```

### Step 4: Assign Student Role
```sql
INSERT INTO public.user_roles (user_id, role_id, branch_id)
VALUES (
  'eabf0c22-4f61-4886-b2a4-74318697c8d4',
  'b67b3f85-ccf0-4270-9a85-f2e12236e6c5',  -- student role
  '04e1ae26-dbfe-4443-8e0f-2d50d6c68e6b'
);
```

### Step 5: Create Student Record
```sql
INSERT INTO public.students (
  user_id,
  branch_id,
  student_id,
  class_id,
  section_id,
  academic_year_id,
  is_active,
  admission_date,
  ...
)
VALUES (
  'eabf0c22-4f61-4886-b2a4-74318697c8d4',  -- Links to auth.users
  '04e1ae26-dbfe-4443-8e0f-2d50d6c68e6b',  -- Links to branches
  '2026-Class 1-A-001',                    -- Unique student ID
  '2f1a9f54-5ff6-412c-9954-bdc8527061d1',  -- Links to classes
  'b3c92545-160c-4202-8eb5-4387a9edecbc',  -- Links to sections
  '17bb7c23-81d1-46ea-b356-fc4922f22b68',  -- Links to academic_years
  true,
  '2025-12-23',
  ...
);
```

---

## 🔑 Key Relationships Summary

| Table | Primary Key | Foreign Keys | Relationship Type |
|-------|------------|--------------|-------------------|
| `auth.users` | `id` (UUID) | None | Root table |
| `profiles` | `id` (UUID) | `id` → `auth.users.id` | 1:1 with auth.users |
| `user_branches` | `(user_id, branch_id)` | `user_id` → `auth.users.id`<br>`branch_id` → `branches.id` | Many-to-Many |
| `user_roles` | `(user_id, role_id, branch_id)` | `user_id` → `auth.users.id`<br>`role_id` → `roles.id`<br>`branch_id` → `branches.id` | Many-to-Many-to-Many |
| `students` | `id` (UUID) | `user_id` → `auth.users.id`<br>`branch_id` → `branches.id`<br>`class_id` → `classes.id`<br>`section_id` → `sections.id`<br>`academic_year_id` → `academic_years.id` | One-to-Many (user can have multiple student records) |

---

## 🎯 Important Notes

1. **User ID is the Central Key**: The `auth.users.id` (UUID) is used as a foreign key in all related tables, creating a hub-and-spoke relationship pattern.

2. **Multi-Tenancy**: All tables (except `auth.users`) include `branch_id` to ensure data isolation per branch/tenant.

3. **Role-Based Access**: The `user_roles` table allows the same user to have different roles in different branches, enabling flexible permission management.

4. **Student ID Format**: The `student_id` field uses format `YYYY-Class-Section-Sequence` (e.g., `2026-Class 1-A-001`) and must be unique per branch.

5. **Cascading**: If a user is deleted from `auth.users`, related records in other tables should be handled via application logic (Supabase doesn't support CASCADE on cross-schema foreign keys).

---

## 🔍 Querying a Complete Student Record

To get all information for Ahmed Hassan:

```sql
SELECT 
    u.email,
    p.full_name,
    s.student_id,
    c.name as class_name,
    sec.name as section_name,
    ay.name as academic_year,
    b.name as branch_name,
    r.name as role_name
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
JOIN public.students s ON s.user_id = u.id
JOIN public.branches b ON b.id = s.branch_id
LEFT JOIN public.classes c ON c.id = s.class_id
LEFT JOIN public.sections sec ON sec.id = s.section_id
LEFT JOIN public.academic_years ay ON ay.id = s.academic_year_id
JOIN public.user_roles ur ON ur.user_id = u.id AND ur.branch_id = s.branch_id
JOIN public.roles r ON r.id = ur.role_id
WHERE u.email = 'ahmed.hassan1@student.school.com'
  AND s.branch_id = '04e1ae26-dbfe-4443-8e0f-2d50d6c68e6b';
```

This query joins all related tables to show the complete student profile.


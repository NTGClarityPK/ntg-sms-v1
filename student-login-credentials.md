# Student Login Credentials

## Password Storage in Supabase

### Where Passwords Are Stored

Passwords are stored in the **`auth.users`** table (Supabase Auth schema) in the `encrypted_password` column.

**Important Notes:**
- Passwords are **encrypted** using bcrypt hashing algorithm
- The `encrypted_password` column stores the hashed password, **NOT** the plain text
- You **cannot** retrieve the original password from the database
- Passwords can only be verified during login, not retrieved

### Password Location:
```
Schema: auth
Table: auth.users
Column: encrypted_password (encrypted with bcrypt)
```

---

## Student Login Credentials

### Default Password for All Seeded Students

**Password:** `Student@123`

This password was set when creating students via the seeding script (`backend/scripts/seed-students.ts`).

### Example Student Login Credentials

Here are some example students you can use to login:

| Student Name | Email | Password | Student ID |
|--------------|-------|----------|------------|
| Ahmed Hassan | `ahmed.hassan1@student.school.com` | `Student@123` | 2026-Class 1-A-001 |
| Fatima Ali | `fatima.ali2@student.school.com` | `Student@123` | 2026-Class 1-A-002 |
| Mohammed Ibrahim | `mohammed.ibrahim3@student.school.com` | `Student@123` | 2026-Class 1-B-003 |
| Layla Yusuf | `layla.yusuf6@student.school.com` | `Student@123` | 2026-Class 2-A-001 |
| Khalid Jamil | `khalid.jamil11@student.school.com` | `Student@123` | 2026-Class 3-A-001 |

**Email Pattern:** `firstname.lastnameX@student.school.com` (where X is a sequential number)

---

## How to Login as a Student

### Option 1: Via Frontend Login Page

1. Navigate to the login page: `http://localhost:3000/login`
2. Enter the student email (e.g., `ahmed.hassan1@student.school.com`)
3. Enter the password: `Student@123`
4. Click "Sign In"

### Option 2: Via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Users**
3. Find the student user by email
4. You can reset the password or view user details (but not the actual password)

---

## Password Security Notes

1. **Encryption**: All passwords are hashed using bcrypt before storage
2. **Cannot Retrieve**: You cannot see or retrieve the original password from the database
3. **Reset Only**: If you need to change a password, you must reset it (which will generate a new hash)
4. **Email Confirmed**: All seeded students have `email_confirmed_at` set, so they can login immediately

---

## Changing a Student Password

### Via Supabase Dashboard:
1. Go to **Authentication** → **Users**
2. Find the student user
3. Click on the user
4. Click "Reset Password" or "Send Password Reset Email"

### Via Code (Backend):
```typescript
// Reset password
await supabase.auth.admin.updateUserById(userId, {
  password: 'NewPassword@123'
});

// Or send password reset email
await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: 'http://localhost:3000/reset-password'
});
```

---

## Verifying Password Storage

You can verify that a password exists (but not see it) by checking:

```sql
SELECT 
    email,
    encrypted_password IS NOT NULL as has_password,
    email_confirmed_at IS NOT NULL as email_confirmed
FROM auth.users
WHERE email = 'ahmed.hassan1@student.school.com';
```

This will show:
- `has_password: true` - Password is set
- `email_confirmed: true` - Email is confirmed (can login)

---

## All Seeded Students (25 total)

All students use the same password: **`Student@123`**

You can find all student emails by querying:
```sql
SELECT email, full_name 
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
JOIN public.students s ON s.user_id = u.id
WHERE s.branch_id = '04e1ae26-dbfe-4443-8e0f-2d50d6c68e6b'
ORDER BY s.student_id;
```


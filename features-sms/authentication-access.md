# Authentication & Access

Complete guide to authentication and access flows in the NTG School Management System (SMS).

## 📋 Overview

SMS authentication is handled through **Supabase Auth** (email/password), with additional flows supported in the portal:

- Email/password login
- Google login (via backend OAuth endpoint)
- Password reset
- Branch selection during login (for multi-branch users)
- Child selection for parents (when multiple children exist)
- Optional PIN-based login on a device (where configured)

{% @mermaid/diagram content="graph TB
A[Login] --> B{Auth Method}
B --> C[Email/Password]
B --> D[Google OAuth]
B --> E[PIN Mode (Device)]
C --> F[Fetch User Context]
D --> F
E --> F
F --> G{Multi-branch?}
G -->|Yes| H[Select Branch]
G -->|No| I[Continue]
H --> I
I --> J{Parent with multiple children?}
J -->|Yes| K[Select Child]
J -->|No| L[Portal]
K --> L" %}

## 🔐 Login (Email/Password)

### Logging in

**Steps:**

1. Navigate to **Login**
2. Enter:
   * **Email**
   * **Password**
3. Click **Login**
4. If prompted, complete **Branch Selection**
5. If prompted (parent users), complete **Child Selection**

### Common outcomes

- If credentials are valid, you’ll be taken into the authenticated portal.
- If you don’t have access to a module, it won’t appear in the sidebar (permissions-driven).

## 🟦 Login (Google)

Google sign-in is initiated from the portal and redirects to the backend OAuth flow.

**Steps:**

1. Navigate to **Login**
2. Click **Sign in with Google**
3. Complete Google authentication
4. Return to the portal and complete branch selection if required

## 🔁 Password Reset

### Request reset link

**Steps:**

1. On **Login**, choose **Forgot password**
2. Enter your email
3. Submit to receive a reset link

### Set a new password

**Steps:**

1. Open the reset link
2. Enter a new password + confirm
3. Submit
4. After success, return to **Login**

## 🏫 Branch Selection

If your account is linked to multiple branches, the portal can prompt you to select a branch after login.

**What branch selection affects:**

- Operational data (students, attendance, requests, timetable, reports) is **branch-scoped**
- Your branch context is used for API calls (e.g. via `X-Branch-Id`)

## 👨‍👩‍👧‍👦 Child Selection (Parents)

Parents with multiple linked children can select the child context for child-specific views.

**Typical places you’ll see child context:**

- My Children
- Child timetable views
- Child attendance views

## 🔢 PIN Authentication (Device)

PIN authentication is an optional convenience mode intended for quick logins on a specific device.

**Key characteristics:**

- PIN data is stored **on the device**
- Too many incorrect attempts may temporarily lock PIN login on that device

## 🆘 Troubleshooting

### Common issues

**Cannot login (email/password):**

- Confirm email/password
- Ensure password is at least the required length
- Use password reset if needed

**Google login sends me to signup:**

- This typically indicates the Google account isn’t linked to an existing SMS user in the system.

**I can login but can’t see modules:**

- Confirm your assigned role(s) and permissions
- Confirm your branch selection (if applicable)
- Parents: confirm whether you’re in a child context


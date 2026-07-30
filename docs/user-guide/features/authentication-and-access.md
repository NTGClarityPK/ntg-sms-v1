# 🔐 Authentication & Access

Complete guide to authentication and access flows in NTG Alma.

## 📋 Overview

NTG Alma authentication is handled through **Supabase Auth** (email/password), with additional flows supported in the portal:

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

## 🌐 Portal Language After Login

The portal decides your language every time you log in, so you get the same language on a new device or in an incognito window.

**Order of precedence:**

1. **Your personal language**, if you have chosen one from the language button in the top bar
2. Otherwise, your school's **default language** (Settings → Business Information → Default language)
3. Otherwise, **English (UK)**

**Notes:**

- Before you log in (login and password reset screens), the portal shows **English (UK)** unless you have already changed the language on that browser.
- If you belong to branches in more than one school, selecting a branch also switches the language to that school's default — unless you have set a personal language.
- Arabic switches the portal to a right-to-left layout.

See [⚙️ Settings & Configuration](settings-and-configuration.md) for how to change the school default or your own language.

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

- This typically indicates the Google account isn’t linked to an existing NTG Alma user in the system.

**I can login but can’t see modules:**

- Confirm your assigned role(s) and permissions
- Confirm your branch selection (if applicable)
- Parents: confirm whether you’re in a child context

**The portal logs me in with the wrong language (e.g. Arabic in incognito):**

- Check the language button: if **Use school default** is ticked, the language comes from your school's default language setting
- To keep one language regardless of the school default, pick it explicitly from the language button
- Admins can change the school-wide default under **Settings → Business Information → Default language**


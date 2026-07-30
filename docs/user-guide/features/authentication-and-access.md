# 🔐 Authentication & Access

How people sign in, join a school, reset passwords, and use PIN or branch context in NTG Alma.

## 📋 Overview

| Method | Who it is for |
| --- | --- |
| Email / password | Staff, parents, and school admins |
| Google sign-in | Existing users linked to Google |
| Google signup | New school registration only |
| Invitation setup | Invited students, parents, and staff (`/setup?token=…`) |
| PIN on a device | Students (roll number + PIN) |

Child context for parents is chosen from the **header** after login — not during login. The legacy **Select child** login page is not part of the current flow.

---

## 🔐 Email / password login

1. Open **Login**.
2. Enter email and password (minimum **6** characters on this form).
3. Click **Login**.

If the account is inactive, you may see a message that an administrator must reactivate it.

After a successful login:

- **Super admin** → **Admin portal**
- **School admin** with more than one branch → **branch picker**, then portal
- Everyone else → portal with their branch chosen automatically (stored preference or first available branch)

---

## 🟦 Google

### Sign in

**Login → Sign in with Google** → complete Google → return to the portal. Branch picker appears only for multi-branch **school admins**.

If Google cannot match an existing Alma user, you are sent toward **signup** with a not-found hint.

### Sign up (new school)

**Sign up → Continue with Google** runs the school registration wizard (school, branch, academic year, admin details), then OAuth. This creates a tenant — it is not the same as everyday Google login.

---

## ✍️ Signup (email path)

**Sign up** uses a five-step wizard:

1. **School information**
2. **Branch information**
3. **Academic year**
4. **Admin account** (email path: password minimum **6** characters)
5. **Review** → Create account

---

## ✉️ Invitation setup

Invited users open **`/setup?token=…`** (from their invitation email). Types include student, parent, and staff. Admins resend from **Users** when status is **Link expired** — see [👥 User Roles](user-roles.md).

1. Token is validated.
2. Set a password — minimum **8** characters, with at least one letter and one number.
3. Note the **Login email** shown on success, then **Go to login**.

---

## 🔁 Password reset

1. **Login → Forgot password**.
2. Enter the email you use for Alma.
3. Success: reset mail is sent to that address.
4. If Alma has **no associated email** for the account, you may confirm sending the link to the address you typed.

Open the link → set a new password → return to **Login**.

---

## 🏫 Branch context

| Situation | Behaviour |
| --- | --- |
| School admin, multiple branches | Picker after login; **Switch Branch** in the user menu anytime |
| Other roles | Branch selected automatically; header may show a read-only **Current branch** badge |
| Super admin | Admin portal — no school branch picker |

Branch context scopes students, attendance, fees, timetable, and most operational data.

---

## 👨‍👩‍👧 Child context (parents)

Parents with more than one linked child use the **header child switcher** (**Select child** / **Acting as {name}**). That switches the session to the chosen student for child-specific screens.

Do **not** rely on `/select-child` — it is a legacy page and is not used after login.

Typical child-aware areas: **My Child**, child attendance, child timetable.

---

## 🔢 PIN Management and PIN login

### PIN Management (parents)

**Path:** Sidebar → **PIN Management**

- Set, change, or remove a **parent PIN** stored on this device
- For each child: set, change, or remove a **child PIN** (child school credentials may be required first)

### PIN login (students)

On **Login**, if this device has PIN mode enabled:

1. Choose **Log in with PIN**.
2. Enter **student roll number** and **4–6 digit PIN**.

PIN login is **roll number only** — not parent email. Parent PINs on the device do not replace student roll-number login.

Too many wrong attempts can temporarily lock PIN login on that device.

---

## 🌐 Language after login

Order of preference:

1. Your personal language (language control in the top bar)
2. Else the school **default language** (**Settings → Business Info**)
3. Else **English (UK)**

Arabic uses a right-to-left layout. Before login, screens default to English (UK) unless you already changed language on that browser.

---

## 💡 Tips & Best Practices

- Keep invitation passwords to the stricter **8+** rule; everyday login forms still accept **6+**.
- School admins with several campuses should use **Switch Branch** rather than separate accounts.
- Parents: set child PINs on shared classroom devices; students still log in with roll number.

---

## 🆘 Troubleshooting

**Google sends me to signup:** The Google account is not linked to an existing Alma user — use invitation setup or ask an admin.

**I am in the portal but modules are missing:** Check role permissions and branch; parents check child context in the header.

**Wrong language:** Turn off “use school default” and pick a language, or ask an admin to change **Business Info → Default language**.

**PIN login rejects my email:** Use the student’s **roll number**, not a parent email.

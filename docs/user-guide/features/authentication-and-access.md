# 🔐 Authentication & Access

How people sign in to NTG Alma, join a school, reset a password, pick a campus, and use PIN login for students.

## 📋 Overview

| How you sign in | Who it is for |
| --- | --- |
| Email and password | Staff, parents, and school admins |
| Google sign-in | People who already have an Alma account linked to Google |
| Google signup | Registering a **new school** only |
| Invitation link | Students, parents, and staff invited by the school |
| PIN on a device | Students (roll number + short PIN) |

Parents with more than one child choose which child to view **after** login, from the top of the screen — not on the login page itself.

---

## 🔐 Email / password login

1. Open **Login**.
2. Enter your email and password (at least **6** characters on this form).
3. Click **Login**.

If the account is switched off, you may see a message that an administrator must turn it back on.

After a successful login:

- **School admin** with more than one campus (branch) → you pick which campus to open, then enter the portal
- **Everyone else** → you go straight into the portal; Alma picks your campus for you (your last choice, or the first one available)

---

## 🟦 Google

### Sign in

On **Login**, choose **Sign in with Google**, finish Google’s steps, and return to Alma. You only see a campus picker if you are a **school admin** with more than one campus.

If Google cannot find a matching Alma user, you are guided toward **signup** with a short “not found” hint. Everyday staff and parents usually need an invitation instead — ask your school admin.

### Sign up (new school)

**Sign up → Continue with Google** starts the school registration steps (school, campus, academic year, admin details), then finishes with Google. That **creates a new school** in Alma. It is not the same as signing in day to day with Google.

---

## ✍️ Signup (email path)

**Sign up** walks you through five steps:

1. **School information**
2. **Branch information** (your first campus)
3. **Academic year**
4. **Admin account** (password at least **6** characters)
5. **Review** → Create account

---

## ✉️ Invitation setup

When the school invites you, you receive an email with a link. Open that link to finish creating your password.

Invitation types include student, parent, and staff. If the link has expired, an admin can resend it from **Users** when the status shows **Link expired** — see [👥 User Roles](user-roles.md).

1. Alma checks that your invitation is still valid.
2. Set a password — at least **8** characters, with at least one letter and one number.
3. Note the **Login email** shown when you finish, then choose **Go to login**.

---

## 🔁 Password reset

1. On **Login**, choose **Forgot password**.
2. Enter the email you use for Alma.
3. If everything is fine, a reset email is sent to that address.
4. If Alma has no email on file for that account, you may be asked to confirm sending the link to the address you typed.

Open the link in the email → choose a new password → return to **Login**.

---

## 🏫 Which campus you are viewing (branch)

A **branch** is one campus or site of your school. Much of what you see (students, attendance, fees, timetable, and similar) belongs to the campus you are currently viewing.

| Your situation | What happens |
| --- | --- |
| School admin with several campuses | After login you pick a campus; later you can use **Switch Branch** in the user menu anytime |
| Other roles | Alma selects your campus automatically; the top of the screen may show a read-only **Current branch** badge |

---

## 👨‍👩‍👧 Which child you are viewing (parents)

If you are a parent linked to more than one child, use the child switcher in the **header** (top of the portal). It may say **Select child**, or **Acting as** followed by that child’s name. Changing it updates what you see on child-specific screens such as **My Child**, attendance, and timetable.

---

## 🔢 PIN Management and PIN login

### Why PIN login exists

For younger students, typing an email and password again and again on a shared classroom computer is awkward. A parent (or carer) can set a short PIN on **that device**. The student then signs in with their **roll number** and PIN — without using the parent’s email or a full password each time.

PINs are stored on **this browser or device** through **PIN Management**. They are not a school-wide password replacement. Another computer will not know the PIN until someone sets it there too.

### PIN Management (parents)

**Path:** Sidebar → **PIN Management**

- Set, change, or remove a **parent PIN** on this device
- For each child: set, change, or remove a **child PIN** (you may need to confirm the child’s school login details first)

### PIN login (students)

On **Login**, when this device has PIN mode available:

1. Choose **Log in with PIN**.
2. Enter the student’s **roll number** and a **4–6 digit PIN**.

Use the student’s roll number only — not a parent email. Parent PINs on the device do not replace student roll-number login.

Too many wrong attempts can temporarily lock PIN login on that device.

---

## 🌐 Language after login

Alma chooses language in this order:

1. Your personal language (language control in the top bar)
2. Otherwise the school **default language** (**Settings → Business Info**)
3. Otherwise **English (UK)**

Arabic uses a right-to-left layout. Before you log in, screens default to English (UK) unless you already changed language on that browser.

---

## 💡 Tips & Best Practices

- Invitation setup needs the stricter **8+** password rule; everyday login forms still accept **6+**.
- School admins with several campuses should use **Switch Branch** rather than separate accounts.
- Parents: set child PINs on the shared classroom devices students actually use; students still log in with roll number + PIN.

---

## 🆘 Troubleshooting

**Google sends me to signup:** That Google account is not linked to an existing Alma user. Use your invitation link, or ask an admin to invite you.

**I am in the portal but modules are missing:** Check your role and which campus you are on. Parents: check which child is selected in the header.

**Wrong language:** Turn off “use school default” and pick a language, or ask an admin to change **Business Info → Default language**.

**PIN login rejects my email:** Use the student’s **roll number**, not a parent email.

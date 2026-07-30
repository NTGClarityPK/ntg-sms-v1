# 📖 User Manual

Complete user manual for school administrators, staff, parents, and students using the **NTG Alma**.

## 🎯 Introduction

Welcome to the NTG Alma! This manual will guide you through using the portal for day-to-day school operations and stakeholder workflows.

### Who This Manual Is For

**School Owners / Administrators:**

* 🏢 **School Admin / Principal / Academic Coordinator** - Configure the school, manage academic structure, oversee operations, and access reports

**School Staff:**

* 👨‍💼 **Administrative Staff** - Support operational workflows (students, staff, attendance support, reports) based on assigned permissions
* 👨‍🏫 **Teachers** - Attendance, assessments, behavioural entries, timetable and schedule views (role-based)
* 🧑‍⚕️ **Guidance Counsellor** - Behavioural modules and related reporting (role-based)

**Parents & Students:**

* 👨‍👩‍👧‍👦 **Parents** - Child context, attendance views, requests (leave/early departure), notifications, uniform requests (where enabled)
* 🎓 **Students** - Timetable/schedule views, notifications, and permitted student pages

### System Overview

The system helps you manage:

* 🏢 School (tenant) and branch setup
* 👥 Users, roles, and permissions-based access
* 🎓 Students, parents, and staff operations
* 🗓️ Timetables, schedules, and conflict management
* ✅ Attendance and attendance history
* 📝 Assessments, grades, and statistics (role-based)
* ⭐ Behavioural tracking and assessment entry (role-based)
* 📨 Notifications and messaging
* 📚 Library access (where enabled)
* 📦 Inventory (uniform items, requests, and history where enabled)
* 📊 Reports and results
* ⚙️ Settings and configuration (academic year, lookups, schedule, assessment, communication, behaviour, permissions, theme)

***

## 🏢 For School Admins (Owners / Principals / Coordinators)

### 🚀 Getting Started - Sign Up

#### Creating Your School Account

NTG Alma supports creating a new school (tenant) from the **Signup** page.

**Steps:**

1. Navigate to the **Signup** page
2. Choose a signup method:
   * **Email signup** (create admin credentials)
   * **Google signup** (continue with Google and finish setup)
3. Fill in school and branch information:
   * **School Name**
   * **School Code** and **School Domain** (as required by the form)
   * **Branch Name** and branch contact details
4. Create the first admin user:
   * **Full Name**
   * **Email** (for email signup)
   * **Password** (for email signup)
5. Complete signup

**Sign up with Google:**

* You can start signup with Google; the portal redirects to the backend Google OAuth flow and returns to the portal to complete setup.

{%
@mermaid/diagram
content="graph LR
A[Sign Up] --> B[School + Branch Details]
B --> C[Admin Account]
C --> D[Account Created]
D --> E[Login]
E --> F[Branch Context]
F --> G[Portal Ready]"
%}

***

### 🏗️ Initial Setup

This section describes the recommended setup order using NTG Alma settings and academic structure pages.

#### Step 1: School Information (Tenant / Business Information)

**Steps:**

1. Login to the portal
2. Go to **Settings**
3. Open the **Business Information** area (where available)
4. Review and update the school name and related organisation details
5. Under **Business Settings**, set the **Default language** for your school — **English (UK)**, **English (US)**, or **Arabic**
6. Save changes

**About Default language:**

* This is the language every user sees unless they pick their own from the language button in the top bar.
* New schools start on **English (UK)**. Set it to **Arabic** if your staff should see Arabic (and a right-to-left layout) by default, including on a fresh login or in an incognito window.
* Users who have already chosen a personal language keep their choice; changing the school default does not affect them.

#### Step 2: Create and Activate Academic Year

**Steps:**

1. Go to **Settings** → **Academic Years**
2. Create the academic year
3. Mark the correct year as **Active**
4. Use **Locked** state only when the year is finalised (admin flow)

#### Step 3: Configure Academic Structure (Core Lookups)

**Core lookups available in Settings include:**

* Subjects
* Classes
* Sections
* Levels
* Level ↔ Class mapping

**Steps:**

1. Go to **Settings** → **Academic**
2. Create/update subjects, levels, classes, and sections
3. Assign classes to levels using the level/class mapping

#### Step 4: Configure Schedule & Holidays

**Settings include:**

* School days
* Timing templates (per level)
* Class timing assignments
* Public holidays

**Steps:**

1. Go to **Settings** → **Schedule**
2. Configure school days and timing templates
3. Add holidays to the holiday calendar

#### Step 5: Configure Assessment & Grading

**Settings include:**

* Assessment types
* Grade templates and grade ranges
* Class ↔ grade template assignments
* Leave quota (used by leave request workflow)

**Steps:**

1. Go to **Settings** → **Assessment**
2. Create assessment types and grade templates
3. Assign grade templates to classes
4. Configure leave quota as required by policy

#### Step 6: Configure Communication / Behaviour / Permissions / Theme

**Steps:**

1. Go to **Settings** → **Communication** (directions and related configuration)
2. Go to **Settings** → **Behaviour** (behavioural configuration)
3. Go to **Settings** → **Permissions** (role-based feature access)
4. Go to **Theme Settings** (appearance)

***

### 🏢 School Management

#### Managing School Information

Use the Settings area to manage school-level business information and global configuration, including the tenant name shown in the header.

#### Managing Branches

NTG Alma is multi-branch. Users can belong to one or more branches, and the branch context affects all operational data.

Key concepts:

* Branch context is reflected by request headers (e.g. `X-Branch-Id`) and the selected current branch in the portal.
* Branch membership is enforced in the backend.

***

### 👥 User, Staff, and Student Management (For Admins)

#### Managing Users

Use the **Users** page to view and manage system users (role-based and permission-based visibility).

#### Managing Staff

Use the **Staff** area to:

* View staff list
* View a staff member’s schedule (and “My Schedule” for the logged-in teacher)

#### Managing Students

Use the **Students** area to:

* View and manage students
* Use **Bulk Import** where enabled to import students in bulk

#### Managing Parent–Student Associations

Use **Parent Associations** to:

* Link/unlink parents to student records
* Enable parent-facing child selection and child context

***

### 🗓️ Academic Structure & Teacher Mapping (For Admins)

#### Managing Class Sections

Class sections represent a class/section instance in a branch and academic year. Use the **Class Sections** page to create and manage them, including assigning class teachers where permitted.

#### Managing Teacher Mapping / Assignments

Use **Teacher Mapping** to map staff to subjects and class sections (co-teaching supported where enabled by the mapping UI).

***

### ✅ Attendance (Admin Oversight)

Use the Attendance pages to:

* View attendance
* Review attendance history
* Support staff workflows for marking attendance (role-based access)

***

### 📝 Assessments & Grading (Admin Oversight)

Use the Assessments pages to:

* Create and manage assessments
* Review assessment statistics and grades pages

***

### 🗓️ Timetable & Conflict Management (Admin Oversight)

Use timetable pages to:

* View timetable data
* Resolve conflicts using **Conflict Management** (where surfaced by the portal)

***

### ⭐ Behavioural (Admin Oversight)

Use behavioural pages to:

* View behavioural overview
* Support assessment entry workflows (role-limited)

***

### 🏫 Leaves & Early Departure (Admin Oversight)

Use these pages to:

* Review leave requests (approve/reject) and manage statuses
* Review early departure requests (approve/reject)

***

### 📅 Events (Admin Oversight)

Use events pages to:

* Create, edit, and manage events
* View event details

***

### 📨 Notifications (Admin Oversight)

Notifications are available via:

* Notification bell in the header (unread count + quick list)
* Notifications page with tabs (All / Unread / Read / Attendance)

***

### 📊 Reports & Results (For Admins)

Use the Reports and Results areas for:

* Student and class reports
* Administrative reports
* Public statistics pages (branch code based route)
* Results page

***

### ⚙️ Settings Configuration

#### General Settings

Use the Settings module to configure:

* Academic years
* Academic lookups (subjects/classes/sections/levels)
* Schedule and holidays
* Assessment and grading templates
* Communication and behavioural configuration
* Permissions and theme settings

#### Updating Settings

In most settings pages:

1. Navigate to the relevant tab
2. Create or edit an item
3. Save
4. Confirm changes reflect across the portal modules affected by that setting

***

### 🌐 Multi-Language Setup

#### Activating Languages

The portal supports internationalisation and can run in **LTR** and **RTL** layouts depending on the selected language/locale.

#### Managing Translations

Text is translated using the project’s `next-intl` messages. Locale selection is stored and applied across the portal.

***

### 🎨 Theme Customization

#### Customizing Appearance

The portal uses a central theme system; theme changes apply consistently across pages (header, sidebar, tables, inputs, etc.) using Mantine theming and the project’s theme configuration.

***

### 🔐 Security & Access Control

#### Understanding Dynamic Roles & RBAC

Access is permission-driven:

* Users can have one or more roles
* The portal navigation only shows modules the user can view
* Backend checks the authenticated user and branch context on protected endpoints

#### Multiple Roles & Permission Union

If a user has multiple roles, the available access is the union of the permissions granted by those roles.

#### Managing User Access

Use **Settings → Permissions** to manage feature access by role (where enabled).

#### Viewing Current Access

If you can’t see a module:

* Confirm your role assignments
* Confirm permissions for the current role(s)
* Confirm you are in the correct branch context

#### Troubleshooting Access Issues

See the Troubleshooting section for common permission and visibility issues.

#### Account Security

* Use strong passwords
* Avoid sharing accounts
* Use sign out on shared devices

#### Security Best Practices

* Keep admin accounts limited to required staff
* Review permissions periodically
* Keep branch memberships accurate

***

### 📋 Initial Setup Checklist

Use this checklist to validate the system is ready:

1. Academic year created and active
2. Academic structure configured (subjects/classes/sections/levels)
3. Class sections created
4. Teacher mapping completed (as needed)
5. Schedule configured (school days, timings, holidays)
6. Assessment types/templates configured
7. Permissions configured
8. Key operational modules validated (attendance, timetable, assessments, leaves, notifications, reports)

***

### 🎓 Admin Training Guide

#### Week 1: Setup

* Academic year, settings, and academic structure
* Class sections and teacher mapping
* Timetable basics and conflict management

#### Week 2: Operations

* Attendance workflow
* Assessments and grading workflow
* Leaves and early departure workflow
* Notifications usage
* Reports and results usage

***

## 👨‍💼 For School Staff (Teachers / Admin Staff)

### 🚀 Getting Started

### First Time Login

**Steps:**

1. Open the portal
2. Login using email/password, Google login (if enabled for your account), or PIN mode (if available on your device)
3. Select a branch if prompted
4. Confirm you can see the modules you need in the sidebar

### Dashboard Overview

The dashboard provides a starting point for your role. Available widgets and links depend on permissions.

### Navigation

Use the left sidebar to access modules. Visibility is role-based:

* Teachers typically see “My Schedule”, “My Timetable”, and teaching-related modules
* Administrative staff see operational and configuration modules based on assignment

***

## ✅ Attendance

### Viewing Attendance

Use the Attendance page to view attendance for your permitted scope (class/section/child context).

### Attendance History

Use Attendance History to view historical records and trends for the permitted scope.

### Marking Attendance

If your role allows it, use the Attendance Mark page to mark attendance for a class section.

***

## 📝 Assessments

### Viewing Assessments

Use Assessments to view assessments relevant to your role and permissions.

### Creating / Editing Assessments

If enabled, teachers and coordinators can create/edit assessments from the Assessments pages.

### Grades & Statistics

Use the assessment Grades and Statistics pages to review grading and performance details for an assessment.

### My Assessments

Teachers can use “My Assessments” where available to view assessments relevant to their assignments.

***

## 🗓️ Timetable & Schedule

### My Schedule

Use **My Schedule** to view your personal schedule (teachers).

### My Timetable

Use **My Timetable** to view your timetable view (role-based).

### Timetable

Use Timetable pages to view class and school timetables depending on your access.

### Conflict Management

Use Conflict Management to review and resolve timetable-related conflicts where your role permits it.

***

## ⭐ Behavioural

### Behavioural Overview

Use Behavioural pages to view behavioural information accessible to your role.

### Behavioural Assessment Entry

If enabled, use the Behavioural Assess page to submit behavioural assessments.

***

## 🏫 Leaves & Early Departure

### Viewing Requests

Staff can view requests in their branch (role-based).

### Approving / Rejecting Requests

If you have the reviewer permission, you can approve or reject:

* Leave requests
* Early departure requests

***

## 📅 Events

### Viewing Events

Use Events to view event listings and details.

### Creating / Editing Events

If enabled for your role, you can create and edit events.

### My Events

Use My Events to view events relevant to you.

***

## 📨 Notifications

### Viewing Notifications

Use the Notifications page tabs:

* All
* Unread
* Read
* Attendance

### Marking Notifications as Read

Use “Mark all read” where available to clear unread items after review.

***

## 💬 Messages

Use Messages to view and manage your portal messages (module availability depends on permissions and rollout).

***

## 📚 Library

Use Library to access content made available to your role (module availability depends on rollout).

***

## 📦 Inventory (Uniforms)

Inventory pages may include:

* Items
* Requests
* History

Access is role-based.

***

## 📊 Reports & Results

### Viewing Reports

Use Reports to access student/class/administrative reports according to your role.

### Exporting Reports

Exports (where available) may include PDF or Excel formats depending on the report.

***

## ⚙️ Settings & Configuration

### Profile Settings

Use Profile to review your account details.

### Branch Selection

If you are assigned to multiple branches, you may be prompted to select a branch and/or switch branch context (depending on access).

### Language Selection

Use the language button in the top bar (globe icon) to choose your language. Supported options are **English (UK)**, **English (US)**, and **Arabic** (Arabic also switches the portal to a right-to-left layout).

The button also offers **Use school default**, which removes your personal choice so you follow whatever your school has configured under **Settings → Business Information → Default language**.

**How your language is decided:**

1. Your own choice, if you have made one
2. Otherwise, your school's default language
3. Otherwise, English (UK)

Your personal choice is saved to your profile, so it applies on any device or browser once you log in. If you have not made a personal choice, you follow the school default — including in incognito windows.

***

## 🔍 Common Tasks

### Daily Opening Checklist

* Confirm you’re in the correct branch
* Review notifications
* Review today’s schedule/timetable (teachers)
* Check operational queues (requests/events/assessments) based on your role

### Taking Attendance (Teacher)

1. Open Attendance
2. Select class section (where required)
3. Mark attendance
4. Save and confirm

### Reviewing Leave / Early Departure Requests (Reviewer)

1. Open Leaves or Early Departure
2. Filter to Pending
3. Review details
4. Approve or reject with notes (where supported)

### End of Day Tasks

* Confirm attendance completion (where applicable)
* Review pending requests
* Check notifications and close out urgent items

***

## 🆘 Troubleshooting

### Common Issues

**Cannot Login:**

* Verify email and password
* If using Google login, ensure your account exists in the system
* If using PIN mode, confirm the device PIN setup is available for your account
* Use “Reset Password” if required

**I can’t see a module in the sidebar:**

* Your role/permissions may not include access
* Confirm you selected the correct branch (if prompted)
* Parents: confirm whether you are acting as a child (child context changes visible items)

**No data or incorrect data:**

* Confirm branch context
* Confirm the active academic year is set (admin responsibility)

**The portal is in the wrong language:**

* Open the language button in the top bar and check which option is ticked
* If **Use school default** is ticked, the language comes from your school's **Default language** setting — pick a language explicitly to override it
* Admins: change the school-wide default under **Settings → Business Information → Default language**

### Getting Help

If the issue persists:

* Capture the page name and what you were trying to do
* Contact the school administrator or NTG Alma support team

***

## 💡 Tips & Best Practices

### Attendance & Requests

* Mark attendance promptly to reduce downstream reporting gaps
* Review leave and early departure requests within policy timeframes

### Permissions & Branch Context

* Most “missing module” issues are due to permissions or branch context
* Confirm your active context before reporting issues

### Efficiency Tips

* Use notifications to keep track of workflow outcomes
* Teachers should check “My Schedule” daily

***

## 📱 Mobile Usage

### Mobile Browser Access

The portal can be accessed via mobile browser. Layout adapts based on screen size.

### Mobile Optimized Features

* Responsive navigation
* Sidebar collapses for smaller screens

***

## 🔐 Security

### Account Security

* Use strong passwords
* Do not share accounts
* Logout on shared devices

### PIN Authentication

If PIN mode is enabled and set up on your device:

* PIN sessions are stored per device and used for quicker login
* Too many failed attempts may lock PIN login temporarily (device-side)
* If PIN data becomes corrupted on the device, you may need to set up PIN again

### Data Privacy

* Branch context isolates data across branches
* Only access data you are authorised to view

***

## 📞 Quick Reference

### Attendance Statuses (Typical)

* Present
* Absent
* Late / Excused (where implemented in your school’s configuration)

### Request Statuses

**Leave Requests:**

* Pending
* Approved
* Rejected
* Cancelled (where applicable)

**Early Departure Requests:**

* Pending
* Approved
* Rejected

### Notifications Tabs

* All
* Unread
* Read
* Attendance

***

## 🎓 Training Resources

### For New Users

* Start with the Introduction and Navigation sections
* Review the module(s) you use daily (attendance, timetable, assessments, requests)

### Role-Specific Guides

* Admins: Settings, Academic Structure, Teacher Mapping, Reports
* Teachers: Attendance, My Schedule, Assessments
* Parents: My Children, Leaves/Early Departure, Notifications, Uniform Requests

***

## 📝 Notes

* Feature visibility is role-based and can vary by branch and permissions configuration.
* Some modules may be enabled gradually by rollout and by branch policies.

***

## 📚 Additional Resources

### For School Admins

* Settings reference
* Academic structure and teacher mapping guide
* Reports catalogue

### For School Staff

* Attendance quick guide
* Timetable and “My Schedule” guide
* Requests review guide


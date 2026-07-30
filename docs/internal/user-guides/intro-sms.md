# Introduction

Welcome to the **NTG School Management System (SMS) User Documentation**! This space contains guides and manuals for school administrators, teachers, parents, and students using the NTG SMS portal.

## 📚 What's in This Space

This documentation space covers:

* **User Manual** - Complete guide for day-to-day portal usage
* **Feature Guides** - Detailed guides for each implemented module
* **Operational Procedures** - Step-by-step workflows (admin setup + staff operations)
* **Troubleshooting** - Common issues and solutions

## 🚀 Quick Start

### For School Admin / Principal / Academic Coordinator

1. Start with **User Manual** - First login, navigation, and how permissions work
2. Go to **Settings** - Configure academic years, academic structure, schedule, assessments, communication, behaviour, and permissions
3. Set up **Academic Structure** - Create class sections and map teachers (teacher mapping)
4. Review **Operations** - Attendance, assessments, timetable, events, notifications, reports

### For Teachers (Class Teacher / Subject Teacher)

1. Start with **User Manual** - Portal navigation and role visibility
2. Use **My Schedule** - View your schedule
3. Use **Assessments / My Assessments** - View and manage assessment-related work (where permitted)
4. Use **Attendance** - View/mark attendance (where permitted)
5. Use **Behavioural** - Submit behavioural assessments (role-based)

### For Parents

1. Start with **User Manual** - Login, branch selection (if shown), and notifications
2. Go to **My Children** - Manage your child context and access child-specific views
3. Use **Leave Requests** - Raise/cancel leave requests and view approvals/rejections
4. Use **Early Departure** - Raise early departure requests and view review outcomes
5. Use **Notifications** - Track updates and mark as read
6. Use **Uniform Request** - Raise uniform requests (inventory workflow)

### For Students

1. Start with **User Manual** - Login and navigation
2. Use **My Timetable** - View timetable
3. Use **Attendance** - View attendance (where available in student context)
4. Use **Notifications** - Track updates

## 📖 Documentation Structure

```text
sms/
├── intro-sms.md                  # This file
├── user-manual.md                # Complete user manual
└── features/                     # Feature-specific guides
    ├── authentication.md         # Login, reset password, branch selection, PIN auth (if enabled)
    ├── portal-navigation.md      # Sidebar, permissions-driven visibility, acting-as-child mode
    ├── settings.md               # Academic years, academic/schedule/assessment settings, permissions, theme
    ├── students.md               # Students management + bulk import
    ├── staff.md                  # Staff listing + schedules
    ├── parent-associations.md    # Parent–student linking
    ├── attendance.md             # Attendance mark/view + history + child view
    ├── assessments.md            # Assessments create/edit + grades + statistics + my assessments
    ├── timetable.md              # Timetable + my timetable + children timetable + conflict management
    ├── behavioural.md            # Behavioural overview + assess flow
    ├── leaves.md                 # Leave requests workflow
    ├── early-departure.md        # Early departure workflow
    ├── events.md                 # Events list/create/view/edit + my events
    ├── notifications.md          # Notifications page + bell + unread counts + mark all read
    ├── messages.md               # Messages module entry
    ├── library.md                # Library module entry
    ├── inventory-uniforms.md     # Inventory items/requests/history + uniform request
    ├── reports.md                # Reports (student/class/admin) + public statistics
    ├── results.md                # Results module entry
    ├── storage.md                # Storage admin page
    └── audit-trail.md            # Admin audit trail pages
```

## 🎯 Documentation Sections

### **User Manual**

Complete guide for all users:

* **Getting Started** - First-time login, portal navigation, language (LTR/RTL), and common UI patterns
* **Roles & Permissions** - What you can see/do depends on assigned roles and permissions
* **Branch Context** - How branch selection impacts data visibility (branch-aware portal + API)
* **Notifications** - Read/unread, tabs, and “mark all read”
* **Offline Documents (PWA)** - Offline-friendly area for documents (where available)
* **Profile** - User profile basics
* **Troubleshooting** - Common issues and fixes

### Feature Guides

#### **Settings**

Admin-facing configuration:

* Academic years (active/locked)
* Academic structure settings
* Schedule settings
* Assessment settings
* Communication and behaviour settings
* Permissions settings
* Theme settings

#### **Academic Structure**

* Class sections
* Teacher mapping / assignments
* Subject templates

#### **Attendance**

* Attendance view + history
* Attendance marking (where permitted)
* Child attendance view (parent/student context)

#### **Assessments**

* Assessment list, create, edit
* Grades and statistics pages
* “My assessments” view

#### **Timetable**

* Timetable pages (including class-specific view)
* My timetable / my schedule
* Children timetable
* Conflict management

#### **Leaves & Early Departure**

* Leave request lifecycle: raise → review → approve/reject → cancel (where allowed)
* Early departure request lifecycle: raise → review → approve/reject

#### **Events**

* Events list, create, view, edit
* My events

#### **Inventory (Uniforms)**

* Inventory module pages (items/requests/history)
* Uniform request workflow (parent-facing)

#### **Reports & Results**

* Reports pages (student/class/administrative)
* Public statistics route (branch code based)
* Results page

## 🎯 Finding Information

### By Role

**School Admin / Principal / Academic Coordinator:**

* User Manual - Admin and configuration sections
* Settings
* Students / Staff / Users
* Academic Structure (class sections, teacher mapping)
* Timetable and conflict management
* Reports and storage

**Teachers:**

* User Manual - teacher operations
* My schedule / my timetable
* Attendance (where permitted)
* Assessments / my assessments
* Behavioural assess flow (where permitted)

**Parents:**

* User Manual - parent flows + acting-as-child mode
* My children
* Leave requests and early departure
* Notifications
* Uniform request

**Students:**

* User Manual - student navigation
* My timetable
* Attendance view (where available)
* Notifications

### By Task

**Initial School Setup (Admin):**

1. Create/activate academic year
2. Configure academic structure (classes/sections/levels)
3. Create class sections and map staff (teacher mapping)
4. Configure timetable and schedule rules
5. Configure assessment settings and templates
6. Configure permissions and theme settings

**Daily Operations (Staff):**

* Mark/view attendance
* Manage assessment workflows
* Track timetable/schedule
* Review leave and early departure requests (where permitted)
* Use notifications to track updates

## 📝 Quick Reference

### Common Tasks

**Logging In:**

1. Open the portal
2. Login using email/password (or PIN mode if enabled)
3. Select a branch if prompted
4. Navigate via sidebar modules

**Switching Child Context (Parent):**

1. Go to My Children
2. Select a child
3. Use child-specific pages (timetable/attendance as available)

**Raising a Leave Request (Parent):**

1. Go to Leaves
2. Select child
3. Enter leave period and reason
4. Submit and track status

## 🆘 Troubleshooting

### Common Issues

**Cannot Login:**

* Confirm email and password are correct
* If PIN mode is enabled, ensure the identifier and PIN are correct
* Try password reset if needed

**I can’t see a module in the sidebar:**

* Your role/permissions may not include access to that feature
* Confirm your current role context (and child context for parents)

**No data showing / wrong data showing:**

* Confirm you are in the correct branch (branch context affects all data)

## 💡 Tips & Best Practices

### Permissions & Branch Context

* If something is missing, check **role permissions** and **current branch**
* Parents should check whether they are acting as a child (child context changes what appears)

## 🔐 Security

### Account Security

* Use strong passwords
* Do not share credentials
* Logout when finished on shared devices

## 📞 Support

For questions or issues:

* Check the relevant feature guide
* Review troubleshooting steps
* Contact your school administrator or the SMS support team

## 🔄 Documentation Updates

This documentation is updated as the SMS evolves:

* New modules and workflows
* Bug fixes and behaviour changes
* UX improvements and performance optimisations

***

**Start Here:** User Manual


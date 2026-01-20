## School Management System – Project Context

### 1. Project Purpose
This system is a multi-tenant School Management System that centralizes academics, communication, attendance, events, inventory, and reporting for K–12 schools. It serves all key stakeholders (students, parents, teachers, coordinators, counselors, admins, principals) with role-based dashboards and workflows, while supporting multiple independent branches per school with strict data isolation.

### 2. User Roles & High-Level Permissions
- **Parent / Guardian**: Views children’s academics, attendance, events, notifications, reports, and inventory history; can request leaves, early departures, and uniforms; participates in messaging and event consent flows but has no system configuration access.
- **Student**: Views own timetable, assessments, grades, reports, attendance, events, notifications, messages, and library/resources; limited or no access to configuration, mappings, or sensitive admin data.
- **Principal**: Broad view/edit access across academic content, communication, attendance, events, reports, and behavior analytics; can view or configure many features, including high-level reporting and some system-wide settings.
- **School Admin**: Primary owner for configuration and operations (subjects, classes, levels, quotas, templates, school days, holidays, vacations, behavior settings, communication settings, grade templates, timing/periods, etc.); full CRUD on staff and mappings, high-level reports, and inventory management.
- **Academic Coordinator**: Oversees academic content, assessments, grades, teacher mappings, communication, and analytics for assigned scope; often edit-level access on academic features but little/no access to core settings.
- **Class Teacher**: Manages class-level operations such as attendance, leaves, early departure, communication with students/parents, behavior entries, and some assessment-related tasks; sees and edits data mainly for own classes.
- **Subject Teacher**: Manages subject-specific teaching, assessments, and behavior feedback for assigned classes; can view/edit academic data and communication tied to their subjects but not global configuration.
- **Guidance Counselor**: Focuses on behavioral and well-being data, communication, and reports related to students’ behavior and support; can view and edit behavioral assessments and see relevant reports, but does not manage core system settings.
- **Admin Assistant**: Supports day-to-day admin work such as data entry, some library, attendance, event, notification, and inventory workflows with mostly view/edit rights on operational records but limited system configuration access.

### 3. Feature Categories (High-Level)
- **Core User Management**: Manages roles, permissions, and user profiles (students, staff, parents) with multi-role support and bulk account creation; authentication is role- and branch-aware with active academic year checks on each request.
- **Academic Content**: Configurable subjects, classes, sections, and levels; powerful assessment templates with types and weightages; grade configuration and promotions; and a digital library for textbooks and resources.
- **Communication System**: Teacher–student–parent messaging (one-to-one and broadcast) with configurable directions, message types, and a notification center that unifies alerts, read/unread state, and deep links into the app.
- **Attendance, Leaves & Early Departure**: Daily attendance with in/out times, quota-based leave requests with workflow and attachments, and unconstrained early departure requests; strongly integrated with parent notifications and reports.
- **Schedule & Timetable**: Class timetables, teacher schedules, and a school calendar driven by admin-defined school days, timing templates, period durations, holidays, and vacations, with conflict detection for teachers and validation of gaps.
- **Events & Activities**: Event creation with consent workflows, conflict detection against assessments and other events, multi-day support, role-based dashboards, and full audit trail for parent approvals.
- **Results & Evaluation**: Student reports aggregating academics, attendance, behavior, and rankings/percentiles, plus class- and subject-level performance tracking and assignment analytics.
- **System Admin & Configuration**: Centralized management of academic years, all core school structures (subjects, classes, sections, levels), quotas, assessment/grade/timing templates, school days, holidays, vacations, library categories, behavioral settings, communication directions, minimum passing grades, and V/E per-feature configurability.
- **Staff Management**: CRUD for teachers and staff with replacement workflows, inactivation instead of hard deletion, and teacher–subject–class mapping management.
- **Reporting & Analytics**: Role-aware administrative reports (attendance, academics, engagement) with PDF and Excel exports, public anonymized student counts, and scoped visibility based on user role and assignments.
- **Uniform Inventory**: Tracks uniform stock, sizes, and low-stock thresholds, with parent-facing request workflow and issuance history per student (no payments).
- **Multi-Tenancy & Data Management**: Manages multiple branches with strict data isolation (no cross-branch data sharing), per-branch storage quotas and dashboards, automatic compression, alerts, backups, and YouTube-based video hosting for content.
- **Offline Features (PWA)**: Provides offline-capable app behavior with queued uploads, local storage of reports and assignments within the app interface, and automatic synchronization when connectivity returns.
- **Other UX Features**: Role-based dashboards tuned to each user type and localization/RTL support (e.g., English and Arabic) with JSON-driven translations and native review workflows.

### 4. Key Technical Decisions
- **Architecture**: Multi-tenant school management platform supporting fully independent branches per school, with strict branch isolation for all data, reports, and workflows.
- **Auth & Session Model**: Role-based logins with branch selection for multi-branch users and child selection for parents; a single active academic year is enforced, with year lock and mismatch checks on every request.
- **Permissions Model**: Fine-grained, feature-based permission matrix per role using View (V), Edit (E), configurable View/Edit (V/E), and No Access (X); configuration of these permissions is centralized in settings and drives all feature access.
- **Data Integrity & Safety**: Non-editable core structural settings after creation (subjects, classes, levels, leave quota, timing templates, period duration, school days) to prevent breaking downstream data; year locking and staff inactivation (instead of deletion) preserve historical integrity.
- **Reporting & Exports**: Standardized exports (PDF as formatted views, Excel as structured data) to support admin workflows and compliance; support for public statistical pages without exposing individual student data.

### 5. Integration Points Between Features
- **Permissions & All Features**: The role/feature matrix and settings-driven V/E configuration govern access to every module (attendance, reports, inventory, communication, etc.), ensuring consistent authorization across the app.
- **Academic Structure & Timetable/Assessments**: Subjects, classes, sections, levels, and teacher mappings flow into assessment creation, timetable generation, teacher schedules, and reporting, ensuring consistent academic structure everywhere.
- **Attendance / Leaves / Early Departure / Notifications / Reports**: Attendance and leave data generate real-time notifications to parents and feed into student reports, analytics, and administrative reports.
- **Calendar / Timetable / Events / Assessments**: School calendar configuration integrates with class timetables and assessments; events and assessments check for conflicts and surface warnings in the relevant UIs.
- **Behavioral System & Reporting**: Monthly behavioral assessments from teachers roll up into student reports and are visible to class teachers, guidance counselors, and principals, complementing academic and attendance data.
- **Library, Storage & Offline/PWA**: Library content, assignments, and reports share the common storage and quota system, benefit from compression and backups, and participate in offline access and sync behavior where relevant.
- **Inventory & Core User/Branch Model**: Uniform requests, approvals, and stock updates are tied to students, branches, and roles (parents, admins), and appear in relevant dashboards and histories.



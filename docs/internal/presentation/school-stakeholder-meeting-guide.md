# Alma School Management System — Stakeholder Meeting Guide

**Purpose:** Walkthrough script for presenting the system to school leadership, registrars, coordinators, or parent representatives.  
**Audience:** Non-technical school stakeholders  
**Suggested duration:** 60–90 minutes (full) · 30 minutes (highlights only)  
**Last aligned with codebase:** July 2026

---

## How to use this document

- Follow the **numbered sections in order** — they mirror how a school actually runs (set up once → daily work → families → outcomes).
- Each section has:
  - **Say this** — plain-language opener
  - **Show** — where to click in the portal
  - **Highlight** — points that resonate with school people
  - **Who cares** — which roles benefit
- Sections marked **(optional)** can be skipped if time is short.
- Use **Demo tip** boxes to switch user accounts and make the story real.

---

## 30-second opener

> “Alma is a cloud-based school management platform. One place for your admin team, teachers, parents, and students — attendance, assessments, timetables, fees, communication, and reports. It supports **multiple branches** (e.g. boys’ and girls’ campuses), **Arabic and English**, and **nine school roles** with permissions you control. Nothing is installed on school computers — it runs in the browser on any device.”

---

## Who uses the system?

| Role | In one sentence |
|------|-----------------|
| **School Admin** | Configures the school, users, fees, timetables, and permissions |
| **Principal** | Oversees operations, reports, and many approvals |
| **Academic Coordinator** | Manages academics, assessments, timetables, substitution |
| **Class Teacher** | Own class: attendance, leaves, early departure, class communication |
| **Subject Teacher** | Own subjects: assessments, grades, behavioural feedback |
| **Guidance Counselor** | Behavioural and well-being records |
| **Admin Assistant** | Day-to-day data entry without full settings access |
| **Parent / Guardian** | Child’s attendance, fees, events, requests, messaging |
| **Student** | Timetable, assessments, events, library, certificates |

**Important:** One person can have **multiple roles** (e.g. subject teacher + coordinator). The dashboard adapts. Parents with more than one child pick the child after login.

---

## Recommended meeting flow

| # | Section | Time | Must show? |
|---|---------|------|------------|
| 1 | Big picture & access | 5 min | Yes |
| 2 | School setup (Settings) | 12 min | Yes |
| 3 | Students, staff & mapping | 10 min | Yes |
| 4 | Daily operations | 15 min | Yes |
| 5 | Timetable & substitution | 8 min | If secondary+ |
| 6 | Parent & student experience | 10 min | Yes |
| 7 | Communication & events | 8 min | Yes |
| 8 | Fees | 8 min | If fees module enabled |
| 9 | Library, uniforms, ID cards, certificates | 8 min | Optional |
| 10 | Reports & result cards | 12 min | Yes |
| 11 | Wrap-up: plans, security, next steps | 5 min | Yes |

---

## 1. Big picture & access

### Say this
> “Every user logs in securely. Teachers and admin pick their **branch** if they work at more than one campus. Parents pick their **child**. Everything they see is scoped to the **active academic year** — so last year’s data stays separate from this year.”

### Show
- Marketing site: `/home`, `/features`, `/pricing` (optional — sets context)
- Login → branch selection → dashboard

### Highlight
- **Cloud** — no local servers; works on phone, tablet, laptop
- **Multi-branch** — each campus has its own students, settings, storage, uniforms
- **Active academic year** — system enforces one working year; old years can be **locked** so records cannot be changed accidentally
- **Languages** — English (UK/US) and Arabic with RTL layout
- **Progressive Web App** — can be installed on devices; some documents available offline

### Who cares
Everyone — especially IT-light schools that want zero installation.

### Demo tip
Log in as **School Admin** first. Keep that session for setup sections.

---

## 2. School setup (Settings)

**Path:** Sidebar → **Settings** (`/settings`)

This is the foundation. Schools configure once per year (or copy from last year).

### 2.1 Business information

**Say this:** “School name, timezone, and branch details — including Arabic names where needed.”

**Show:** Settings → **Business information**

**Highlight:** Bilingual school branding; correct timezone for attendance and notifications.

---

### 2.2 Academic years

**Say this:** “You define the school year. Only **one year is active** at a time. At year end you **lock** the old year and start a new one — historical data stays for reports but daily screens move forward.”

**Show:** Settings → **Academic years**

**Highlight:**
- **Lock** = read-only protection for closed years
- **Rollover / duplicate** — carry forward structure (classes, templates) without rebuilding from scratch
- Every API request validates the active year — prevents accidental edits in the wrong year

**Who cares:** Registrar, principal, school admin.

---

### 2.3 Academic structure (within Settings / Academic)

**Say this:** “Subjects, classes, sections, and levels are defined here — the skeleton everything else hangs on.”

**Show:** Settings → **General** (subjects, assessment types, grade templates) and/or **Academic** areas; also **Class** under Management (`/academic/class-sections`)

**Highlight:**
- Flexible levels (e.g. Primary = KG1–Prep2, or 1–5 — your choice)
- **Class sections** = class + section + capacity + class teacher
- Core structure is protected after use — prevents breaking downstream assessments and timetables

---

### 2.4 Schedule configuration

**Say this:** “School days, period timings, holidays, and vacations drive the timetable and validate attendance times.”

**Show:** Settings → **Schedule**

**Highlight:**
- Supports **Sun–Thu** or other week patterns
- **Timing templates** — assembly, breaks, period length per level
- Holidays and vacations feed conflict checks with events and assessments

---

### 2.5 Permissions

**Say this:** “You are not stuck with fixed roles. For each feature you choose **View**, **Edit**, or **No access** per role. The sidebar only shows what each person is allowed to see.”

**Show:** Settings → **Permissions**

**Highlight:**
- Nine school roles + configurable matrix
- Example: “Should subject teachers edit attendance or only view?” — your choice
- Changes apply across portal and API

**Who cares:** Principal and school admin — reduces over-sharing of sensitive data.

---

### 2.6 Communication rules

**Say this:** “You decide whether students can reply to teachers, or only teachers initiate messages.”

**Show:** Settings → **Communication**

**Highlight:** Teacher ↔ student and teacher ↔ parent directions are separately configurable.

---

### 2.7 Fees, inventory, results, theme (as relevant)

| Tab | What to mention |
|-----|-----------------|
| **Fees** | Fee templates, discounts, challan rules, late fees |
| **Inventory management** | Uniform categories and sizes |
| **Result reports** | PDF layout options for term/annual/progress cards |
| **Theme settings** | School colours and branding |
| **Public statistics** | Optional public page with anonymised class counts |
| **Data export** | Password-protected backup ZIP for compliance |

---

### 2.8 Setup wizard (first login)

**Say this:** “New schools get a guided setup wizard — step-by-step until the essentials are complete.”

**Show:** Appears when settings are incomplete; can also bulk-import settings from Excel.

**Highlight:** Reduces go-live time; can copy configuration from another branch or year.

---

## 3. Students, staff & mapping

### 3.1 Students

**Path:** **Student** (`/students`)

**Say this:** “The student register is the centre of the system — photo, demographics, medical notes, roll number, class section.”

**Highlight:**
- Single source of truth replaces spreadsheets
- Student ID format consistent across modules (attendance, fees, ID cards, results)

---

### 3.2 Bulk import

**Path:** Students → **Bulk import** (`/students/bulk-import`)

**Say this:** “Upload an Excel file, preview rows, fix errors, then import hundreds of students in one go.”

**Highlight:**
- Download template first
- Validation before commit — no silent bad data
- Available on **Starter** plan and above

**Who cares:** Registrar at start of year.

---

### 3.3 Users & staff

**Path:** **User** (`/users`)

**Say this:** “All staff accounts live here — teachers, coordinators, assistants. Assign one or more roles per person. Deactivate instead of delete to preserve history.”

**Highlight:** Invitations and re-invite flows; staff schedule view from user profile.

---

### 3.4 Mapping

**Path:** **Mapping** (`/mapping`)

**Say this:** “Two critical links: **parent to student**, and **teacher to class/subject**. Without these, parents cannot see their children and teachers cannot mark attendance or enter grades.”

**Show:** Parent associations tab + teacher assignment (list or matrix view)

**Highlight:**
- **Matrix view** — quick visual of who teaches what
- Multiple guardians per student with priority rules

**Demo tip:** Show matrix for one grade level — school people immediately understand it.

---

### 3.5 Promotion & placement

**Path:** **Promotion & Placement** (`/promotion-placement`)

**Say this:** “At year end, decide who moves up, who repeats, who changes section — with readiness checks against grades and minimum pass rules.”

**Highlight:** Tied to grade templates and academic year rollover.

**(Optional)** — show only if audience asks about end-of-year process.

---

## 4. Daily operations

### 4.1 Attendance

**Path:** **Attendance** (`/attendance`) → **Mark** (`/attendance/mark`)

**Say this:** “Class teachers mark present, absent, late, excused — with entry and exit times. Parents get notified. Records feed every report.”

**Highlight:**
- Editable same day (not locked at midnight unless you change process)
- **History** view for audits
- **Child attendance** view for parents (`/attendance/child`)

**Who cares:** Class teachers (daily), parents (visibility), leadership (reports).

**Demo tip:** Switch to **Class Teacher** and mark a class for today.

---

### 4.2 Leaves

**Path:** **Leave** (`/leaves`)

**Say this:** “Parents request leave with reason and optional attachment. Staff approve or reject. You set an **annual quota** per student — the system warns when quota is running out.”

**Highlight:**
- Quota configured in Settings
- Unrequested absences still visible from attendance
- Workflow + notifications

---

### 4.3 Early departure

**Path:** **Early Departure** (`/early-departure`)

**Say this:** “When a parent needs to pick up a child before dismissal, they request a time slot. Staff approve. No quota — but validated against school hours.”

**Highlight:** Common parent pain point — solved in-app instead of phone calls.

---

### 4.4 Assessments & grading

**Path:** **Assessment** (`/assessments`)

**Say this:** “Teachers create assignments and exams from **assessment templates** you defined. They attach files, set due dates, enter grades, and see who submitted late or not at all.”

**Show:**
- List → Create → Grade entry → Statistics

**Highlight:**
- **Assessment templates** with weightings (e.g. 4 assignments 60%, 1 final 30%)
- **Term examination** type — exam start time, duration, room number; dedicated **examination schedule** for staff, parents, and students
- Statistics: % viewed, % submitted, graded vs pending
- File attachments for homework sheets

**Who cares:** Academic coordinator, subject teachers.

---

### 4.5 Behavioural assessment (optional — Pro plan)

**Path:** **Behavioral** (`/behavioral`) → **Assess** (`/behavioral/assess`)

**Say this:** “Quick monthly matrix — rate students on attributes you configure (effort, cooperation, etc.). Feeds student reports.”

**Highlight:** Fast data entry for class/subject teachers; counselor and principal visibility.

---

## 5. Timetable & substitution

### 5.1 Class timetable

**Path:** **Timetable** (`/timetable`) → select class section

**Say this:** “Build the weekly grid from your timing template. Assign subjects, teachers, and rooms. Replicate a day to other days. System warns if a teacher is double-booked.”

**Highlight:**
- **Conflict management** (`/conflict-management`) — dedicated view for overlaps
- Integration with teacher **My Schedule** view

---

### 5.2 Teacher schedule

**Path:** **My Schedule** (`/my-schedule`) — teacher view

**Say this:** “Teachers see their own week automatically — no separate data entry.”

---

### 5.3 Teacher substitution

**Path:** **Substitution** (`/substitution`)

**Say this:** “When a teacher is absent, assign a substitute for specific periods. Substitutes see assignments in **My substitution** and on the timetable with a SUB badge.”

**Highlight:** History and export; suggested substitutes; reduces office phone chains.

**Who cares:** Academic coordinator, principal.

---

## 6. Parent & student experience

### Say this
> “Parents do not need a separate app. One login for all children. Students can use their own login — or a **parent-managed PIN** on a shared family device.”

### Show (Parent account)

| Feature | Path | What to say |
|---------|------|-------------|
| Dashboard | `/dashboard` | Today’s snapshot — attendance, pending consents |
| My Child | `/my-children` | Switch between children |
| Child timetable | `/children-timetable` | Week view for selected child |
| Child attendance | `/attendance/child` | Calendar and summary |
| My Assessment | via child mode | Child’s assignments and status |
| Leave / Early departure | `/leaves`, `/early-departure` | Submit requests |
| Request uniform | `/uniform-request` | Order from school stock |
| Fees | `/fees` | View challans, upload payment proof |
| My Event | `/my-events` | Approve or decline event consent |
| Messages | `/messages` | Chat with teachers |
| PIN Management | `/parent/pin-management` | Set PIN for child login on tablet |

### Show (Student account or child PIN)

| Feature | Path |
|---------|------|
| My Timetable | `/my-timetable` |
| My Assessment | `/my-assessments` |
| My Event | `/my-events` |
| My Certificates | `/my-certificates` |
| Library | `/library` |

### Highlight
- **Parent PIN** — child uses short PIN on parent’s phone; parent stays in control
- **Act as child** — parent can view exactly what student sees
- Reduces “call the office” for routine questions

### Demo tip
Switch to **Parent** account after admin/teacher sections — this is often the emotional high point for school visitors.

---

## 7. Communication & events

### 7.1 Messages

**Path:** **Messages** (`/messages`)

**Say this:** “Teachers message one parent or broadcast to a whole class. Message types — event, meeting, grade, other — are colour-coded. Notifications link back to the conversation.”

**Highlight:** Real-time messaging; direction rules from Settings.

---

### 7.2 Notifications

**Path:** **Notification** (`/notifications`)

**Say this:** “Unified inbox — attendance alerts, leave decisions, event reminders, fee notices. Mark read individually or all at once.”

---

### 7.3 Events & parent consent

**Path:** **Event** (`/events`) — staff · **My Event** (`/my-events`) — parents

**Say this:** “Trips, sports day, assemblies — create multi-day events. Parents approve or decline with a full **audit trail** (who consented, when). System checks conflicts with exams and other events.”

**Highlight:**
- Compliance-friendly consent record
- Consent deadlines
- Parents see only relevant events

**Who cares:** Principal, coordinators, parents.

---

## 8. Fees (Starter plan and above)

**Path:** **Fees** (`/fees`)

### Say this
> “Schools define **fee templates** — by level, class, or individual student. System generates **challans**, tracks payments, late fees, waivers, and discounts. Parents see **My Fees** and can upload payment proof for admin verification.”

### Show (Admin)
- Fee templates in Settings → **Fees**
- Challan generation, payment verification, defaulter views
- **Reports → Revenue** (`/reports/fees`) — collected income

### Highlight
- Templates with auto-apply rules (e.g. staff discount)
- Pro-rata options
- Separates **collected revenue** from pending challans
- PDF challans

### Who cares
Bursar, school admin, parents.

**(Skip section if demo tenant has fees disabled on Free plan.)**

---

## 9. Library, uniforms, ID cards & certificates (optional)

### 9.1 Digital library (Pro)

**Path:** **Library** (`/library`)

Upload PDFs with subject, class, category. Students and parents browse and read. Automatic compression for large files.

---

### 9.2 Uniform inventory (Pro)

**Path:** **Inventory** (`/inventory`) · Parent: **Request uniform** (`/uniform-request`)

Track stock by item and size, low-stock alerts, approve parent requests, issuance history per student.

---

### 9.3 ID cards

**Path:** **ID Cards** (`/id-cards`)

Bulk generate student and staff cards with photos, modern/classic designs, print-ready PDF, ZIP download.

**Highlight:** Missing-photo warnings before generate; reprint fee can tie into revenue reports.

---

### 9.4 Certificates

**Path:** **Certificates** (`/certificates`) · History · Settings → certificate signatures

Issue **award** and **administrative** certificates with live preview, school branding, signatory names. Parents and students download from **My Certificates**.

---

## 10. Reports & result cards

### 10.1 Dashboards

**Path:** `/dashboard`

**Say this:** “Each role sees a different dashboard — admin sees storage, conflicts, pending leaves; parent sees today’s attendance and pending consents.”

**Highlight:** Multi-role users can switch role from the dashboard.

---

### 10.2 Reports hub

**Path:** **Report** (`/reports`)

| Tab / area | Purpose |
|------------|---------|
| **Student** | Individual academic + attendance + behaviour |
| **Class** | Class-level performance and attendance |
| **Administrative** | Branch-wide attendance, engagement, low attendance lists |
| **Revenue** | Fee collection summary (admin) |
| **Public** | Link to anonymised statistics page |

**Highlight:** PDF and Excel export on key reports; visibility respects role and class assignment.

---

### 10.3 Result cards

**Path:** **Results** (`/results`)

**Say this:** “Generate **term**, **annual**, and **progress** report cards from live grades. Workflow: **draft → review → publish**. Parents only see **published** cards. Bulk PDF export for a whole class.”

**Highlight:**
- Marks readiness checks before generate
- Comment field blocked after publish
- Detailed two-page layouts for final reports
- Replaces mail-merge Word templates

**Who cares:** Principal, coordinators, class teachers, parents.

---

### 10.4 Public statistics

**Path:** Settings → **Public statistics** · live URL `/public/statistics/[branchCode]`

Gender and class counts **without login** — no student names. Useful for regulatory returns or school website.

---

## 11. Platform, billing & wrap-up

### 11.1 Storage

**Path:** **Storage** (`/admin/storage`)

Branch storage usage, category breakdown, alerts near quota. Automatic compression for uploads.

---

### 11.2 SaaS subscription (school’s plan with NTG)

**Path:** **Billing** (`/billing`) — School Admin only

| Plan | Typical school size | Notable features |
|------|---------------------|------------------|
| **Free** | Small trial — 50 students, 1 branch | Core attendance, assessments, parent access |
| **Starter** | Up to 300 students | + Fees, result cards, bulk import, advanced reports |
| **Pro** | 300–500 students, multi-branch | + Library, uniform inventory, behavioural |
| **Enterprise** | Large groups | White label, API, 100GB, dedicated support |

**Say this:** “You pay per active student per month. Upgrade as you grow. Feature flags hide modules you have not purchased — so users never see broken menu items.”

---

### 11.3 Data export & security talking points

- **Data export** — encrypted ZIP backup under Settings
- **Branch isolation** — users at Branch A never see Branch B data
- **Year lock** — protects historical records
- **Audit trail** — platform-level logging for NTG operators (super admin)
- **Hosting** — cloud (Supabase/PostgreSQL); no school server maintenance

---

## Closing questions to ask them

1. How many branches and approximate student count?
2. Do you run separate boys/girls campuses or shared admin?
3. Is fee collection in-scope for year one?
4. Do you need Arabic as primary language for parents?
5. What reports do you produce today manually (Excel/Word)?
6. Who marks attendance — class teacher only or multiple staff?

---

## Quick reference — sidebar menu map

### School (daily)
| Menu | Main users |
|------|------------|
| Dashboard | All |
| Student | Admin, coordinators |
| Attendance | Class teachers, admin |
| Assessment / My Assessment | Teachers / students |
| Behavioral | Teachers, counselors |
| Leave / Early Departure | Parents, teachers, admin |
| Messages / Notification | All |
| Event / My Event | Admin, parents, students |
| My Schedule / Timetable | Teachers / admin |
| Substitution | Coordinators, teachers |
| Results | Teachers, admin, parents (published) |

### Management (setup & resources)
| Menu | Main users |
|------|------------|
| Class | Admin, coordinators |
| Promotion & Placement | Admin, coordinators |
| Mapping | Admin |
| User | Admin |
| Fees | Admin, parents |
| ID Cards / Certificates | Admin, staff |
| Library / Inventory | Admin, parents (request) |
| Report | Leadership, teachers (scoped) |
| Conflict | Coordinators |
| Settings / Storage / Billing | School admin |

---

## Differentiators — use when they compare to Excel or older systems

1. **One portal** for admin, teachers, parents, and students — not five different tools  
2. **Configurable permissions** — not a rigid off-the-shelf role list  
3. **Academic year integrity** — lock, rollover, active-year enforcement  
4. **Parent self-service** — leaves, early pickup, fees, events, uniforms, messaging  
5. **Assessment-to-results pipeline** — templates, grades, publishable report cards, bulk PDF  
6. **Multi-branch** with strict data separation  
7. **Arabic + English** with RTL — built for regional schools  
8. **Operational modules** beyond academics — fees, uniforms, ID cards, certificates, substitution  
9. **Consent audit trail** for events — defensible record for trips and activities  
10. **Cloud + PWA** — no IT cupboard server; works on phones  

---

## 30-minute highlights cut

If you only have half an hour, show in this order:

1. Login + dashboard (2 min)  
2. Settings → academic year + permissions (5 min)  
3. Students + mapping (5 min)  
4. Attendance mark + parent view (5 min)  
5. Assessment + grade entry (5 min)  
6. Parent portal — leave request + event consent + fees glimpse (5 min)  
7. Reports or result cards (3 min)  

End with: “Everything you saw is one system, one login, one academic year context.”

---

## Notes for future user documentation

This guide can be split into:
- **Admin setup guide** — Sections 2, 3, 5, 8, 9  
- **Teacher guide** — Sections 4, 5  
- **Parent guide** — Section 6, 7.3, 8 (parent view)  
- **Leadership / principal guide** — Sections 10, 11  

Each section’s **Show** paths map directly to portal routes under `frontend/src/app/(portal)/`.

---

*Generated from live routes, sidebar (`Sidebar.tsx`), permission map (`navFeatureMap.ts`), settings tabs, and scope documentation.*

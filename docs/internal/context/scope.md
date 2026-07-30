**School Management System - Feature Scope**

**Roles & Permissions Matrix**

| Role / Feature | LB  | AT  | AC  | TM  | ED  | LV  | CTS | CTP | ATM | EV  | TT  | DA  | SR  | RA  | IM  | Settings |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Parent / Guardian | X   | V   | V   | X   | E   | E   | X   | E   | V   | V   | V   | V   | V   | V   | E   | X   |
| Student | V   | V   | V   | X   | V   | V   | V/E | X   | V   | V   | V   | V   | V   | V   | V   | X   |
| Principal | V/E | V   | V   | V   | V   | V   | V   | V   | V   | E   | V   | V   | V   | V   | V   | V   |
| School Admin | E   | E   | E   | E   | E   | E   | E   | E   | E   | E   | E   | V   | V   | V   | E   | E   |
| Academic Coordinator | V/E | E   | V   | X   | V   | V   | E   | E   | V   | V   | E   | V   | V   | V   | X   | X   |
| Class Teacher | V/E | V   | V   | X   | E   | E   | E   | E   | E   | V   | E   | V   | V   | V   | V   | X   |
| Subject Teacher | E   | V   | V   | X   | V   | V   | E   | E   | V/E | V   | V   | V   | V   | V   | X   | X   |
| Guidance Counselor | V/E | X   | X   | X   | V   | V   | E   | E   | V   | V   | V   | V   | V   | V   | X   | X   |
| Admin Assistant | V   | V   | V   | X   | V/E | V/E | X   | X   | E   | E   | V   | V   | V   | V   | E   | X   |

**Legend:**

- **V** = View Only
- **E** = Edit (includes View)
- **V/E** = Configurable from settings (admin can set as View or Edit)
- **X** = No Access

**Feature Abbreviations:**

- **LB** = Library
- **AT** = Assessment Templates
- **AC** = Assessment Creation
- **TM** = Teacher Mapping
- **ED** = Early Departure
- **LV** = Leaves
- **CTS** = Communication Teacher to Student
- **CTP** = Communication Teacher to Parent
- **ATM** = Attendance
- **EV** = Events
- **TT** = Timetable
- **DA** = Dashboard
- **SR** = Student Report
- **RA** = Reporting & Analytics
- **IM** = Inventory Management
- **Settings** = System Settings & Configuration

**Core User Management**

| Feature Name | Description |
| --- | --- |
| User Roles & Permissions | • Support for 9 distinct roles: Parent/Guardian, Student, Principal, School Admin, Academic Coordinator, Class Teacher, Subject Teacher, Guidance Counselor, Admin Assistant  <br>• Multi-role assignment per user with inherited permissions (e.g., user can be both Maths Teacher + Academic Coordinator)  <br>• Configurable View (V) and Edit (E) rights per feature per role from settings  <br>**Example**: Academic Coordinator has V/E for Attendance, E for Academic Content, but no access to Settings |
| User Profile Management | • Student profiles with unique ID, demographics, photo, medical info  <br>• Teacher and staff profiles with contact information  <br>• Parent/Guardian profiles linked to multiple children  <br>• Bulk account creation via Excel import  <br>**Example**: Student profile shows "Ahmed Ali, ID: 2024-KG1-A-001, DOB: 15/03/2018, Blood Group: O+, Parent: Fatima Ahmed" |
| Authentication & Access | • Role-based login with branch selection (if multi-branch access)  <br>• Child selection for parents with multiple children  <br>• Session management with active year validation on each API request  <br>**Example**: Parent Fatima logs in, selects "Downtown Branch", then selects child "Ahmed" from her 3 children across 2 branches |

**Academic Content**

| Feature Name | Description |
| --- | --- |
| Subject & Class Structure | • Admin-configurable subjects (defined in settings)  <br>• Admin-configurable classes (e.g., KG1, KG2, Prep1, Prep2, 1-10) and sections (e.g., A, B, C)  <br>• Admin-configurable level grouping with custom class assignments (e.g., Primary can be classes 1-5 or KG1-3 as per school's needs)  <br>• Teacher mapping to classes, sections, and subjects with List and Matrix views  <br>**Example**: Admin defines levels: "Primary (KG1, KG2, Prep1, Prep2), Elementary (1-3), Middle (4-6), Secondary (7-10)"  <br>**Example**: Teacher "Ayesha Anwar" teaches Science to classes 9A, 9B, and 10A. Matrix view shows Science column with "Ayesha" in rows for 9A, 9B, 10A |
| Assessment Management | • Template-based assessment creation using admin-configured assessment types  <br>• Configurable assessment types and weightage per template  <br>• Manual grade entry with file attachments (10MB limit per file, multiple files allowed)  <br>• Student submission tracking and viewing statistics  <br>• Template cannot be replaced if existing assessments exceed new template requirements<br><br>• Late submission tracking and non-submission recording by teachers  <br>**Example**: Assignment "Solar System" - Ahmed: Submitted late (due Jan 10, submitted Jan 12), Sara: Not submitted, Mohamed: Submitted on time  <br>**Example**: Admin defines assessment types: "Mid Term, Final, Assignment, Quiz, Monthly Test, Class Test"  <br>**Example**: Template #1 for Classes 5-6: "4 Assignments (60%), 2 Mid-terms (10%), 1 Final (30%)" applied to all subjects except Art  <br>**Example**: Assignment "Solar System" for Class 3B Science, created Jan 3, due Jan 10, total marks 20, PDF attached, 15/23 students viewed  <br>**Example**: Rejection: "Cannot replace template - current has 2/3 quizzes created, new template needs only 1 quiz. Delete 1 quiz first." |
| Grade Configuration | • Template-based grade ranges (A, B, C, etc.) with admin-defined percentage thresholds  <br>• Class-specific grade template assignments  <br>• Configurable minimum passing grade per class  <br>• Student promotion based on consolidated grades and minimum passing grade  <br>**Example**: Admin creates Template 1 (A>80%, B>70%, C>60%, F<60%) and assigns to Classes 1-4  <br>**Example**: Admin creates Template 2 (A>90%, B>80%, C>70%, D>60%, E>50%, F<50%) and assigns to Classes 5-8  <br>**Example**: Minimum passing grade for Classes 1-5: C, for Classes 6-10: E |
| Library & Resources | • Digital library for textbooks, reference materials, PDFs  <br>• Upload with metadata (name, author, subject, class, admin-configured category)  <br>• 100MB limit per book with automatic image optimization  <br>• Categorized browsing and search using admin-defined categories  <br>**Example**: Admin defines categories: "Textbooks, Reference, Fiction, Islamic Studies, Science, History, Mathematics"  <br>**Example**: Book entry: "Advanced Physics Vol 1, Author: Dr. Hassan Ahmed, Subject: Physics, Class: 10, Category: Textbook, 45MB PDF" |

**Communication System**

| Feature Name | Description |
| --- | --- |
| Teacher-Student-Parent Messaging | • One-to-one and broadcast messaging  <br>• Message types: event, meeting, grade, other with visual distinction (color-coded badges)  <br>• Admin-configurable communication direction per setting (Teacher-to-Student only OR Both ways)  <br>• Notification system with read/unread status  <br>**Example**: Admin setting: "Teacher-Student Communication: Both Ways" allows students to reply  <br>**Example**: Broadcast from Maths Teacher to Class 9B: "Type: Meeting, Subject: Parent-Teacher Conference, Message: Please attend on Jan 20 at 3 PM"  <br>**Example**: One-to-one: Parent to Class Teacher: "Ahmed will be late today due to doctor appointment" |
| Notification Center | • Centralized notification hub for all users  <br>• Read/unread management, mark all actions  <br>• Click-through navigation to relevant content  <br>• Real-time alerts for attendance, leaves, events  <br>**Example**: Notification: "Your child Ahmed was marked present at 7:15 AM" - clicking navigates to attendance page for that day |

**Attendance, Leaves & Early Departure**

| Feature Name | Description |
| --- | --- |
| Attendance Management | • Daily manual attendance marking by class teachers  <br>• Entry and exit time recording  <br>• Editable at any time (not locked for current day)  <br>• Parent notifications on presence/absence  <br>**Example**: Class Teacher marks Class 5A on Jan 15: "Ahmed: Present (7:15 AM), Sara: Absent, Mohamed: Present (7:30 AM), Exit: Ahmed (1:00 PM)" |
| Leave Management | • Parent-requested leaves with approval workflow  <br>• Unrequested absences tracked from attendance  <br>• Admin-configurable annual leave quota per student (set in settings, e.g., 7 days/year)  <br>• Optional document attachments with requests  <br>• Quota exhaustion warning shown to parent; staff sees remaining quota  <br>**Example**: Admin sets leave quota: "7 days per year per student"  <br>**Example**: Parent requests leave for Ahmed: "Date: Jan 20-22, Reason: Family wedding, Attachment: wedding_invitation.pdf, Status: Pending, Quota Remaining: 4/7 days"  <br>**Example**: Unrequested leave counted when Ahmed marked absent without prior request |
| Early Departure Requests | • Parent-initiated early departure requests  <br>• Staff approval/rejection workflow  <br>• Optional reason and attachments  <br>• No quota limitations  <br>**Example**: "Student: Sara Ahmed, Date: Jan 18, Time: 11:00 AM, Reason: Doctor appointment, Attachment: appointment_slip.pdf, Status: Approved by Ms. Fatima" |

**Schedule & Timetable**

| Feature Name | Description |
| --- | --- |
| Class Timetable | • Weekly schedule matrix (days × time periods)  <br>• Template-based with automatic repetition using admin-configured school days and timings  <br>• Week-specific or future weeks editing  <br>• Conflict detection for teacher overlaps  <br>• Integration with events and assessment due dates  <br>• Uses admin-configured period duration; warns if configuration creates empty spaces  <br>**Example**: Class 9B Monday schedule: "7:00-7:15 Assembly, 7:15-8:15 English (Ms. Sarah), 8:15-9:15 Maths (Mr. Ahmed), 9:15-10:15 Science (Dr. Hassan), 10:15-10:45 Break"  <br>**Example**: Warning when editing: "Ms. Sarah is already teaching Class 8A English at this time. Create conflict?"  <br>**Example**: Admin configured period duration (1 hour) creates gap warning: "Current configuration leaves 15-minute gap at 11:45 AM" |
| Teacher Schedule | • Individual teacher weekly schedule view  <br>• Shows subject, class, and time assignments  <br>• Auto-generated from class timetables  <br>• Conflict warnings  <br>**Example**: Ms. Sarah's Monday: "7:15-8:15 English-9B, 8:15-9:15 English-10A, 10:45-11:45 English-8A, 11:45-12:45 Free Period" |
| School Calendar | • Admin-configurable school days, public holidays, vacations in settings  <br>• Template-based timings (start, end, breaks, assembly) with class-specific assignments  <br>• Period duration settings with validation  <br>**Example**: Admin defines school days: "Monday, Tuesday, Wednesday, Thursday, Sunday" (Friday-Saturday weekend)  <br>**Example**: Admin adds public holidays: "Independence Day: July 1, Eid Al-Fitr: April 10-12"  <br>**Example**: Admin creates Timing Template 1 for KG-Grade 4: "Start: 7:00 AM, End: 1:00 PM, Break: 10:00-10:30 AM, Assembly: 7:00-7:15 AM"  <br>**Example**: Admin creates Timing Template 2 for Grades 5-10: "Start: 7:30 AM, End: 2:00 PM, Break: 10:30-11:00 AM, Assembly: 7:30-7:45 AM" |

**Events & Activities**

| Feature Name | Description |
| --- | --- |
| Event Management | • Event creation with consent requirements  <br>• Parent approval/rejection workflow with audit trail and timestamps  <br>• Conflict detection with other events/assessments  <br>• Multi-day event support with end date  <br>• Role-specific dashboards (parent, teacher, student)  <br>• Broadcast notifications to students, parents, teachers  <br>**Example**: "Science Fair, Date: Jan 25-26, Consent Required: Yes, Approval Deadline: Jan 20, 18/23 parents approved, 2 rejected, 3 pending"  <br>**Example**: Warning: "Conflict detected - Math Mid-term scheduled on Jan 25 for Class 9B"  <br>**Example**: Parent consent: "I agree to send my child Ahmed Ali for Science Fair on Jan 25-26. Timestamp: Jan 18, 3:45 PM, Confirmation email sent"  <br>**Example**: Full audit trail exported: "Ahmed Ali - Approved by Fatima Ahmed on Jan 18 3:45 PM from IP 192.168.1.10" |

**Results & Evaluation**

| Feature Name | Description |
| --- | --- |
| Student Report | • Comprehensive academic, attendance, and behavioral reports  <br>• Consolidation by week, month, or year-to-date  <br>• Rank display: Top 3 students show exact rank (e.g., "Rank 2 in Physics"), remaining students show percentile (e.g., "Bottom 30% in Physics")  <br>• Role-based visibility (student sees own, parent selects child)  <br>**Example**: Ahmed's Monthly Report (January 2025): "Attendance: 18/20 days, Academics: Maths-85% (Rank 2 out of 25), Science-92% (Rank 1 out of 25), English-78% (Top 40%), Overall: 85%, Leaves: 2/7 used, Behavior: Avg 4.2/5 stars" |
| Academic Performance Tracking | • Assignment viewing and completion statistics  <br>• Grade-wise performance analytics  <br>• Subject-wise progress tracking  <br>**Example**: Class 9B Science - Assignment "Solar System": "23 students, 20 viewed (87%), 18 submitted (78%), Average score: 16.5/20 (82.5%)" |
| Behavioral Assessment System | • Optional star-based (1-5 stars) behavioral questionnaire system&lt;br&gt;• Admin can activate/deactivate from settings&lt;br&gt;• Admin configures if responses are optional or mandatory&lt;br&gt;• Every subject teacher fills for every student monthly&lt;br&gt;• Fast-entry matrix view: rows = students with their classes, columns = up to 5 behavior attributes&lt;br&gt;• Admin-editable attributes with default samples (e.g., Discipline, Class Engagement, Work Habits, Student Well-being, Extracurriculars)&lt;br&gt;• Viewable by Class Teacher, Guidance Counselor, and Principal&lt;br&gt;• Results displayed as averages in student reports (weekly, monthly, year-to-date)&lt;br&gt;Example: Admin enables system with mandatory responses, defines attributes: "Discipline, Class Engagement, Work Habits, Student Well-being, Extracurriculars"&lt;br&gt;Example: Matrix view for Science Teacher: Row "Ahmed Ali - 9B" with columns to rate 1-5 stars for each attribute&lt;br&gt;Example: Ahmed's report shows: "Behavior (Jan 2025): Discipline 4.5★, Class Engagement 4.0★, Work Habits 3.5★, Overall Avg: 4.0★" |

**System Admin & Configuration**

| Feature Name | Description |
| --- | --- |
| Academic Year Management | • Single active year at a time (e.g., "2025-2026")  <br>• Year creation with option to duplicate settings and data from previous year  <br>• Year locking to prevent any edits (view-only mode for all users)  <br>• User logout on year mismatch (user's local year ≠ system active year)  <br>• Lock status checked on every API request  <br>**Example**: Admin creates "2025-2026", duplicates settings from "2024-2025", system year changes, all users forced to re-login and sync to new year  <br>**Example**: Admin locks year "2024-2025", all API write requests fail with lock message, users can only view data |
| System Settings Configuration | **Subjects**: Admin-defined list of subjects (non-editable after creation)  <br>**Classes**: Admin-defined classes like KG1, KG2, Prep1, 1-10 (non-editable after creation)  <br>**Sections**: Admin-defined sections like A, B, C (non-editable after creation)  <br>**Levels**: Admin-defined level grouping with custom class assignments (non-editable after creation)  <br>**Leave Quota**: Annual leave days allowed per student (non-editable after creation)  <br>**Assessment Types**: Admin-defined types used in assessment templates (non-editable after creation)  <br>**Grade Range Templates**: Percentage thresholds for letter grades, assigned to classes (editable later)  <br>**Timing Templates**: School start/end times, break/assembly schedules, assigned to classes (non-editable after creation)  <br>**Period Duration**: Single duration value for all periods (non-editable, warns if creates gaps)  <br>**School Days**: Days when school operates (non-editable after creation)  <br>**Public Holidays**: Named holidays with dates (editable later)  <br>**Vacations:** Named vacation periods with date ranges (editable later)  <br>**Library Categories**: Book categorization (editable later)  <br>**Communication Direction**: Teacher-Student communication settings (editable later)<br><br>**Behavioral Assessment**: Enable/disable behavioral assessment system, configure as optional or mandatory (editable later)  <br>**Minimum Passing Grade**: Per-class passing threshold using grade template letters (editable later)  <br>**V/E Configurability**: Per-role feature access rights (editable later)  <br>**Example - Subjects**: "Maths, Science, English, Arabic, Social Studies, Islamic Studies, Art, PE"  <br>**Example - Classes**: "KG1, KG2, Prep1, Prep2, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10"  <br>**Example - Levels**: "Primary (KG1, KG2, Prep1, Prep2), Elementary (1, 2, 3), Middle (4, 5, 6), Secondary (7, 8, 9, 10)" OR "Primary (1-5), Middle (6-8), Secondary (9-10)"  <br>**Example - Leave Quota**: "7 days per year"  <br>**Example - Assessment Types**: "Mid Term, Final, Assignment, Quiz, Monthly Test, Class Test"  <br>**Example - Grade Template 1**: "A>80%, B>70%, C>60%, F<60%" assigned to Classes 1-4  <br>**Example - Timing Template 1**: "Start: 7:00 AM, End: 1:00 PM, Break: 10:00-10:30 (30min), Assembly: 7:00-7:15 (15min)" assigned to KG-Grade 4  <br>**Example - Period Duration**: "1 hour (60 minutes)"  <br>**Example - School Days**: "Monday, Tuesday, Wednesday, Thursday, Sunday"  <br>**Example - Public Holidays**: "Independence Day: 1 July"  <br>**Example - Vacations:** "Summer: June 1 to July 31, Winter: Dec 20 to Jan 5 (editable to adjust dates)"  <br>**Example - Library Categories**: "Textbooks, Reference, Fiction, Islamic Studies, Science, History"  <br>**Example - Communication**: "Teacher-Student: Both Ways" OR "Teacher-Student: Teacher to Student Only"<br><br>**Example - Behavioral Assessment**: "Enabled: Yes, Response Type: Mandatory, Attributes: Discipline, Class Engagement, Work Habits, Student Well-being, Extracurriculars"  <br>**Example - Minimum Passing**: "Classes 1-4: C, Classes 5-10: D" |
| Staff Management | • Teacher and staff CRUD operations  <br>• Names editable later (change allowed)  <br>• Replacement workflow when deleting assigned staff (modal selection required)  <br>• Inactive status instead of permanent deletion  <br>• Teacher-subject-class mapping management  <br>**Example**: Adding teacher: "Name: Ayesha Anwar, Subject: Science, Classes: 9A, 9B, 10A"  <br>**Example**: Editing teacher name: "Ayesha Anwar → Ayesha Ahmed"  <br>**Example**: Deleting "Ms. Sarah" triggers: "Ms. Sarah teaches English to 9B, 10A, 8A. Select replacement: \[Dropdown: Mr. Hassan, Ms. Fatima, Ms. Aisha\]. Cannot complete deletion until all assignments replaced."  <br>**Example**: Inactive teacher: "Ms. Sarah - Status: Inactive (left school Jan 2025), still visible in historical records" |

**Reporting & Analytics**

| Feature Name | Description |
| --- | --- |
| Administrative Reports | • Attendance reports, academic performance reports  <br>• Assignment engagement tracking  <br>• Exportable as PDF (formatted view) and Excel (data tables, one sheet per section/card)  <br>• Role-based report visibility (e.g., 3B Maths teacher cannot access 9B attendance)  <br>• Public student count statistics (gender-wise per class, no login required with password)  <br>**Example**: Attendance Report for Class 9B (January): "Average attendance: 92%, Students with <80% attendance: 3 (Ahmed, Sara, Mohamed)"  <br>**Example**: Public statistics page: "Class 9B: 13 girls, 10 boys, Total: 23 students"  <br>**Example**: Excel export with sheets: "Sheet 1: Attendance Data, Sheet 2: Academic Performance, Sheet 3: Leaves Summary" |

**Uniform Inventory**

| Feature Name | Description |
| --- | --- |
| Uniform Management | • Track uniform items, sizes, stock levels  <br>• Parent/Guardian request via app, admin approval workflow  <br>• Distribution tracking and issuance history per student  <br>• Automatic low-stock alerts at configurable threshold  <br>• No payment processing (inventory management only)  <br>**Example**: Inventory: "Boys Shirt Size-10: 45 units, Girls Skirt Size-8: 12 units (⚠️ Low Stock Alert at <15 units)"  <br>**Example**: Request: "Parent: Fatima Ahmed, Student: Sara, Items: 2x Girls Shirt Size-9, 1x Skirt Size-8, Status: Approved, Issued: Jan 15 by Admin Aisha"  <br>**Example**: Student history: "Sara Ahmed - Sept 2024: 2 Shirts Size-8, 1 Skirt Size-7; Jan 2025: 2 Shirts Size-9, 1 Skirt Size-8" |

**Multi-Tenancy & Data Management**

| Feature Name | Description |
| --- | --- |
| Branch Management | • Multiple independent branches per school  <br>• Complete branch independence: separate curriculum, uniforms, student data, settings, schedules, inventory, storage quota  <br>• No cross-branch data sharing, reports, or automatic student transfers  <br>• Branch selection at login for users with multi-branch access (modal after login)  <br>• Parent with multiple children in different branches: selects branch first, then child  <br>• 100GB storage quota per branch (Pro tier default)  <br>**Example:** School "Al-Noor Academy" has 3 branches: "Downtown Campus (500 students, 100GB storage), Garden District (350 students, 100GB storage), Airport Road (200 students, 100GB storage)"  <br>**Example**: Teacher "Mr. Ahmed" teaches at Downtown & Garden District, sees modal at login: "Select Branch: \[Downtown Campus\] \[Garden District\]", then sees only that branch's data  <br>**Example**: Parent "Fatima" has 3 children in 2 branches: Login → "Select Branch: \[Downtown\] \[Garden District\]" → "Select Child: \[Ahmed\] \[Sara\] \[Mohamed\]" |
| Storage & Backup | • Configurable storage per branch (default 100GB) with upgrade options  <br>• Automatic image compression before upload (1920px width max, 85% quality)  <br>• Storage usage breakdown dashboard showing categories (images, PDFs, other)  <br>• Automatic alerts at 80% threshold, hard limit enforcement at 100%  <br>• Daily automated backups with 30-day retention  <br>• Point-in-time recovery available for 7 days  <br>• YouTube integration for video hosting (school's private channel, accessible through SMS)  <br>**Example**: Storage Dashboard: "Used: 73GB/100GB (73%), Images: 45GB, PDFs: 25GB, Other: 3GB, ⚠️ Warning notification sent at 80GB"  <br>**Example**: Admin uploads 5MB photo, system auto-compresses to 1.2MB (1920px width, 85% quality) before saving  <br>**Example**: School hosts "Science Experiment Playlist" on YouTube private channel, videos embedded and accessible through SMS library section |

**Offline Features**

| Feature Name | Description |
| --- | --- |
| Offline Mode (PWA) | • Queue uploads to local device when offline, automatic cloud sync on reconnection  <br>• Save student reports and assignments locally for offline access through system interface  <br>• No need to search local device folders, accessible directly in app  <br>• Progressive Web App (PWA) support for mobile app-like experience  <br>**Example**: Teacher creates assignment while offline → queued in local storage → auto-uploads when WiFi reconnects with success notification  <br>**Example**: Parent downloads Ahmed's monthly report → saved to device → accessible in app's "Offline Documents" section even without internet |

**Others**

| Feature Name | Description |
| --- | --- |
| Role-Based Dashboards | • Customized dashboard for each role showing relevant data and actions  <br>• Multi-role users can switch between role views using dropdown (available on report pages to filter reports by selected role)  <br>• Quick access to frequently used features and pending tasks  <br>**Example**: Parent Dashboard: "Ahmed's Today: Present ✓ (7:15 AM), Upcoming: Science Test Jan 20, Pending: Event consent for Field Trip (Due: Jan 18)"  <br>**Example**: Class Teacher Dashboard: "Class 5A - Today's Attendance: 22/25 present (88%), Pending Tasks: Grade 5 Science assignments (3 pending), Upcoming: Parent meeting Jan 18"  <br>**Example:** Multi-role user "Ms. Fatima" (Academic Coordinator + Maths Teacher) on Reports page: "View Reports as: \[Academic Coordinator ▼\] or \[Maths Teacher\]" - selecting "Maths Teacher" shows only reports accessible to Maths Teacher role |
| Localization & RTL Support | • Multi-language support (English and Arabic initially, extensible to more languages)  <br>• Right-to-Left (RTL) interface support for Arabic  <br>• Translatable system data (menus, labels, messages) via JSON configuration files  <br>• Native speaker review workflow for translation accuracy  <br>**Example**: English menu: "Dashboard, Students, Attendance, Reports" → Arabic (RTL): "لوحة التحكم، الطلاب، الحضور، التقارير"  <br>**Example**: Translation JSON for native review: {"dashboard": "لوحة التحكم", "student": "طالب", "attendance": "حضور", "report": "تقرير"}  <br>**Example**: User switches language, entire interface flips to RTL with Arabic text |
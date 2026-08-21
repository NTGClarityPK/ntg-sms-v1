> **Ops note (2026-08):** Tenant-specific ABC / Raqqa seed scripts were removed.
> Prefer general scripts under `backend/src/scripts/`:
> - `delete-tenant-cleanly.ts` — hard-delete one tenant by code/id
> - `seed-attendance.ts` — mark/refresh attendance for any tenant (`--tenant-code=…`)
> - `seed-assessments.ts` — quizzes + marks for school day(s) (`--tenant-code=…`, `--date` / `--days` / `--from`/`--to`)
>
> The rest of this file remains a historical prompt for one-off ABC demo seeding ideas.

Hey Cursor, I need you to create a complete database seeding script for our Iraqi school management system. This will create realistic test data for ABC School Networks with two branches in Baghdad, Iraq.
Important Context
Before starting:

Read the project structure to understand the database schema
This is a multi-tenant school management system
We use Supabase for database and auth
Location: Baghdad, Iraq (use Iraqi names, addresses, phone numbers)
Current date in the system: March 5, 2026
Academic year: 2025-2026 (Sep 1, 2025 - Jun 30, 2026, currently active)

Existing data:

There are already some students in the database
Highest existing roll number: 0055
New students must start from roll number 0056
Roll numbers are global (unique across all branches/tenants)


Script Requirements
Create a TypeScript seeding script located at: backend/src/scripts/seed-abc-school.ts
Use:

Supabase Admin SDK (@supabase/supabase-js)
Service role key for auth user creation
Direct SQL for bulk inserts
Progress logging so I can see what's being created
Error handling (continue on non-critical errors)

The script should:

Check if ABC School tenant already exists (skip if exists)
Create all data in proper order (respecting foreign keys)
Use realistic Iraqi names, addresses, and data
Generate passwords for auth users (use a simple default like Password123! - we'll change in production)
Log progress: "Creating 260 students...", "Creating attendance records...", etc.
Be idempotent where possible (can run multiple times safely)


School Structure
Tenant

Name: ABC School Networks
Code: ABC-NET
Email: info@abcschool.edu
Phone: +964-770-123-4567
Timezone: Asia/Baghdad
Domain: abcschool.edu

Branches (2)
Branch 1: ABC School - Main Campus

Code: ABC-MAIN
Address: 123 Al-Mansour Street, Baghdad, Iraq
Phone: +964-1-234-5678
Email: main@abcschool.edu

Branch 2: ABC School - Secondary Campus

Code: ABC-SEC
Address: 456 Al-Karrada Avenue, Baghdad, Iraq
Phone: +964-1-876-5432
Email: secondary@abcschool.edu

Academic Year

Name: 2025-2026
Start Date: 2025-09-01
End Date: 2026-06-30
is_active: true
is_locked: false


Classes & Sections
Both branches identical:

Classes: 10 classes (Class 1, Class 2... Class 10)
Sections: 2 per class (A, B)
Total: 20 class sections per branch = 40 total

Class structure:
Class 1: name="class-1", display_name="Class 1", sort_order=1
Class 2: name="class-2", display_name="Class 2", sort_order=2
...
Class 10: name="class-10", display_name="Class 10", sort_order=10
Section structure:
Section A: name="A", sort_order=1
Section B: name="B", sort_order=2

Subjects
Class 1-5 (Primary School)
Core subjects (no templates):

English
Urdu
Mathematics
Science
Social Studies
Islamiyat
Computer

Class 6-8 (Middle School)
Core subjects (no templates):

English
Urdu
Mathematics
Science
Social Studies
Islamiyat
Computer
Art

Class 9-10 (High School)
Core subjects (all students take):

English
Urdu
Mathematics
Islamiyat
Pakistan Studies

Subject Templates (students choose one group):
Template 1: Science Group

Physics
Chemistry
Biology
Computer

Template 2: Computer Group

Physics
Chemistry
Computer Science
Statistics

Template 3: Arts Group

History
Economics
Civics
Fine Arts

Distribution for Class 9-10 students:

60% choose Science
30% choose Computer
10% choose Arts


Assessment Types & Grading
Assessment Types
Create these for each branch:

Quiz - 10% weight, sort_order=1
Assignment - 15% weight, sort_order=2
Mid-term Exam - 25% weight, sort_order=3
Final Exam - 50% weight, sort_order=4

Grading Template
Create one grading template: "Standard Grading"
Grade Ranges:

A+: 90-100%, sort_order=1
A: 80-89%, sort_order=2
B+: 70-79%, sort_order=3
B: 60-69%, sort_order=4
C: 50-59%, sort_order=5
D: 40-49%, sort_order=6 (minimum passing)
F: 0-39%, sort_order=7

Apply this template to all classes via class_grade_assignments.

Users & Roles
Staff (Per Branch)
Branch 1 (Main Campus) - 33 staff:

1 School Admin (tenant-level, can access both branches)
1 Principal (branch-level)
20 Class Teachers (1 per class section)
9 Subject Teachers (Computer×2, Art×2, PE×2, Islamiyat×2, Science Lab×1)
2 Admin Assistants

Branch 2 (Secondary Campus) - 32 staff:

1 Principal (branch-level)
20 Class Teachers
9 Subject Teachers
2 Admin Assistants

Total staff: 65
Staff creation:

Create Supabase auth user (email, password)
Create profile (full_name, phone, address, date_of_birth, gender, current_branch_id)
Create staff record (user_id, branch_id, employee_id, department, join_date)
Create user_branches entry (user_id, branch_id, is_primary)
Create user_roles entry (user_id, role_id, branch_id)

Staff naming (Iraqi names):

Use realistic Iraqi Arabic names
Mix male/female (70% male, 30% female for cultural authenticity)
Examples: Dr. Hassan Al-Baghdadi, Ms. Zainab Ahmed, Mr. Ali Hussein, Ms. Fatima Karim

Email format: firstname.lastname@abcschool.edu

Example: hassan.albaghdadi@abcschool.edu

Employee ID format: EMP-YYYY-NNNN

Example: EMP-2025-0001, EMP-2025-0002

Roles to use:

School Admin: user_role enum = school_admin
Principal: user_role enum = principal
Class Teacher: user_role enum = class_teacher
Subject Teacher: user_role enum = subject_teacher
Admin Assistant: user_role enum = admin_assistant

Important:

The 1 School Admin should have user_branches entries for BOTH branches
All other staff belong to only their branch
Assign class_teacher_id in class_sections table for each class teacher


Students (Random 5-8 per section)
Total students: ~260 (40 sections × avg 6.5 students)
Distribution:

Main Campus: ~130 students (roll 0056-0185)
Secondary Campus: ~130 students (roll 0186-0315)

Important: Roll Number Sequence

Roll numbers are global (unique across all branches)
Start from 0056 (existing max is 0055)
Format: 5-digit zero-padded (00056, 00057, 00058...)
Use the students.student_id column for roll number

Student creation (NO auth users for students):

Create student record:

student_id: Sequential roll number (00056, 00057...)
first_name, last_name: Iraqi names
user_id: NULL (students don't log in with email)
branch_id, class_id, section_id, academic_year_id
admission_date: Random between Sep 1, 2024 - Aug 31, 2025
date_of_birth: Age-appropriate (6 years old for Class 1, 15 years old for Class 10)
gender: Mix 50/50
blood_group: Random (A+, B+, O+, AB+, A-, B-, O-, AB-)
is_active: true


For Class 9-10 students ONLY: Create student_subject_template_assignments

Assign template based on distribution (60% Science, 30% Computer, 10% Arts)



Student naming (Iraqi names):

First names: Ahmed, Ali, Hassan, Omar, Youssef, Zainab, Fatima, Mariam, Sara, Noor
Last names: Al-Baghdadi, Hussein, Karim, Al-Saadi, Rashid, Al-Najjar, Abdullah, Saleh

DO NOT create auth users for students - they use roll number + PIN for authentication (separate system).

Parents (~390 total)
Parent distribution:

80% of students have 2 parents (Father + Mother)
20% of students have 1 parent (Guardian only)

Parent creation:

Create Supabase auth user (email, password)
Create profile (full_name, phone, address, gender)
Create parent_students link:

parent_user_id: Profile user_id
student_id: Student UUID
relationship: "Father", "Mother", or "Guardian"
is_primary: true for first parent, false for second
priority: 1 for primary, 2 for secondary



Parent email format: parentname.studentrollnumber@abcschool.edu

Example: Student roll 00056 (Ahmed Al-Baghdadi)

Father: hassan.00056@abcschool.edu (Hassan Al-Baghdadi - father's name)
Mother: layla.00056@abcschool.edu (Layla Al-Baghdadi - mother's name)



Phone numbers: Iraqi format +964-7XX-XXX-XXXX
Important: Parents do NOT have user_branches or user_roles entries - they're just in the parent_students table.

School Timing & Timetable
School Days
Create school_days for the branch:

Sunday: day_of_week=0, is_active=true
Monday: day_of_week=1, is_active=true
Tuesday: day_of_week=2, is_active=true
Wednesday: day_of_week=3, is_active=true
Thursday: day_of_week=4, is_active=true
Friday: day_of_week=5, is_active=false (weekend)
Saturday: day_of_week=6, is_active=false (weekend)

School operates Sunday-Thursday (Iraqi workweek).
Timing Template
Create one timing template: "Standard School Day"

start_time: 08:00:00
end_time: 14:00:00
period_duration_minutes: 45

Timing slots:

Morning Assembly: 08:00-08:15
Period 1: 08:15-09:00
Period 2: 09:00-09:45
Period 3: 09:45-10:30
Break: 10:30-11:00
Period 4: 11:00-11:45
Period 5: 11:45-12:30
Period 6: 12:30-13:15
Lunch: 13:15-13:45

Note: You can skip creating actual timetable_slots - too complex for seeding. Just create the template.

Assessments
Create assessments for Term 1 (Sep-Dec 2025) and Term 2 (Jan-Mar 2026) only.
Term 1 (Complete, all graded):
For each class section, for each subject:

2 Quizzes (Sep 15, Oct 20)
1 Assignment (Oct 1)
1 Mid-term (Nov 10)
1 Final (Dec 15)

Total: 5 assessments per subject per class section
All Term 1 assessments:

is_published: true
publish_date: Date of assessment
due_date: 7 days after publish date
total_marks: Quizzes=20, Assignment=30, Mid-term=50, Final=100
allow_late_submission: false

Term 2 (Partially complete):
For each class section, for each subject:

2 Quizzes (Jan 15, Feb 20) - graded
1 Assignment (Feb 1) - graded
1 Mid-term (Mar 1) - graded
1 Final (Apr 15) - upcoming (not published yet)

Assessment creation:

Determine which subjects apply to the class
Create assessment record:

title: e.g., "Mathematics Quiz 1 - Class 3-A"
description: e.g., "First quiz covering chapters 1-3"
assessment_type_id: Quiz/Assignment/Mid-term/Final
subject_id, class_section_id, academic_year_id, branch_id
created_by: Relevant teacher user UUID
total_marks, due_date, publish_date, is_published




Student Grades
Term 1 - All Graded
For every Term 1 assessment, create student_grades for each student in that class section:
Grade distribution (bell curve):

15% get A+/A (90-100% of total marks)
40% get B+/B (70-89%)
30% get C (50-69%)
12% get D (40-49%)
3% get F (0-39%)

Fields:

assessment_id, student_id, branch_id, academic_year_id
marks_obtained: Random based on distribution above
submission_status: "submitted"
submitted_at: Due date - random(0-3 days)
graded_by: Teacher user UUID
graded_at: Submitted date + random(1-5 days)
feedback: Optional, 30% of grades get feedback like "Good work!", "Needs improvement in chapter 3"

Term 2 - Partially Graded

Quizzes, Assignment, Mid-term: All graded (same distribution as Term 1)
Final: No grades yet (assessment not published)

Total grades: ~8,000 records

Attendance
Create attendance records for 3 months: September, October, November 2025
Date range: Sep 1, 2025 - Nov 30, 2025 (only school days: Sun-Thu)
For each student, for each school day:

date: School day
status: Randomly distributed:

95% present
2% absent
2% late
1% excused


entry_time: If present/late, random time 07:50-08:15
exit_time: If present/late, 14:00:00
marked_by: Class teacher user UUID
branch_id, class_section_id, student_id, academic_year_id

Attendance pattern (realistic):

70% of students: 98-100% attendance (excellent students)
20% of students: 90-97% attendance (good students)
10% of students: 80-89% attendance (some absences)

Total attendance records: ~15,600 (260 students × 60 school days)

Leave Requests
Create ~80-100 leave requests distributed across Sep-Nov 2025
Status distribution:

60% approved
25% pending
15% rejected

Fields:

student_id: Random student
requested_by: Student's parent user UUID
start_date, end_date: Random dates in Sep-Nov (1-3 days duration)
reason: Random from:

"Medical appointment"
"Family emergency"
"Religious observance"
"Personal matter"


status: Random distribution above
reviewed_by: Principal user UUID (if approved/rejected)
reviewed_at: Request date + 1-2 days (if reviewed)
branch_id, academic_year_id


Early Departure Requests
Create ~30-40 early departure requests distributed across Sep-Nov 2025
Similar to leave requests but:

date: Single date (not date range)
departure_time: Random time 11:00-13:00
Same status distribution and fields as leave requests


Behavioral Assessments
Create behavioral assessments for 2 months: September, October 2025
For each student:

Create 1 assessment per month
assessment_month: First day of month (2025-09-01, 2025-10-01)
assessed_by: Class teacher user UUID
branch_id, academic_year_id

Behavioral Scores (2 attributes per assessment):

Discipline: Score 1-5
Participation: Score 1-5

Score distribution:

5 (Excellent): 40%
4 (Good): 35%
3 (Satisfactory): 20%
2 (Needs Improvement): 4%
1 (Poor): 1%

Total: ~520 assessments, 1,040 scores

Events
Create 5 events:
Past Events:

Parent-Teacher Meeting

title: "First Term Parent-Teacher Meeting"
start_date: 2025-11-15
end_date: 2025-11-15
requires_consent: false
Participants: All class sections


Sports Day

title: "Annual Sports Day 2025"
start_date: 2025-12-20
end_date: 2025-12-20
requires_consent: true
consent_deadline: 2025-12-10
Participants: Classes 6-10 only



Upcoming Events:
3. Science Fair

title: "Science Fair 2026"
start_date: 2026-03-25
end_date: 2026-03-25
requires_consent: false


Annual Day

title: "Annual Day Celebration"
start_date: 2026-05-10
end_date: 2026-05-10
requires_consent: true
consent_deadline: 2026-04-30



Create event_participants for events with participants.

Holidays & Vacations
Create public holidays for Iraq:

Eid al-Fitr (approximate): Apr 10-12, 2026
Eid al-Adha (approximate): Jun 15-18, 2026
Iraqi Independence Day: Oct 3, 2025
Islamic New Year: Variable

Create vacation periods:

Winter Break

name: "Winter Vacation"
start_date: 2025-12-21
end_date: 2026-01-05


Summer Break

name: "Summer Vacation"
start_date: 2026-07-01
end_date: 2026-08-31




Script Structure
Create the script with this structure:
typescriptimport { createClient } from '@supabase/supabase-js';

// Configuration
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function seedABCSchool() {
  console.log('🌱 Starting ABC School seeding...\n');

  try {
    // 1. Check if tenant exists
    console.log('1️⃣ Checking for existing ABC School tenant...');
    // ... implementation

    // 2. Create Tenant
    console.log('2️⃣ Creating tenant: ABC School Networks...');
    // ... implementation

    // 3. Create Branches
    console.log('3️⃣ Creating 2 branches...');
    // ... implementation

    // 4. Create Academic Year
    console.log('4️⃣ Creating academic year 2025-2026...');
    // ... implementation

    // 5. Create Classes & Sections
    console.log('5️⃣ Creating classes and sections...');
    // ... implementation

    // 6. Create Class Sections
    console.log('6️⃣ Creating 40 class sections...');
    // ... implementation

    // 7. Create Subjects
    console.log('7️⃣ Creating subjects...');
    // ... implementation

    // 8. Create Subject Templates (for Class 9-10)
    console.log('8️⃣ Creating subject templates...');
    // ... implementation

    // 9. Create Assessment Types
    console.log('9️⃣ Creating assessment types...');
    // ... implementation

    // 10. Create Grading Template
    console.log('🔟 Creating grading template...');
    // ... implementation

    // 11. Create Roles
    console.log('1️⃣1️⃣ Creating roles...');
    // ... implementation

    // 12. Create Staff (with auth users)
    console.log('1️⃣2️⃣ Creating 65 staff members...');
    // ... implementation

    // 13. Create Students (NO auth users)
    console.log('1️⃣3️⃣ Creating ~260 students (starting from roll 0056)...');
    // ... implementation

    // 14. Create Parents (with auth users)
    console.log('1️⃣4️⃣ Creating ~390 parents...');
    // ... implementation

    // 15. Create Assessments
    console.log('1️⃣5️⃣ Creating assessments for Term 1 & 2...');
    // ... implementation

    // 16. Create Student Grades
    console.log('1️⃣6️⃣ Creating ~8,000 student grades...');
    // ... implementation

    // 17. Create Attendance (3 months)
    console.log('1️⃣7️⃣ Creating ~15,600 attendance records...');
    // ... implementation

    // 18. Create Leave Requests
    console.log('1️⃣8️⃣ Creating leave requests...');
    // ... implementation

    // 19. Create Early Departures
    console.log('1️⃣9️⃣ Creating early departure requests...');
    // ... implementation

    // 20. Create Behavioral Assessments
    console.log('2️⃣0️⃣ Creating behavioral assessments...');
    // ... implementation

    // 21. Create Events
    console.log('2️⃣1️⃣ Creating events...');
    // ... implementation

    // 22. Create Holidays & Vacations
    console.log('2️⃣2️⃣ Creating holidays and vacations...');
    // ... implementation

    console.log('\n✅ Seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   - Tenant: 1');
    console.log('   - Branches: 2');
    console.log('   - Staff: 65');
    console.log('   - Students: ~260');
    console.log('   - Parents: ~390');
    console.log('   - Assessments: ~1,200');
    console.log('   - Grades: ~8,000');
    console.log('   - Attendance: ~15,600');
    console.log('   - Total records: ~27,000');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

// Run the seeding
seedABCSchool();

Important Notes

Iraqi Names: Use authentic Iraqi Arabic names throughout
Dates: Use ISO format (YYYY-MM-DD)
Times: Use 24-hour format (HH:MM:SS)
Phone Numbers: Iraqi format +964-XXX-XXX-XXXX
Addresses: Baghdad, Iraq addresses
Email Domain: All emails end with @abcschool.edu
Roll Numbers: Global sequence starting from 0056
Passwords: Use user123 for all auth users (development only)
Progress Logging: Show clear progress so I know it's working
Error Handling: Log errors but continue where possible


How to Run
After you create the script, add instructions at the top of the file:
typescript/**
 * ABC School Seeding Script
 * 
 * Prerequisites:
 * 1. Set environment variables:
 *    - SUPABASE_URL
 *    - SUPABASE_SERVICE_ROLE_KEY
 * 
 * 2. Install dependencies:
 *    npm install @supabase/supabase-js
 * 
 * 3. Run the script:
 *    npx tsx backend/src/scripts/seed-abc-school.ts
 * 
 * Warning: This creates ~27,000 database records. Use on dev/staging only!
 */

Final Checklist
Make sure the script:

✅ Uses Iraqi names and locations
✅ Starts roll numbers from 00056 (5-digit zero-padded)
✅ Creates 1 school admin (tenant-level)
✅ Creates ~260 students (5-8 per section)
✅ Creates auth users for staff and parents (NOT students)
✅ Creates 3 months of attendance
✅ Creates realistic grade distributions
✅ Uses proper foreign key relationships
✅ Logs progress clearly
✅ Handles errors gracefully
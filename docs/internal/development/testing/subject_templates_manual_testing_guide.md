# Subject Templates Feature - Manual Testing Guide

This guide walks through testing the Subject Templates feature manually via the website UI. All steps should be performed as a **School Admin** unless otherwise specified.

---

## Prerequisites

Before testing, ensure you have:
- ✅ Logged in as **School Admin** (e.g., `admin@alahmar.edu`)
- ✅ Selected a branch (e.g., "Alahmar School")
- ✅ Created at least:
  - 2-3 **Subjects** (e.g., "Mathematics", "Physics", "Chemistry", "Accounting")
  - 2-3 **Classes** (e.g., "Class 9", "Class 10")
  - 1-2 **Levels** (e.g., "Secondary Level")
  - At least one **Class Section** (e.g., "Class 9 - C")
  - An **Active Academic Year**

---

## Test 1: Create Subject Templates

**Goal**: Verify you can create subject templates with subjects assigned.

### Steps:

1. **Navigate to Subject Templates**:
   - Click **Settings** in the sidebar
   - Click the **Academic** tab
   - Click the **Subject Templates** tab

2. **Create First Template (Science Group)**:
   - Click **"New Template"** button
   - Fill in the form:
     - **Name**: `Science Group`
     - **Description**: `Template for science stream students`
     - **Subjects**: Select "Mathematics", "Physics", "Chemistry"
     - **Assign to Classes**: Leave empty
     - **Assign to Levels**: Select "Secondary Level" (or your level)
   - Click **"Create"**
   - ✅ **Expected**: Template appears in the list with subjects and level assignment shown

3. **Create Second Template (Commerce Group)**:
   - Click **"New Template"** again
   - Fill in:
     - **Name**: `Commerce Group`
     - **Description**: `Template for commerce stream students`
     - **Subjects**: Select "Mathematics", "Accounting"
     - **Assign to Classes**: Select "Class 9" (or your class)
     - **Assign to Levels**: Leave empty (should be disabled when classes are selected)
   - Click **"Create"**
   - ✅ **Expected**: Template appears with classes assigned

### Validation:

- ✅ Both templates appear in the list
- ✅ Each template shows its assigned subjects as badges
- ✅ First template shows "Assigned to: Levels: Secondary Level"
- ✅ Second template shows "Assigned to: Classes: Class 9"
- ✅ When selecting **Classes**, the **Levels** dropdown becomes disabled (and vice versa)

---

## Test 2: Edit Subject Template

**Goal**: Verify you can edit template details and assignments.

### Steps:

1. **Edit Science Group Template**:
   - Find "Science Group" in the list
   - Click **"Edit"** button
   - Modify:
     - **Description**: Change to `Updated description for science students`
     - **Subjects**: Add "Biology" to the list
   - Click **"Update"**
   - ✅ **Expected**: Template updates with new description and 4 subjects

2. **Change Assignment from Level to Class**:
   - Edit "Science Group" again
   - **Clear Levels selection** (remove "Secondary Level")
   - **Select Classes** (e.g., "Class 10")
   - Click **"Update"**
   - ✅ **Expected**: Template now shows "Assigned to: Classes: Class 10" instead of levels

---

## Test 3: Mutually Exclusive Assignment (Classes vs Levels)

**Goal**: Verify that selecting Classes disables Levels and vice versa.

### Steps:

1. **Test Classes Selection**:
   - Create a new template or edit existing one
   - Select any **Class** (e.g., "Class 9")
   - ✅ **Expected**: 
     - **Levels** dropdown becomes **disabled** (greyed out)
     - Any previously selected levels are cleared
     - Helper text may indicate "Classes selected, levels disabled"

2. **Test Levels Selection**:
   - Clear the **Classes** selection
   - Select any **Level** (e.g., "Secondary Level")
   - ✅ **Expected**:
     - **Classes** dropdown becomes **disabled**
     - Any previously selected classes are cleared

3. **Test Validation**:
   - Try to create a template with **both** Classes and Levels empty
   - Click **"Create"**
   - ✅ **Expected**: Form validation error: "You must assign to either Classes or Levels"

---

## Test 4: Assign Template to Student

**Goal**: Verify students can be assigned to templates (one per academic year).

### Steps:

1. **Navigate to Students**:
   - Click **Students** in the sidebar
   - Find or create a student (e.g., "John Doe" in "Class 9 - C")

2. **Assign Template to Student**:
   - Click **"Create"** (new student) or **"Edit"** (existing student)
   - Fill in student details:
     - **Full Name**: `John Doe`
     - **Class**: Select "Class 9"
     - **Section**: Select "C"
     - **Subject Template**: Select "Commerce Group" (should show templates available for Class 9)
   - Click **"Create"** or **"Update"**
   - ✅ **Expected**: Student is created/updated with template assignment

3. **Verify Single Template Assignment**:
   - Edit the same student again
   - Change **Subject Template** to "Science Group"
   - Click **"Update"**
   - ✅ **Expected**: 
     - Student's template changes to "Science Group"
     - No error about multiple templates
     - Only ONE template is assigned (old one replaced)

4. **Test Template Availability**:
   - Create a student in "Class 10"
   - Check **Subject Template** dropdown
   - ✅ **Expected**: 
     - Shows templates assigned to "Class 10" or its level
     - Does NOT show templates assigned only to "Class 9"

---

## Test 5: Create Timetable with Subject Template

**Goal**: Verify timetables can be created per subject template.

### Steps:

1. **Navigate to Timetable Management**:
   - Click **"Timetable Management"** in the sidebar
   - Select a class-section (e.g., "Class 9 - C")
   - Click **"View Timetable"**

2. **Select Subject Template**:
   - At the top of the timetable page, you should see a **"Select Subject Template"** dropdown
   - Select **"Commerce Group"**
   - ✅ **Expected**: 
     - Template is selected
     - Indicator shows: "Creating timetable for: Commerce Group"

3. **Create Timetable Slot**:
   - Click on a time slot (e.g., Monday 8:00 AM - 9:00 AM)
   - In the modal:
     - **Subject**: Should only show subjects from "Commerce Group" (e.g., "Mathematics", "Accounting")
     - **Subject**: Select "Mathematics"
     - **Teacher**: Select a teacher
     - **Room**: Enter "Room 101"
     - Click **"Save"**
   - ✅ **Expected**: 
     - Slot is created and appears in the grid
     - Subject dropdown only shows Commerce Group subjects

4. **Create Another Template's Timetable**:
   - Change **Subject Template** dropdown to **"Science Group"**
   - Create a slot for the same time (Monday 8:00 AM - 9:00 AM)
   - Select "Physics" as subject
   - Click **"Save"**
   - ✅ **Expected**: 
     - Both slots exist (Commerce Group slot and Science Group slot)
     - They are separate timetables for the same class-section

5. **Generate from Template**:
   - With "Science Group" selected, click **"Generate from Template"**
   - ✅ **Expected**: 
     - Slots are generated based on timing template
     - All generated slots have `subject_template_id` set to "Science Group"
     - Only Science Group subjects appear in subject dropdowns

---

## Test 6: Student Views Their Timetable

**Goal**: Verify students see only their assigned template's timetable.

### Steps:

1. **Logout as Admin**:
   - Logout from admin account

2. **Login as Student**:
   - Login as a student who has a template assigned (e.g., "John Doe")
   - ✅ **Expected**: Student dashboard loads

3. **Navigate to My Timetable**:
   - Look for **"My Timetable"** link in the sidebar (should be visible for students)
   - Click it

4. **Verify Timetable Display**:
   - ✅ **Expected**: 
     - Page shows: "My Timetable"
     - Shows subject template name: "Subject Template: Commerce Group" (or assigned template)
     - Displays timetable grid with slots from Commerce Group only
     - Does NOT show slots from Science Group (even if they exist for the same class-section)

5. **Test Student Without Template**:
   - Logout and login as a student **without** a template assignment
   - Navigate to **"My Timetable"**
   - ✅ **Expected**: 
     - Shows alert: "No Subject Template Assigned"
     - Message: "No subject template has been assigned to you for this academic year. Please contact your administrator."

---

## Test 7: Template Deletion Protection

**Goal**: Verify templates cannot be deleted if students are assigned or timetables exist.

### Steps:

1. **Try to Delete Template with Student Assignment**:
   - Login as admin
   - Go to **Settings → Academic → Subject Templates**
   - Find "Commerce Group" (which has student assigned)
   - Click **"Delete"**
   - ✅ **Expected**: 
     - Either: Deletion is prevented with error message
     - Or: Confirmation dialog warns about dependent records

2. **Try to Delete Template with Timetable Slots**:
   - Find a template that has timetable slots created
   - Try to delete it
   - ✅ **Expected**: Deletion prevented or warning shown

3. **Delete Template Without Dependencies**:
   - Create a test template with no students or timetables
   - Delete it
   - ✅ **Expected**: Template is deleted successfully

---

## Test 8: Template List and Search

**Goal**: Verify pagination, search, and filtering work correctly.

### Steps:

1. **Test Search**:
   - Go to **Settings → Academic → Subject Templates**
   - In the search box, type "Science"
   - ✅ **Expected**: Only "Science Group" appears in results

2. **Test Pagination** (if you have many templates):
   - Create 5-10 templates
   - Check pagination controls appear
   - Navigate between pages
   - ✅ **Expected**: Templates paginate correctly, page numbers update

---

## Test 9: Template Assignment Validation

**Goal**: Verify validation rules are enforced.

### Steps:

1. **Test Empty Template Name**:
   - Try to create template with empty name
   - ✅ **Expected**: Validation error: "Name is required"

2. **Test No Subjects**:
   - Create template with name but no subjects
   - ✅ **Expected**: Template can be created (subjects optional, can be added later)

3. **Test No Classes/Levels Assignment**:
   - Try to create template without selecting Classes OR Levels
   - ✅ **Expected**: Validation error: "You must assign to either Classes or Levels"

---

## Test 10: Template Card Display

**Goal**: Verify template cards show all information correctly.

### Steps:

1. **Check Template Card**:
   - Go to **Settings → Academic → Subject Templates**
   - Find a template card
   - ✅ **Expected**: Card shows:
     - Template name (bold, large)
     - Description (if provided)
     - Subjects as badges (e.g., "Mathematics", "Physics")
     - Assigned to section: "Assigned to: Classes: Class 9" or "Levels: Secondary Level"
     - Edit and Delete buttons

---

## Critical Test Scenarios

### Scenario 1: Multiple Templates for Same Class-Section

1. Create two templates: "Science Group" and "Commerce Group"
2. Assign both to "Class 9" (or same level)
3. Create timetable slots for "Class 9 - C" with "Science Group" selected
4. Create timetable slots for "Class 9 - C" with "Commerce Group" selected
5. ✅ **Expected**: Both timetables exist independently for the same class-section

### Scenario 2: Student Template Replacement

1. Assign "Commerce Group" to Student A
2. Assign "Science Group" to Student A (same academic year)
3. ✅ **Expected**: 
   - Student A now has "Science Group" only
   - "Commerce Group" assignment is replaced (not added)
   - Database constraint prevents duplicate assignments

### Scenario 3: Template Filtering in Timetable Creation

1. Select "Class 9 - C" timetable
2. Select "Commerce Group" template
3. Open slot creation modal
4. ✅ **Expected**: Subject dropdown only shows Commerce Group subjects (Mathematics, Accounting), NOT Science Group subjects (Physics, Chemistry)

---

## Expected Issues to Watch For

- ❌ **Classes and Levels both enabled** when one is selected → Should be mutually exclusive
- ❌ **Student can see multiple templates** → Should see only one
- ❌ **Timetable shows all slots** regardless of template → Should filter by student's template
- ❌ **Subject dropdown shows all subjects** → Should filter by selected template
- ❌ **Template deletion succeeds** when students/timetables exist → Should be prevented
- ❌ **Student can be assigned multiple templates** → Should replace, not add

---

## Success Criteria

✅ All templates can be created, edited, and deleted (when safe)
✅ Classes and Levels selection is mutually exclusive
✅ Students can be assigned to templates (one per academic year)
✅ Timetables can be created per template for the same class-section
✅ Students see only their assigned template's timetable
✅ Subject dropdowns filter by selected template
✅ Validation prevents invalid operations
✅ UI follows consistent layout patterns (title bar + content area)
✅ Loading/error/empty states display correctly

---

## Notes

- **Arabic name field has been removed** - templates only have English name now
- **One template per student per academic year** is enforced at database level
- **Template assignment is manual** - not automatic based on class/level
- **Timetable slots require template selection** - cannot create slots without selecting a template first






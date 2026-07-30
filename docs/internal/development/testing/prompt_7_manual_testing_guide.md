# Prompt 7: Timetable & Schedule Management - Manual Testing Guide

**Based on:** `prompt_7_timetable_implementation_part_2_6f778eb1.plan.md`  
**Status:** ✅ All features implemented and builds passing

---

## Quick Start Testing Checklist

### ✅ Prerequisites
1. **User Accounts Needed:**
   - School Admin / Principal / Academic Coordinator (for timetable management)
   - Subject Teacher / Class Teacher (for "My Schedule" view)
   - At least one class-section created
   - At least one teacher assignment (teacher assigned to subject for class-section)
   - Optional: Timing template assigned to a class

2. **Data Setup:**
   - Go to `/settings/schedule` → Ensure school days are configured (Monday-Friday active)
   - Go to `/academic/teacher-mapping` → Assign at least one teacher to a subject for a class-section
   - Optional: Go to `/settings/schedule` → Assign a timing template to a class

---

## Test 1: Navigation & Access Control

### Test 1.1: Admin Can Access Timetable Management
**Steps:**
1. Log in as `school_admin`, `principal`, or `academic_coordinator`
2. Look at the left sidebar
3. Find "Timetable Management" link (should be visible)

**Expected:**
- ✅ "Timetable Management" link appears in sidebar
- ✅ Clicking it goes to `/timetable`
- ✅ Page shows class-section selector dropdown

### Test 1.2: Teacher Can Access My Schedule
**Steps:**
1. Log in as `subject_teacher` or `class_teacher`
2. Look at the left sidebar
3. Find "My Schedule" link

**Expected:**
- ✅ "My Schedule" link appears in sidebar
- ✅ Clicking it goes to `/my-schedule`
- ✅ Page shows weekly timetable grid (or empty state if no slots)

### Test 1.3: Non-Teacher Roles Cannot Access
**Steps:**
1. Log in as `parent` or `student`
2. Check sidebar

**Expected:**
- ✅ "Timetable Management" link is NOT visible
- ✅ "My Schedule" link is NOT visible

---

## Test 2: Class Timetable Landing Page (`/timetable`)

### Test 2.1: View Class-Section Selector
**Steps:**
1. Log in as admin/coordinator
2. Go to `/timetable` (via sidebar "Timetable Management")
3. Look at the page

**Expected:**
- ✅ Page title "Timetable Management" or similar
- ✅ Dropdown to select class-section
- ✅ "View Timetable" button (or similar)
- ✅ Active academic year displayed
- ✅ Loading skeleton appears briefly (not spinner)

### Test 2.2: Navigate to Class Timetable
**Steps:**
1. On `/timetable` page
2. Select a class-section from dropdown (e.g., "Class I - A")
3. Click "View Timetable" button

**Expected:**
- ✅ Navigates to `/timetable/class/[classSectionId]`
- ✅ Page shows the class-section name in title
- ✅ Weekly grid appears (or empty state)

---

## Test 3: Class Timetable Grid View (`/timetable/class/[classSectionId]`)

### Test 3.1: View Empty Timetable Grid
**Steps:**
1. Navigate to a class-section timetable page
2. Look at the grid

**Expected:**
- ✅ Page title shows class-section name (e.g., "Class I - A Timetable")
- ✅ "Back" button in title bar
- ✅ "Generate from Template" button visible
- ✅ Grid shows:
  - Days of week as columns (Monday, Tuesday, etc.)
  - Periods as rows (1, 2, 3, ...)
  - Empty cells (clickable to create slots)
- ✅ Loading skeleton appears while loading (not "No records found" flash)

### Test 3.2: Create New Timetable Slot
**Steps:**
1. On class timetable page
2. Click on an empty cell (e.g., Monday, Period 1)
3. Modal opens (SlotEditModal)
4. Fill the form:
   - Select "Slot Type" = "Class"
   - Select a "Subject" (dropdown shows subjects assigned to this class-section)
   - Select a "Teacher" (dropdown shows teachers assigned to selected subject)
   - Enter "Start Time" (e.g., 08:00)
   - Enter "End Time" (e.g., 08:45)
   - Optionally enter "Room" (e.g., "Room 101")
5. Click "Create" button

**Expected:**
- ✅ Modal opens with form fields
- ✅ Subject dropdown only shows subjects for this class-section
- ✅ Teacher dropdown only shows teachers for selected subject
- ✅ Day and period are pre-filled (from clicked cell)
- ✅ After saving:
  - Modal closes
  - Success notification appears
  - Grid updates to show new slot in correct cell
  - Slot displays: subject name, teacher name, room, time range
  - Slot type badge shows "class"

### Test 3.3: Edit Existing Slot
**Steps:**
1. On class timetable page with existing slots
2. Click on an existing slot card
3. Modal opens with form pre-populated
4. Modify fields:
   - Change subject
   - Change teacher
   - Update room number
   - Change times
5. Click "Update" button

**Expected:**
- ✅ Modal opens with ALL fields pre-populated (CRITICAL: No empty fields)
- ✅ Form shows current values (subject, teacher, times, room, slot type)
- ✅ After saving:
  - Modal closes
  - Success notification appears
  - Grid updates to show modified slot
  - Changes are reflected immediately

### Test 3.4: Validation Errors
**Steps:**
1. Click empty cell to create slot
2. Try invalid inputs:
   - End time before start time (e.g., Start: 09:00, End: 08:00)
   - Start time equals end time
   - Leave subject empty when slot type is "Class"

**Expected:**
- ✅ Validation errors appear in form
- ✅ "Save" button is disabled or shows error
- ✅ Error messages are clear (e.g., "Start time must be before end time")
- ✅ Slot is NOT created

### Test 3.5: Special Slot Types
**Steps:**
1. Create slots with different types:
   - "Assembly" slot
   - "Break" slot
   - "Free" slot
2. Check how they appear in grid

**Expected:**
- ✅ Each slot type shows different badge colour:
  - Class = blue
  - Assembly = orange
  - Break = yellow
  - Free = gray
- ✅ All types display correctly in grid

---

## Test 4: Generate Timetable from Template

### Test 4.1: Generate Timetable (Happy Path)
**Prerequisites:**
- Class-section has a timing template assigned (check `/settings/schedule`)
- Timing template has periods configured

**Steps:**
1. Go to class-section timetable page
2. Click "Generate from Template" button
3. Wait for generation to complete

**Expected:**
- ✅ Button is visible and clickable
- ✅ Success notification appears ("Timetable generated successfully")
- ✅ Grid updates to show generated slots:
  - One slot per active school day per period in template
  - Times match timing template
  - Subjects/teachers auto-assigned from teacher assignments where possible
- ✅ Empty slots created for periods without assignments

### Test 4.2: Generate Without Template
**Steps:**
1. Go to a class-section that has NO timing template assigned
2. Try to generate timetable

**Expected:**
- ✅ Error message appears (e.g., "No timing template assigned to this class")
- ✅ No slots are created

---

## Test 5: Conflict Detection

### Test 5.1: View Conflicts
**Steps:**
1. On class timetable page
2. Look for conflict warnings (if any exist)

**Expected:**
- ✅ If conflicts exist:
  - ConflictList component appears at top of page
  - Each conflict shows:
    - Conflict type (e.g., "Teacher double-booking")
    - Message explaining the conflict
    - Details of conflicting slots
- ✅ Slots with conflicts have red border in grid

### Test 5.2: Create Teacher Double-Booking Conflict
**Steps:**
1. Create a slot for Teacher A on Monday, Period 1 (08:00–08:45)
2. Create another slot for the SAME Teacher A on Monday with overlapping time (08:30–09:15)
3. Check conflict list

**Expected:**
- ✅ Conflict warning appears in ConflictList
- ✅ Warning shows "Teacher double-booking" type
- ✅ Message indicates overlapping times
- ✅ Both conflicting slots are listed
- ✅ Both slots have red border in grid

### Test 5.3: Invalid School Day Conflict
**Steps:**
1. Go to `/settings/schedule`
2. Deactivate a school day (e.g., Friday)
3. Go to timetable page
4. Check if Friday slots exist or try to create one

**Expected:**
- ✅ Friday column may not appear (or appears disabled)
- ✅ If Friday slots exist, they show as conflicts
- ✅ Conflict type: "Invalid school day"
- ✅ Cannot create new slots for Friday (validation error)

---

## Test 6: Teacher Schedule View (`/my-schedule`)

### Test 6.1: View My Schedule as Teacher
**Steps:**
1. Log in as `subject_teacher` or `class_teacher`
2. Go to `/my-schedule` (via sidebar "My Schedule")
3. Look at the page

**Expected:**
- ✅ Page title "My Schedule"
- ✅ TeacherWeekView component shows:
  - Weekly grid (days × periods)
  - Your assigned slots showing:
    - Class-section name (e.g., "Class I - A")
    - Subject name
    - Room number (if assigned)
    - Time range
  - Free periods highlighted (different colour/badge)
- ✅ Loading skeleton while loading (not flash of empty state)

### Test 6.2: Multiple Class Assignments
**Steps:**
1. As teacher assigned to multiple class-sections
2. View `/my-schedule`

**Expected:**
- ✅ All your slots appear in grid
- ✅ Different class-sections are clearly shown (by class-section name in slot)
- ✅ Grid is readable and organised

### Test 6.3: Empty Schedule
**Steps:**
1. As teacher with NO timetable slots assigned
2. View `/my-schedule`

**Expected:**
- ✅ Grid shows empty cells
- ✅ Helpful message: "You don't have any timetable slots assigned yet"
- ✅ No errors or crashes

### Test 6.4: Schedule Updates Reflect
**Steps:**
1. As admin, edit a slot assigned to a teacher
2. As that teacher, refresh `/my-schedule` page

**Expected:**
- ✅ Changes appear immediately after refresh
- ✅ Grid updates correctly
- ✅ No stale data

---

## Test 7: Integration Points

### Test 7.1: Teacher Assignments Integration
**Steps:**
1. Go to `/academic/teacher-mapping`
2. Assign Teacher X to Subject Y for Class-Section Z
3. Go to Class-Section Z's timetable page
4. Click empty cell to create slot
5. Select Subject Y in dropdown
6. Check Teacher dropdown

**Expected:**
- ✅ Teacher X appears in dropdown for Subject Y
- ✅ Teachers NOT assigned to Subject Y do NOT appear
- ✅ Only valid teacher-subject combinations are selectable

### Test 7.2: Timing Template Integration
**Steps:**
1. Go to `/settings/schedule`
2. Assign a timing template to a class
3. Go to that class-section's timetable page
4. Click "Generate from Template"

**Expected:**
- ✅ "Generate from Template" button is visible
- ✅ Generated slots match template's periods and times
- ✅ Slots are created for all active school days

### Test 7.3: School Days Integration
**Steps:**
1. Go to `/settings/schedule`
2. Deactivate Friday (set as non-school day)
3. Go to timetable page
4. Try to create slot for Friday

**Expected:**
- ✅ Friday column may not appear (or appears disabled)
- ✅ Cannot create slots for Friday
- ✅ Error: "Day 5 is not an active school day" (if attempted)
- ✅ Existing Friday slots show as conflicts

---

## Test 8: UI/UX & Loading States

### Test 8.1: Loading States
**Steps:**
1. Navigate to `/timetable` or `/timetable/class/[id]`
2. Watch the page load

**Expected:**
- ✅ Loading skeleton appears (NOT a spinner)
- ✅ NO "No records found" flash before data loads
- ✅ Smooth transition when data appears
- ✅ Pattern: `isLoading || !data` shows skeleton, `data.length === 0` shows empty state

### Test 8.2: Theme & Styling
**Steps:**
1. View timetable pages
2. Check styling

**Expected:**
- ✅ All colours come from theme system (no hardcoded colours)
- ✅ Consistent spacing and typography
- ✅ Mantine components used (not custom CSS)
- ✅ Grid is responsive and readable
- ✅ Page follows standard layout pattern (page-title-bar + content area)

### Test 8.3: Error Handling
**Steps:**
1. Disconnect internet (or block API calls in browser DevTools)
2. Try to create/edit a slot
3. Check error handling

**Expected:**
- ✅ Error notification appears with clear message
- ✅ UI doesn't crash
- ✅ User can retry after reconnecting
- ✅ Error message: "Failed to save timetable slot" or similar

---

## Test 9: Data Persistence & Multi-Tenancy

### Test 9.1: Data Persistence
**Steps:**
1. Create/edit/delete timetable slots
2. Refresh browser page (F5)
3. Check if changes persist

**Expected:**
- ✅ All changes are persisted
- ✅ Grid shows correct data after refresh
- ✅ No data loss

### Test 9.2: Multi-Branch Isolation
**Steps:**
1. As admin, create timetable slots in Branch A
2. Switch to Branch B (if you have access)
3. Check timetable for same class-section

**Expected:**
- ✅ Timetable slots from Branch A are NOT visible in Branch B
- ✅ Each branch has its own isolated timetable
- ✅ RLS policies enforce isolation

### Test 9.3: Academic Year Isolation
**Steps:**
1. Create timetable slots for Academic Year 2026-2027
2. Switch to Academic Year 2025-2026 (if multiple exist)
3. Check timetable

**Expected:**
- ✅ Timetable slots from 2026-2027 are NOT visible in 2025-2026
- ✅ Each academic year has its own timetable
- ✅ Academic year filter works correctly

---

## Test 10: Edge Cases

### Test 10.1: Maximum Periods
**Steps:**
1. Create slots for all periods in a day (e.g., 8 periods)
2. Check grid layout

**Expected:**
- ✅ Grid handles maximum periods correctly
- ✅ No layout issues or overflow
- ✅ All slots are visible and clickable

### Test 10.2: Room Assignment
**Steps:**
1. Create slots with and without room assignments
2. Check how they display

**Expected:**
- ✅ Slots with rooms show room numbers (e.g., "Room: 101")
- ✅ Slots without rooms don't show room field (or show empty)
- ✅ Room field is optional in form

### Test 10.3: Time Validation Edge Cases
**Steps:**
1. Try creating slots with:
   - Very early times (e.g., 06:00)
   - Very late times (e.g., 18:00)
   - Same start and end time
   - End time exactly one minute after start

**Expected:**
- ✅ All valid time ranges are accepted
- ✅ Invalid ranges show validation errors
- ✅ Time format is consistent (HH:MM)

---

## Success Criteria Summary

✅ **All tests pass if:**
- Navigation links appear for correct roles
- Timetable grid displays correctly
- Create/edit/delete slots works
- Conflict detection works and shows warnings
- Timetable generation from template works
- Teacher schedule view works
- All pages follow consistent layout patterns
- Loading states work correctly (skeleton, not spinner)
- No TypeScript/build errors
- Multi-tenancy and academic year isolation works

---

## Known Limitations / Notes

- **Delete Slot:** Currently implemented via edit modal (may need separate delete button in future)
- **Conflict Resolution:** Conflicts are detected and displayed, but automatic resolution is not implemented
- **Bulk Operations:** No bulk edit/delete functionality yet
- **Print/Export:** Timetable export/print functionality not implemented

---

**Last Updated:** Based on implementation completion (all todos marked completed)  
**Build Status:** ✅ Backend and Frontend builds successful






# Prompt 9: Events & Activities Management - Manual Testing Guide

**Based on:** `prompt_9_events_&_activities_22c8fa03.plan.md`  
**Status:** ✅ All features implemented and builds passing

---

## Quick Start Testing Checklist

### ✅ Prerequisites
1. **User Accounts Needed:**
   - School Admin / Principal / Academic Coordinator (for events management)
   - Parent (for consent workflow)
   - Teacher (for class events view)
   - Student (for student events view)
   - At least one class-section created
   - At least one student enrolled in a class-section
   - Parent-student association created (for consent testing)

2. **Data Setup:**
   - Go to `/academic/class-sections` → Ensure at least one class-section exists
   - Go to `/students` → Ensure at least one student is enrolled
   - Go to `/parent-associations` → Link a parent to a student
   - Optional: Create an assessment with a due date for conflict testing

---

## Test 1: Navigation & Access Control

### Test 1.1: Admin Can Access Events Management
**Steps:**
1. Log in as `school_admin`, `principal`, or `academic_coordinator`
2. Look at the left sidebar
3. Find "Events Management" link (should be in Management section)

**Expected:**
- ✅ "Events Management" link appears in sidebar
- ✅ Clicking it goes to `/events`
- ✅ Page shows events list (even if empty)

### Test 1.2: Parent/Student/Teacher Can Access My Events
**Steps:**
1. Log in as `parent`, `student`, or `teacher` (subject_teacher/class_teacher)
2. Look at the left sidebar
3. Find "My Events" link (should be in Main section)

**Expected:**
- ✅ "My Events" link appears in sidebar
- ✅ Clicking it goes to `/my-events`
- ✅ Page shows role-appropriate events

### Test 1.3: Role-Based Navigation Visibility
**Steps:**
1. Log in as `parent` or `student`
2. Check sidebar

**Expected:**
- ✅ "My Events" link is visible
- ✅ "Events Management" link is NOT visible

**Steps:**
1. Log in as `school_admin` or `academic_coordinator`
2. Check sidebar

**Expected:**
- ✅ "Events Management" link is visible
- ✅ "My Events" link is also visible (admins can see both)

---

## Test 2: Create Event

### Test 2.1: Create Basic Event (No Consent Required)
**Steps:**
1. Log in as admin/coordinator
2. Go to `/events`
3. Click "Create Event" button (top-right)
4. Fill the form:
   - **Title:** "Science Fair 2024"
   - **Description:** "Annual science exhibition"
   - **Start Date:** Pick a future date (e.g., 2 weeks from today)
   - **End Date:** Same as start date (single-day event)
   - **Requires Parent Consent:** Leave OFF (unchecked)
   - **Class Sections:** Select at least one class-section from dropdown
5. Click "Create Event"

**Expected:**
- ✅ Form shows real class sections (not placeholders)
- ✅ Date pickers work correctly
- ✅ Green success notification appears: "Event created successfully"
- ✅ Redirects back to `/events`
- ✅ New event appears in the list with:
  - Title: "Science Fair 2024"
  - Dates displayed correctly
  - Status badge (Upcoming/Past/Ongoing)
  - "Consent Required" badge should NOT appear

### Test 2.2: Create Multi-Day Event
**Steps:**
1. On `/events`, click "Create Event"
2. Fill the form:
   - **Title:** "Sports Week"
   - **Start Date:** Pick a date
   - **End Date:** Pick a date 3 days later
   - **Class Sections:** Select a class-section
3. Click "Create Event"

**Expected:**
- ✅ Event created successfully
- ✅ In the list, dates show as "MMM D, YYYY – MMM D, YYYY" format
- ✅ Event detail page shows the date range correctly

### Test 2.3: Create Event with Consent Required
**Steps:**
1. On `/events`, click "Create Event"
2. Fill the form:
   - **Title:** "Field Trip to Museum"
   - **Start Date:** Pick a future date
   - **End Date:** Same as start date
   - **Requires Parent Consent:** Toggle ON
   - **Consent Deadline:** Pick a date BEFORE the start date
   - **Class Sections:** Select a class-section with enrolled students
3. Click "Create Event"

**Expected:**
- ✅ Event created successfully
- ✅ In the list, event shows "Consent Required" badge (orange)
- ✅ Consent deadline is displayed
- ✅ Notifications sent to parents of students in the class-section

### Test 2.4: Create Event with Individual Students
**Steps:**
1. On `/events`, click "Create Event"
2. Fill the form:
   - **Title:** "Math Olympiad"
   - **Start Date:** Pick a future date
   - **End Date:** Same as start date
   - **Individual Students:** Select 2-3 students from dropdown
   - Leave "Class Sections" empty
3. Click "Create Event"

**Expected:**
- ✅ Event created successfully
- ✅ Only selected students are participants
- ✅ Multi-select dropdown shows student names with student IDs

### Test 2.5: Validation Errors
**Steps:**
1. Try to create event with:
   - End date BEFORE start date
   - Consent deadline AFTER start date
   - No class sections AND no students selected
2. Try to submit

**Expected:**
- ✅ Form shows validation errors:
  - "End date must be greater than or equal to start date"
  - "Consent deadline must be before or equal to start date"
  - "At least one class section or student must be selected"
- ✅ Form does not submit
- ✅ Error messages are clear and helpful

---

## Test 3: View Event Details

### Test 3.1: View Event Information
**Steps:**
1. On `/events`, find an event you created
2. Click the blue eye icon (View Details) or click on the event title

**Expected:**
- ✅ Navigates to `/events/[id]`
- ✅ Page shows:
  - Event title in header
  - Event dates (formatted nicely)
  - Description (if provided)
  - Status badge (Upcoming/Past/Ongoing)
  - "Consent Required" badge (if applicable)
  - Consent deadline (if applicable)
- ✅ "Edit Event" button visible (for admins/coordinators)

### Test 3.2: View Consent Statistics (Admin Only)
**Steps:**
1. View an event that requires consent
2. Scroll down to "Consent Statistics" section

**Expected:**
- ✅ Shows badges with counts:
  - Approved: X (green)
  - Rejected: X (red)
  - Pending: X (yellow)
  - Total: X (gray)
- ✅ Table shows all consents with:
  - Student name/ID
  - Parent name/ID
  - Status (approved/rejected/pending)
  - Responded At timestamp (if responded)

### Test 3.3: View Conflicts (If Any)
**Steps:**
1. Create an assessment with due date overlapping an event date
2. View the event details page

**Expected:**
- ✅ Yellow alert appears: "Conflicts Detected"
- ✅ Lists conflicting assessments:
  - Assessment title
  - Due date
- ✅ Lists conflicting events (if any):
  - Event title
  - Date range

---

## Test 4: Edit Event

### Test 4.1: Edit Event Details
**Steps:**
1. On event detail page, click "Edit Event" button
2. Change:
   - Title to "Science Fair 2024 - Updated"
   - Description to "Updated description"
   - End date to a different date
3. Click "Update Event"

**Expected:**
- ✅ Edit page loads with form pre-populated (CRITICAL: form shows existing values)
- ✅ All fields are editable
- ✅ Green success notification: "Event updated successfully"
- ✅ Redirects to event detail page
- ✅ Updated values are displayed
- ✅ Notifications sent to all participants about the update

### Test 4.2: Edit Event Participants
**Steps:**
1. Edit an event
2. Change the class sections (add/remove)
3. Update the event

**Expected:**
- ✅ Participants updated successfully
- ✅ New participants receive notifications
- ✅ Consent records recreated for new participants (if consent required)

### Test 4.3: Toggle Consent Requirement
**Steps:**
1. Edit an event that doesn't require consent
2. Toggle "Requires Parent Consent" ON
3. Set a consent deadline
4. Update the event

**Expected:**
- ✅ Event updated successfully
- ✅ Consent records created for all participants
- ✅ Parents receive notifications about consent requirement

---

## Test 5: Delete Event

### Test 5.1: Delete Event
**Steps:**
1. On `/events`, find an event
2. Click three dots menu (⋮)
3. Click "Delete"
4. Confirm deletion in the modal

**Expected:**
- ✅ Confirmation modal appears: "Are you sure you want to delete..."
- ✅ Green success notification: "Event deleted successfully"
- ✅ Event removed from list
- ✅ Event participants and consents also deleted (cascade)

---

## Test 6: Parent Consent Workflow

### Test 6.1: Parent Views Events Requiring Consent
**Steps:**
1. Log in as a parent (who has a child enrolled)
2. Go to `/my-events`
3. Look for events with "Consent Required" badge

**Expected:**
- ✅ Events for their children are listed
- ✅ Events requiring consent are highlighted
- ✅ Shows upcoming and past events separately
- ✅ Each event card shows:
  - Event title
  - Dates
  - Consent status (if applicable)

### Test 6.2: Parent Submits Consent (Approve)
**Steps:**
1. As parent, go to `/my-events`
2. Find an event with "Consent Required" badge
3. Click "View Details"
4. Look for consent section (if visible) or go to event detail page
5. Find your child's consent section
6. Click "Approve" or similar button
7. Optionally add notes: "I agree to send my child"
8. Submit

**Expected:**
- ✅ Consent interface shows:
  - Event details
  - Child's name
  - Current consent status
  - Approve/Reject buttons
  - Notes field (optional)
- ✅ Green success notification: "Consent submitted successfully"
- ✅ Status changes to "Approved"
- ✅ Timestamp recorded
- ✅ IP address captured (in backend audit trail)

### Test 6.3: Parent Submits Consent (Reject)
**Steps:**
1. As parent, find another event requiring consent
2. Click "Reject"
3. Add notes: "Child has prior commitment"
4. Submit

**Expected:**
- ✅ Status changes to "Rejected"
- ✅ Notes saved
- ✅ Timestamp recorded
- ✅ Success notification appears

### Test 6.4: Admin Views Consent Statistics
**Steps:**
1. Log in as admin
2. Go to `/events`
3. View an event that requires consent
4. Scroll to "Consent Statistics" section

**Expected:**
- ✅ Shows accurate counts:
  - Approved: matches number of approved consents
  - Rejected: matches number of rejected consents
  - Pending: matches number of pending consents
- ✅ Table lists all consents with:
  - Student information
  - Parent information
  - Status
  - Response timestamp
  - IP address (if available)

---

## Test 7: Conflict Detection

### Test 7.1: Assessment Conflict Detection
**Steps:**
1. Create an assessment with due date on a specific date
2. Create an event for the same class-section with dates overlapping the assessment due date
3. View the event details page

**Expected:**
- ✅ Yellow warning alert appears: "Conflicts Detected"
- ✅ Lists the conflicting assessment:
  - Assessment title
  - Due date
  - Class section
- ✅ Warning is informative, not blocking (event still created)

### Test 7.2: Event-to-Event Conflict Detection
**Steps:**
1. Create an event for Class 9A on Jan 25-26
2. Create another event for the same class-section on Jan 26-27
3. View the second event details page

**Expected:**
- ✅ Yellow warning alert appears
- ✅ Lists the conflicting event:
  - Event title
  - Date range
- ✅ Both events exist (conflicts are warnings, not errors)

---

## Test 8: Role-Specific Dashboards

### Test 8.1: Parent Dashboard (`/my-events`)
**Steps:**
1. Log in as parent
2. Go to `/my-events`
3. Review the page layout

**Expected:**
- ✅ Page title: "My Events"
- ✅ Two sections:
  - "Upcoming Events" (events with end date in future)
  - "Past Events" (events with end date in past)
- ✅ Each event card shows:
  - Event title
  - Date range
  - Status badge
  - "Consent Required" badge (if applicable)
  - "View Details" button
- ✅ Events are for their children only
- ✅ Pending consent requests are visible

### Test 8.2: Teacher Dashboard (`/my-events`)
**Steps:**
1. Log in as teacher (class_teacher or subject_teacher)
2. Go to `/my-events`
3. Review the events shown

**Expected:**
- ✅ Shows events for:
  - Classes where they are class teacher
  - Classes where they are assigned as subject teacher
- ✅ Events are organized by upcoming/past
- ✅ Can view event details

### Test 8.3: Student Dashboard (`/my-events`)
**Steps:**
1. Log in as student
2. Go to `/my-events`
3. Review the events shown

**Expected:**
- ✅ Shows events where they are participants (either via class-section or individual selection)
- ✅ Events organized by upcoming/past
- ✅ Can view event details
- ✅ Cannot submit consent (only parents can)

### Test 8.4: Admin Dashboard (`/events`)
**Steps:**
1. Log in as admin
2. Go to `/events`
3. Review the full events list

**Expected:**
- ✅ Shows ALL events for the branch
- ✅ Filters available:
  - Search by title
  - Filter by status (All/Upcoming/Past)
  - Filter by consent requirement
  - Date range filters
- ✅ Table columns:
  - Title
  - Dates
  - Status
  - Consent Required
  - Actions (View, Edit, Delete)
- ✅ Pagination works (if more than 20 events)

---

## Test 9: Filters & Search

### Test 9.1: Search Events
**Steps:**
1. On `/events`, type "Science" in the search box
2. Review results

**Expected:**
- ✅ Only events with "Science" in title are shown
- ✅ Search is case-insensitive
- ✅ Results update as you type (or on Enter)

### Test 9.2: Filter by Status
**Steps:**
1. On `/events`, select "Upcoming" from status filter
2. Review results

**Expected:**
- ✅ Only shows events with end date >= today
- ✅ Select "Past" → Only shows events with end date < today
- ✅ Select "All" → Shows all events

### Test 9.3: Filter by Consent Requirement
**Steps:**
1. On `/events`, select "Yes" from "Requires consent" filter
2. Review results

**Expected:**
- ✅ Only shows events where `requires_consent = true`
- ✅ All events show "Consent Required" badge

### Test 9.4: Filter by Date Range
**Steps:**
1. On `/events`, pick a start date and end date
2. Review results

**Expected:**
- ✅ Only shows events that overlap with the date range
- ✅ Date pickers work correctly
- ✅ Can clear filters

---

## Test 10: Notifications

### Test 10.1: Event Created Notification
**Steps:**
1. Create a new event with participants
2. Log in as a parent/student/teacher who is a participant
3. Check notifications (bell icon in header)

**Expected:**
- ✅ Notification appears:
  - Type: "event_created"
  - Title: "New Event: [Event Title]"
  - Body: "A new event '[Event Title]' has been scheduled from [start] to [end]."
  - Data: Contains eventId
- ✅ Notification is unread initially
- ✅ Clicking notification navigates to event detail page

### Test 10.2: Event Updated Notification
**Steps:**
1. As admin, edit an existing event
2. Log in as a participant
3. Check notifications

**Expected:**
- ✅ Notification appears:
  - Type: "event_updated"
  - Title: "Event Updated: [Event Title]"
  - Body: "The event '[Event Title]' has been updated."
- ✅ Participants are notified of changes

### Test 10.3: Consent Required Notification
**Steps:**
1. Create an event with consent required
2. Log in as parent of a participating student
3. Check notifications

**Expected:**
- ✅ Notification about consent requirement
- ✅ Clear call-to-action to view event and submit consent

---

## Test 11: Multi-Tenancy & Branch Isolation

### Test 11.1: Branch Isolation
**Steps:**
1. Create an event in Branch A
2. Switch to Branch B (via branch switcher)
3. Go to `/events`

**Expected:**
- ✅ Events from Branch A are NOT visible
- ✅ Only events for Branch B are shown
- ✅ Cannot access event detail page from Branch A (404 or access denied)

### Test 11.2: Cross-Branch Data Protection
**Steps:**
1. In Branch A, note an event ID from the URL
2. Switch to Branch B
3. Try to access `/events/[eventIdFromBranchA]`

**Expected:**
- ✅ Shows "Event not found" or access denied
- ✅ Cannot view/edit/delete events from other branches

---

## Test 12: Edge Cases & Error Handling

### Test 12.1: Empty States
**Steps:**
1. Go to `/events` with no events created
2. Go to `/my-events` with no events for user

**Expected:**
- ✅ Shows friendly empty state message:
  - `/events`: "No events found. Create your first event to get started."
  - `/my-events`: "No events found. Events you're participating in will appear here."
- ✅ No errors in console
- ✅ Loading skeletons appear briefly before empty state

### Test 12.2: Loading States
**Steps:**
1. Navigate to `/events` (with slow network simulation)
2. Observe loading behavior

**Expected:**
- ✅ Skeleton loaders appear (not spinners)
- ✅ Smooth transition from loading to content
- ✅ No layout shift

### Test 12.3: Form Pre-Population (Edit Mode)
**Steps:**
1. Create an event with all fields filled
2. Edit the event
3. Check if form is pre-populated

**Expected:**
- ✅ **CRITICAL:** All fields show existing values:
  - Title
  - Description
  - Start date
  - End date
  - Consent requirement toggle
  - Consent deadline
- ✅ Form is editable (not read-only)
- ✅ Can change any field

### Test 12.4: Date Validation
**Steps:**
1. Try to create event with:
   - End date = Start date (should work)
   - End date < Start date (should fail)
   - Consent deadline > Start date (should fail)
2. Submit form

**Expected:**
- ✅ Single-day events work (start = end)
- ✅ Validation errors appear for invalid dates
- ✅ Form does not submit with invalid dates

---

## Test 13: Consent Deadline Workflow

### Test 13.1: Consent Deadline Display
**Steps:**
1. Create event with consent deadline
2. View event details

**Expected:**
- ✅ Consent deadline is displayed clearly
- ✅ Deadline is before or equal to start date
- ✅ Deadline is formatted nicely (e.g., "January 20, 2024")

### Test 13.2: Consent After Deadline
**Steps:**
1. Create event with consent deadline in the past
2. As parent, try to submit consent

**Expected:**
- ✅ System allows consent submission (deadline is informational, not blocking)
- ✅ Or shows warning that deadline has passed (depending on implementation)

---

## Test 14: Pagination

### Test 14.1: Pagination Works
**Steps:**
1. Create more than 20 events (or adjust limit)
2. Go to `/events`
3. Navigate to page 2

**Expected:**
- ✅ Pagination controls appear at bottom
- ✅ Can navigate between pages
- ✅ Page numbers update correctly
- ✅ Events load correctly on each page
- ✅ Total count is accurate

---

## Test 15: Integration with Other Features

### Test 15.1: Event Participants Match Class Sections
**Steps:**
1. Create event for a class-section
2. Verify participants

**Expected:**
- ✅ All students in the class-section are participants
- ✅ Consent records created for all students (if consent required)
- ✅ Parents of all students receive notifications

### Test 15.2: Event Participants Match Individual Students
**Steps:**
1. Create event with individual students selected
2. Verify participants

**Expected:**
- ✅ Only selected students are participants
- ✅ Consent records created only for selected students
- ✅ Only parents of selected students receive notifications

---

## ✅ Final Checklist

Before marking as complete, verify:

- [ ] All navigation links work
- [ ] Events can be created, viewed, edited, deleted
- [ ] Consent workflow works end-to-end (parent can approve/reject)
- [ ] Conflict detection shows warnings
- [ ] Role-specific dashboards show correct events
- [ ] Notifications are sent on create/update
- [ ] Filters and search work correctly
- [ ] Multi-tenancy isolation works
- [ ] Form pre-population works in edit mode
- [ ] All validation errors are clear
- [ ] Empty and loading states are handled
- [ ] No console errors
- [ ] Builds pass without errors

---

## 🐛 Common Issues to Watch For

1. **Form not pre-populating:** Check that `useEffect` with `form.setValues()` is used, not just `initialValues`
2. **Wrong events shown:** Verify branch context is correct, check `getMyEvents` logic
3. **Consent not working:** Verify parent-student association exists, check RLS policies
4. **Conflicts not showing:** Verify date overlap logic, check class-section matching
5. **Notifications not sent:** Check notification service integration, verify user IDs are correct

---

**Testing completed by:** _______________  
**Date:** _______________  
**Status:** ✅ Pass / ❌ Issues Found



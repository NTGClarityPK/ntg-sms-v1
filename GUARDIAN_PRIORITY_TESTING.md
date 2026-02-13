# Guardian Priority System - Testing Plan

## Overview
This document outlines how to manually test the guardian priority system implementation from the website UI.

---

## Prerequisites
1. **Admin Access**: You need admin access to create parent/guardian users and link them to students
2. **Test Data**: 
   - At least 2 parent/guardian users created
   - At least 1 student created
   - Parent users should have phone numbers set in their profiles

---

## Test Scenarios

### Test 1: Create First Guardian (Auto-assign Priority 1)
**Steps:**
1. Navigate to **Parent Associations** page (`/parent-associations`)
2. Click **"Create Association"** button
3. Select a student that has **0 guardians**
4. Select a parent/guardian
5. Select relationship (father/mother/guardian)
6. Click **"Create Association"**

**Expected Results:**
- ✅ Alert shows: "Will be set as Primary Guardian (Priority 1)"
- ✅ Alert text: "This student currently has 0 guardian(s). This will be the primary contact."
- ✅ Association created successfully
- ✅ In the table, the guardian shows **"Primary"** badge (green)
- ✅ Guardian's phone number is displayed in the table

---

### Test 2: Create Second Guardian (Auto-assign Priority 2)
**Steps:**
1. Navigate to **Parent Associations** page
2. Click **"Create Association"** button
3. Select the **same student** from Test 1 (now has 1 guardian)
4. Select a **different** parent/guardian
5. Select relationship
6. Click **"Create Association"**

**Expected Results:**
- ✅ Alert shows: "Will be set as Secondary Guardian (Priority 2)"
- ✅ Alert text: "This student currently has 1 guardian(s). This will be the secondary contact."
- ✅ Association created successfully
- ✅ In the table, the second guardian shows **"Secondary"** badge (blue)
- ✅ Both guardians are visible in the table, ordered by priority (Primary first, Secondary second)

---

### Test 3: Attempt to Create Third Guardian (Should Fail)
**Steps:**
1. Navigate to **Parent Associations** page
2. Click **"Create Association"** button
3. Select the **same student** from Test 1 & 2 (now has 2 guardians)
4. Select another parent/guardian
5. Select relationship

**Expected Results:**
- ✅ Alert shows: "Maximum 2 guardians reached"
- ✅ Alert text: "This student already has 2 guardians. Please remove one before adding another."
- ✅ **"Create Association"** button is **disabled**
- ✅ Cannot submit the form

---

### Test 4: View Priority in Parent Associations Table
**Steps:**
1. Navigate to **Parent Associations** page
2. Look at the table columns

**Expected Results:**
- ✅ Table has columns: Parent Name, Student Name, Student ID, Relationship, **Priority**, **Phone**, Can Approve, Actions
- ✅ Priority column shows:
  - **"Primary"** badge (green) for priority 1 guardians
  - **"Secondary"** badge (blue) for priority 2 guardians
- ✅ Phone column shows guardian's phone number (or "—" if not set)
- ✅ Guardians are ordered by priority (Primary first, Secondary second)

---

### Test 5: Remove Primary Guardian (Priority Promotion)
**Steps:**
1. Navigate to **Parent Associations** page
2. Find a student with 2 guardians (Primary and Secondary)
3. Click the **trash icon** to remove the **Primary** guardian
4. Confirm deletion

**Expected Results:**
- ✅ Primary guardian is removed
- ✅ Secondary guardian is **automatically promoted** to Primary (priority changes from 2 to 1)
- ✅ In the table, the remaining guardian now shows **"Primary"** badge (green)
- ✅ Student now has only 1 guardian

---

### Test 6: Remove Secondary Guardian (No Promotion Needed)
**Steps:**
1. Navigate to **Parent Associations** page
2. Find a student with 2 guardians (Primary and Secondary)
3. Click the **trash icon** to remove the **Secondary** guardian
4. Confirm deletion

**Expected Results:**
- ✅ Secondary guardian is removed
- ✅ Primary guardian remains unchanged (still Priority 1)
- ✅ Student now has only 1 guardian
- ✅ Remaining guardian still shows **"Primary"** badge

---

### Test 7: View Emergency Contacts in Student Form
**Steps:**
1. Navigate to **Students** page (`/students`)
2. Click the **edit icon** (pencil) on any student that has guardians
3. Scroll down in the modal

**Expected Results:**
- ✅ **"Emergency Contacts"** section is visible at the bottom
- ✅ Shows all guardians for that student, ordered by priority
- ✅ Each guardian displays:
  - Priority badge (Primary = green, Secondary = blue)
  - Guardian name
  - Relationship in parentheses
  - Phone number with phone icon (if available)
- ✅ If no guardians: Shows yellow alert "No guardians assigned. Add guardians from Parent Associations page."

---

### Test 8: Verify Phone Numbers are Displayed
**Steps:**
1. Ensure parent users have phone numbers set in their profiles
2. Navigate to **Parent Associations** page
3. Create associations with parents who have phone numbers

**Expected Results:**
- ✅ Phone numbers appear in the **Phone** column of the table
- ✅ Phone numbers appear in the **Emergency Contacts** section in Student Form
- ✅ If phone is not set, shows "—" in table

---

### Test 9: Filter by Student in Parent Associations
**Steps:**
1. Navigate to **Parent Associations** page
2. Use the **"Filter by student"** dropdown
3. Select a student that has guardians

**Expected Results:**
- ✅ Table shows only guardians for that student
- ✅ Guardians are ordered by priority (Primary first, Secondary second)
- ✅ Priority badges are correctly displayed

---

### Test 10: Multiple Students with Different Guardian Counts
**Steps:**
1. Create associations for multiple students:
   - Student A: 0 guardians
   - Student B: 1 guardian (Primary)
   - Student C: 2 guardians (Primary + Secondary)
2. Navigate to **Parent Associations** page
3. View all associations

**Expected Results:**
- ✅ All associations are visible
- ✅ Each shows correct priority badge
- ✅ Students with 0 guardians don't appear (no associations)
- ✅ Students with 1 guardian show "Primary"
- ✅ Students with 2 guardians show "Primary" and "Secondary"

---

## Edge Cases to Test

### Edge Case 1: Parent with Multiple Students
**Steps:**
1. Link the same parent to multiple students
2. View parent associations filtered by that parent

**Expected Results:**
- ✅ Parent can be linked to multiple students
- ✅ Each student can have different priority assignments
- ✅ Priority is per-student, not per-parent

### Edge Case 2: Create Association Without Phone Number
**Steps:**
1. Create a parent user without setting phone number
2. Link that parent to a student

**Expected Results:**
- ✅ Association is created successfully
- ✅ Phone column shows "—"
- ✅ Emergency contacts section shows guardian without phone

### Edge Case 3: Update Parent Phone Number
**Steps:**
1. Link a parent to a student
2. Update the parent's phone number in user management
3. View the association again

**Expected Results:**
- ✅ Phone number updates in the association table
- ✅ Phone number updates in emergency contacts section

---

## Verification Checklist

After completing all tests, verify:

- [ ] Maximum 2 guardians enforced per student
- [ ] Priority auto-assigned correctly (1st = Primary, 2nd = Secondary)
- [ ] Priority badges display correctly (Primary = green, Secondary = blue)
- [ ] Phone numbers displayed from guardian profiles
- [ ] Priority promotion works when removing Primary guardian
- [ ] Emergency contacts section shows in Student Form (edit mode)
- [ ] All guardians ordered by priority (1 first, 2 second)
- [ ] Cannot create 3rd guardian (button disabled, alert shown)
- [ ] Table columns show Priority and Phone correctly
- [ ] Backend enforces max 2 guardians constraint

---

## Notes

- **Phone Numbers**: Phone numbers come from the `profiles` table. Make sure parent users have phone numbers set when creating them.
- **Priority Assignment**: Priority is automatically assigned based on current guardian count. You cannot manually set priority in the UI (it's auto-assigned).
- **Emergency Contacts**: Primary Contact = Priority 1 guardian's phone, Secondary Contact = Priority 2 guardian's phone.

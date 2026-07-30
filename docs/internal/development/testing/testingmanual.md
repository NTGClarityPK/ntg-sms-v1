🧪 Manual Testing Guide - Prompt 8: Assessments & Grades
Pre-Test Setup
✅ Backend and Frontend builds successful
✅ Login as a user with Teacher or School Admin role
✅ Ensure you have active academic year, class sections, and students
Test 1: Navigation & Access
Goal: Verify the feature is accessible
Look at the left sidebar
Find "Assessments" menu item (between Attendance and Leaves)
Click it → Should navigate to /assessments
✅ Pass if: You see the assessments list page (even if empty)
Test 2: Create Assessment
Goal: Create a new assessment with all fields
On /assessments, click "Create Assessment" button (top-right)
Fill the form:
Title: "Math Midterm Exam"
Description: "Chapters 1-5"
Assessment Type: Select from dropdown (should show real data, not placeholders)
Subject: Select from dropdown (should show real subjects)
Class Section: Select from dropdown (should show real class sections)
Total Marks: 100
Due Date: Pick a future date
Published: Toggle ON
Click "Create Assessment"
✅ Pass if:
Form shows real options (not "Exam", "Math", "Class 1-A" placeholders)
Green success notification appears
Redirects back to /assessments
Your new assessment appears in the list
Test 3: View Assessment Details
Goal: Verify you can see individual assessment
In the assessments list, find your "Math Midterm Exam"
Click the blue chart icon (View Statistics)
✅ Pass if:
Navigates to /assessments/[id]/statistics
Shows stat cards (Total Students, Graded, Pending, Absent)
Shows ring progress charts
No "Assessment not found" error
Test 4: Edit Assessment
Goal: Modify an existing assessment
Back on /assessments, click three dots menu on your assessment
Click "Edit"
Change the title to "Math Midterm Exam - Updated"
Change Total Marks to 120
Click "Update Assessment"
✅ Pass if:
Edit page shows with form pre-filled
Changes save successfully
Updated values show in the list
Test 5: Grade Entry
Goal: Enter grades for students
On /assessments, click the green eye icon (Grade Entry) on your assessment
You should see a table with real student names (not "John Doe", "Jane Smith")
Enter marks for each student:
Student 1: 85 marks
Student 2: 92 marks
Student 3: Toggle "Absent" switch
Add remarks: "Good work" for Student 1
Click "Save All Grades" button
✅ Pass if:
Table shows actual students from the class section
Can enter marks, toggle absent/excused
Green success notification shows grade count
Grades persist on page refresh
Test 6: View Statistics (Post-Grading)
Goal: Verify analytics update after grading
Navigate to statistics page again (chart icon)
Check the following updated:
Graded Count increased
Pending Count decreased
Average Marks calculated and displayed
Completion Rate shows percentage
✅ Pass if:
Statistics reflect the grades you entered
Charts update with real data
No errors in browser console
Test 7: Delete Protection
Goal: Verify you can't delete assessments with grades
Go back to /assessments
Open the three dots menu on your graded assessment
Click "Delete"
✅ Pass if:
Shows error message: "Cannot delete an assessment with existing grades"
Assessment still exists in the list
Test 8: Multi-Tenancy Check
Goal: Verify branch isolation
If you have multiple branches: Switch to a different branch
Go to /assessments
✅ Pass if:
Only shows assessments for the current branch
Cannot see assessments from other branches
Test 9: Filter & Search
Goal: Test the list filters
On /assessments, use the filters:
Search: Type "Math"
Status: Select "Published"
Try pagination if you have many assessments
✅ Pass if:
Search filters results correctly
Status filter shows only published/unpublished
Pagination works smoothly
Test 10: Loading States
Goal: Verify UX during data loading
Navigate to /assessments/create
Watch the form while it loads
✅ Pass if:
Shows skeleton loaders (not blank page)
Dropdowns populate smoothly
No "undefined" or error flashes
🚨 Common Issues to Watch For
Issue	What to Check
Empty dropdowns	Check if assessment types, subjects, class sections exist in DB
"Student not found"	Ensure students are enrolled in the class section
Grades won't save	Check browser console for errors
404 on edit page	Verify the GET /:id endpoint works
Statistics stuck at 0	Refresh page, check if grades were actually saved
✅ Success Criteria
Feature is complete if you can:
✅ Create, edit, delete assessments
✅ See real data in all dropdowns (not placeholders)
✅ Enter grades for real students
✅ View updated statistics after grading
✅ Navigate between all pages without errors
✅ No "TODO" or placeholder data visible
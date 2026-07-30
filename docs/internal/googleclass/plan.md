# 🎯 Google Classroom Grade Sync - Complete Final Plan

---

## 📋 Executive Summary

**Feature:** Read-only integration with Google Classroom to pull grades (including rubric-based scores) into Alma's Assessment Module. Teachers grade in Google Classroom, click "Pull Grades" in Alma to sync results.

**Key Principles:**
- **Read-only** (no push to Google)
- **Manual sync** (teacher clicks button, not automatic cron)
- **Optional feature** (toggle on/off per branch in settings)
- **Rubric-agnostic** (works with KTAC, custom rubrics, or no rubric)
- **Follows existing Alma patterns**

**Timeline:** 4-5 weeks across 5 phases

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  GOOGLE CLASSROOM (Teachers grade here)             │
│  - Create assignments                                │
│  - Set up any rubric structure                       │
│  - Students submit, teachers grade per-category     │
└─────────────────┬───────────────────────────────────┘
                  │ (Read-only pull, on teacher click)
                  ↓
┌─────────────────────────────────────────────────────┐
│  ALMA                                                │
│  1. Feature Toggle (Enable/Disable per branch)      │
│  2. Google Workspace OAuth Connection               │
│  3. Course Mapping (Alma class ↔ Google course)     │
│  4. Assessment linked to Google coursework          │
│  5. "Pull Grades" button → fetches scores           │
│  6. Rubric-based scores stored + displayed          │
│  7. Reports with per-category breakdown             │
└─────────────────────────────────────────────────────┘
```

---

## 🎨 Feature Toggle System

### **Global Setting Per Branch:**

**Location:** Settings → Integrations → Google Classroom

```
┌──────────────────────────────────────────────┐
│  Google Classroom Integration                 │
├──────────────────────────────────────────────┤
│                                               │
│  Enable Google Classroom sync? [Toggle: OFF] │
│                                               │
│  When disabled:                               │
│  • Google Classroom features hidden           │
│  • No API calls made                          │
│  • Existing linked assessments preserved      │
│                                               │
│  [Save]                                       │
└──────────────────────────────────────────────┘
```

### **Toggle States:**

| State | UI Behavior | Data Behavior |
|-------|-------------|---------------|
| **Disabled (Default)** | No Google Classroom UI visible anywhere | No API calls, no sync |
| **Enabled + Not Connected** | Shows "Connect Google Workspace" prompt | Waits for OAuth |
| **Enabled + Connected** | Full feature available | Grades can be pulled |
| **Re-Disabled After Use** | UI hidden, but data preserved | No new syncs, historic data intact |

---

## 🗄️ Complete Database Schema

### **1. Modify `assessments` Table**

```sql
ALTER TABLE assessments 
  ADD COLUMN grading_source TEXT DEFAULT 'manual', 
    -- 'manual' or 'google_classroom'
  ADD COLUMN google_coursework_id TEXT,
  ADD COLUMN google_course_id TEXT,
  ADD COLUMN google_last_synced_at TIMESTAMPTZ,
  ADD COLUMN has_rubric BOOLEAN DEFAULT false;

CREATE INDEX idx_assessments_google_coursework 
  ON assessments(google_coursework_id) 
  WHERE google_coursework_id IS NOT NULL;

CREATE INDEX idx_assessments_grading_source 
  ON assessments(grading_source, branch_id);
```

---

### **2. New Table: `assessment_rubrics`**

Stores rubric metadata for an assessment.

```sql
CREATE TABLE assessment_rubrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id),
  tenant_id UUID NOT NULL,
  
  -- Rubric identification
  rubric_type TEXT NOT NULL DEFAULT 'custom', 
    -- 'ktac' | 'custom' | 'preset_named'
  preset_id UUID REFERENCES rubric_presets(id), 
    -- If based on a preset
  
  total_marks DECIMAL(6,2) NOT NULL,
  source TEXT DEFAULT 'alma', 
    -- 'alma' (created in Alma) or 'google_classroom' (imported from Google)
  google_rubric_id TEXT, -- Google's rubric ID if imported
  
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_assessment_rubrics_unique 
  ON assessment_rubrics(assessment_id);
CREATE INDEX idx_assessment_rubrics_branch 
  ON assessment_rubrics(branch_id);
```

---

### **3. New Table: `rubric_categories`**

Individual categories within a rubric (Knowledge, Thinking, or any custom category).

```sql
CREATE TABLE rubric_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id UUID NOT NULL REFERENCES assessment_rubrics(id) ON DELETE CASCADE,
  
  category_name TEXT NOT NULL, 
    -- e.g., 'Knowledge and Understanding', 'Creativity', 'Effort'
  category_code TEXT, 
    -- Short code: 'K', 'T', 'A', 'C' (optional)
  max_marks DECIMAL(6,2) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  description TEXT,
  
  -- Google mapping
  google_criterion_id TEXT, -- Maps to Google's rubric criterion
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rubric_categories_rubric ON rubric_categories(rubric_id);
CREATE INDEX idx_rubric_categories_google ON rubric_categories(google_criterion_id) 
  WHERE google_criterion_id IS NOT NULL;
```

---

### **4. New Table: `rubric_presets`**

Reusable rubric templates (KTAC, Cambridge, custom presets).

```sql
CREATE TABLE rubric_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id), 
    -- NULL = global preset (like KTAC)
  tenant_id UUID,
  
  preset_name TEXT NOT NULL, 
    -- 'Ontario KTAC', 'Cambridge O-Level', 'Simple 4-Category'
  preset_code TEXT UNIQUE, 
    -- 'ontario_ktac', 'cambridge_ol'
  description TEXT,
  is_global BOOLEAN DEFAULT false, 
    -- true for system-provided (KTAC etc)
  is_active BOOLEAN DEFAULT true,
  
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories in the preset
CREATE TABLE rubric_preset_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id UUID NOT NULL REFERENCES rubric_presets(id) ON DELETE CASCADE,
  
  category_name TEXT NOT NULL,
  category_code TEXT,
  default_marks DECIMAL(6,2),
  sort_order INTEGER DEFAULT 0,
  description TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Seed data (KTAC preset):**
```sql
INSERT INTO rubric_presets (preset_name, preset_code, is_global, description) 
VALUES ('Ontario KTAC', 'ontario_ktac', true, 
  'Ontario Ministry of Education 4-category assessment framework');

-- Then seed the 4 KTAC categories
```

---

### **5. New Table: `student_rubric_scores`**

Per-category marks for each student.

```sql
CREATE TABLE student_rubric_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_grade_id UUID NOT NULL REFERENCES student_grades(id) ON DELETE CASCADE,
  rubric_category_id UUID NOT NULL REFERENCES rubric_categories(id),
  
  marks_obtained DECIMAL(6,2),
  feedback TEXT,
  
  branch_id UUID NOT NULL,
  graded_by UUID,
  graded_at TIMESTAMPTZ,
  source TEXT DEFAULT 'manual', 
    -- 'manual' or 'google_classroom'
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_student_rubric_scores_unique 
  ON student_rubric_scores(student_grade_id, rubric_category_id);
CREATE INDEX idx_student_rubric_scores_branch 
  ON student_rubric_scores(branch_id);
```

---

### **6. New Table: `google_workspace_settings`**

Follows your `*_settings` pattern (one per branch).

```sql
CREATE TABLE google_workspace_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) UNIQUE,
  tenant_id UUID,
  
  -- Feature toggle
  is_feature_enabled BOOLEAN DEFAULT false, 
    -- The master on/off switch
  
  -- Connection state
  is_connected BOOLEAN DEFAULT false,
  google_domain TEXT, -- 'schoolname.edu'
  connected_email TEXT, -- 'admin@schoolname.edu'
  connected_by_user_id UUID,
  connected_at TIMESTAMPTZ,
  
  -- OAuth tokens (encrypted)
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[], -- Array of granted scopes
  
  -- Sync tracking
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT, -- 'success', 'partial', 'failed'
  last_sync_error TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### **7. New Table: `google_classroom_course_mappings`**

Maps Alma class-section+subject to Google Classroom courses.

```sql
CREATE TABLE google_classroom_course_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  class_section_id UUID NOT NULL REFERENCES class_sections(id),
  subject_id UUID NOT NULL REFERENCES subjects(id),
  
  google_course_id TEXT NOT NULL,
  google_course_name TEXT,
  google_course_section TEXT, -- Sometimes courses have section info
  
  linked_by_user_id UUID,
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_gc_mapping_unique 
  ON google_classroom_course_mappings(class_section_id, subject_id) 
  WHERE is_active = true;
CREATE INDEX idx_gc_mapping_branch 
  ON google_classroom_course_mappings(branch_id);
```

---

### **8. New Table: `google_sync_audit_log`**

Track all sync attempts for troubleshooting.

```sql
CREATE TABLE google_sync_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  assessment_id UUID REFERENCES assessments(id),
  triggered_by_user_id UUID,
  
  sync_status TEXT, -- 'started', 'success', 'partial', 'failed'
  students_synced INTEGER DEFAULT 0,
  students_failed INTEGER DEFAULT 0,
  error_message TEXT,
  duration_ms INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sync_audit_assessment ON google_sync_audit_log(assessment_id);
CREATE INDEX idx_sync_audit_branch_date ON google_sync_audit_log(branch_id, created_at DESC);
```

---

### **9. Permissions Setup**

```sql
-- Feature entries
INSERT INTO features (code, name) VALUES 
  ('google_classroom_integration', 'Google Classroom Integration'),
  ('assessment_rubrics', 'Assessment Rubrics');

-- Role permissions (mirror existing patterns)
-- edit: school_admin, principal
-- view: teachers (their own class/subject only)
-- none: everyone else
```

---

## 📁 Backend Module Structure

```
backend/src/modules/
  ├── google-workspace/                  ← NEW
  │   ├── google-workspace.module.ts
  │   ├── google-workspace.controller.ts
  │   ├── google-workspace.service.ts
  │   ├── services/
  │   │   ├── google-oauth.service.ts       # OAuth flow, token management
  │   │   ├── google-classroom-api.service.ts # API wrapper
  │   │   ├── token-encryption.service.ts   # Encrypt/decrypt tokens
  │   │   └── grade-pull.service.ts         # Grade sync logic
  │   ├── dtos/
  │   │   ├── connect-google.dto.ts
  │   │   ├── map-course.dto.ts
  │   │   ├── link-assessment.dto.ts
  │   │   └── pull-grades.dto.ts
  │   └── types/
  │       └── google-classroom.types.ts
  │
  ├── rubrics/                            ← NEW
  │   ├── rubrics.module.ts
  │   ├── rubrics.controller.ts
  │   ├── rubrics.service.ts
  │   ├── services/
  │   │   ├── rubric-preset.service.ts     # Preset management
  │   │   └── rubric-import.service.ts     # Import from Google
  │   └── dtos/
  │       ├── create-rubric.dto.ts
  │       ├── update-rubric.dto.ts
  │       └── student-rubric-score.dto.ts
  │
  └── assessments/                        ← EXTEND EXISTING
      ├── assessments.controller.ts        # Add rubric endpoints
      └── assessments.service.ts           # Add Google link logic
```

---

## 🔌 Complete API Endpoints

### **Google Workspace Management**

```
GET    /api/v1/google-workspace/settings
  Returns: feature toggle status, connection status, sync stats

PUT    /api/v1/google-workspace/settings
  Body: { is_feature_enabled: boolean }
  Access: school_admin, principal
  Toggles the master feature on/off

POST   /api/v1/google-workspace/connect
  Initiates OAuth flow, returns Google auth URL
  Access: school_admin, principal (only if feature enabled)

GET    /api/v1/google-workspace/oauth-callback
  Handles Google OAuth callback, stores encrypted tokens

POST   /api/v1/google-workspace/disconnect
  Revokes tokens, sets is_connected = false
  Access: school_admin, principal

POST   /api/v1/google-workspace/test-connection
  Verifies tokens work by calling Google API
  Returns: { success: boolean, error?: string }
```

### **Course Mapping**

```
GET    /api/v1/google-workspace/courses
  Fetches teacher's Google Classroom courses (live)
  Access: teachers (their own courses only)

GET    /api/v1/google-workspace/mappings
  Lists all Alma-Google course mappings for branch
  Access: school_admin, principal, teachers (view own)

POST   /api/v1/google-workspace/mappings
  Body: { class_section_id, subject_id, google_course_id }
  Creates a mapping
  Access: school_admin, principal

DELETE /api/v1/google-workspace/mappings/:id
  Removes a mapping (doesn't affect existing linked assessments)
  Access: school_admin, principal

POST   /api/v1/google-workspace/mappings/auto-suggest
  Auto-suggests mappings by name matching
  Returns: array of suggested pairs
  Access: school_admin, principal
```

### **Assessment ↔ Google Linking**

```
GET    /api/v1/google-workspace/coursework/:googleCourseId
  Fetches all assignments in a Google course
  Access: teachers (must be teacher of that course)

POST   /api/v1/assessments/:id/link-google
  Body: { google_coursework_id }
  Links Alma assessment to Google assignment
  Auto-imports rubric structure from Google if present
  Access: teachers assigned to that class-subject

DELETE /api/v1/assessments/:id/link-google
  Unlinks (assessment stays, marks preserved, no more syncs)
  Access: teachers assigned to that class-subject

POST   /api/v1/assessments/:id/pull-grades  ← MAIN SYNC ENDPOINT
  Manual grade pull triggered by teacher click
  Returns: { synced: N, failed: N, message: string }
  Access: teachers assigned to that class-subject
```

### **Rubrics**

```
GET    /api/v1/rubrics/presets
  Lists global and branch-specific presets
  Access: any authenticated user

POST   /api/v1/rubrics/presets
  Creates custom preset
  Access: school_admin, principal

GET    /api/v1/assessments/:id/rubric
  Returns rubric structure + all student scores

POST   /api/v1/assessments/:id/rubric
  Body: { preset_id?, categories: [{name, code?, max_marks, sort_order}] }
  Creates rubric for assessment (manual or from preset)
  Access: teachers assigned

PUT    /api/v1/assessments/:id/rubric
  Updates rubric (blocked if student scores exist)
  Access: teachers assigned

DELETE /api/v1/assessments/:id/rubric
  Removes rubric (only if no scores yet)
  Access: teachers assigned
```

### **Student Rubric Scores**

```
GET    /api/v1/assessments/:id/rubric-scores
  Returns all students' per-category scores

PUT    /api/v1/student-grades/:id/rubric-scores
  Body: { scores: [{ category_id, marks_obtained, feedback? }] }
  Manual entry of per-category scores
  Access: teachers assigned

GET    /api/v1/students/:id/rubric-breakdown
  Query params: subject_id?, academic_year_id?
  Returns aggregated per-category performance for reports
```

### **Sync Audit & Monitoring**

```
GET    /api/v1/google-workspace/sync-history
  Query: assessment_id?, from_date?, to_date?
  Returns paginated sync log
  Access: school_admin, principal, teachers (own only)

GET    /api/v1/assessments/:id/sync-status
  Returns latest sync info for an assessment
```

---

## 🎨 Frontend Structure

```
frontend/src/app/(portal)/
  ├── settings/
  │   ├── integrations/                    ← NEW SECTION
  │   │   └── google-classroom/
  │   │       └── page.tsx                 # Toggle, Connect, Course Mapping
  │   │
  │   └── rubrics/                          ← NEW
  │       └── page.tsx                     # Manage rubric presets
  │
  ├── assessments/
  │   ├── page.tsx                         # EXTEND: show Google/Manual badges
  │   ├── new/page.tsx                     # EXTEND: rubric section, Google link
  │   └── [id]/
  │       ├── page.tsx                     # EXTEND: sync button, breakdown
  │       ├── rubric/page.tsx              # Rubric editor
  │       └── sync-history/page.tsx        # NEW: audit log for this assessment
  │
  └── components/features/
      ├── google-classroom/                 ← NEW
      │   ├── FeatureToggle.tsx            # Enable/disable master switch
      │   ├── ConnectionCard.tsx           # OAuth connect/disconnect
      │   ├── CourseMappingTable.tsx       # Manage mappings
      │   ├── AutoSuggestMappings.tsx      # Bulk auto-map
      │   ├── LinkAssessmentModal.tsx      # Pick Google coursework
      │   ├── PullGradesButton.tsx         # "Pull Grades" button + status
      │   ├── SyncStatusBadge.tsx          # Visual indicator
      │   └── SyncHistoryTable.tsx         # Audit log display
      │
      └── rubrics/                          ← NEW
          ├── RubricBuilder.tsx            # Create/edit rubric
          ├── PresetSelector.tsx           # Choose preset (KTAC, etc)
          ├── CategoryEditor.tsx           # Add/edit categories
          ├── PerCategoryScoreEntry.tsx    # Manual score entry
          └── RubricBreakdownDisplay.tsx   # Read-only display
```

---

## 📅 Phased Implementation Plan

### **Phase 1: Rubric Foundation (Week 1)**
**Goal:** Rubric support in Alma (no Google integration yet)

**Deliverables:**
- Migration: `assessment_rubrics`, `rubric_categories`, `rubric_presets`, `rubric_preset_categories`, `student_rubric_scores`
- Seed KTAC preset (global)
- Seed 1-2 other example presets
- Backend: rubrics module (CRUD)
- Frontend: 
  - Rubric Builder component
  - Preset Selector with "Use KTAC" quick button
  - Per-category score entry in student grades
  - Rubric breakdown display
- Reports: Show per-category scores
- Permissions: `assessment_rubrics` feature

**Independent Value:** Even without Google, teachers can now:
- Create assessments with any rubric structure
- Enter per-category marks manually
- Show detailed breakdown to parents

**Testing:**
1. Create KTAC assessment → enter marks per category → see breakdown
2. Create custom rubric (e.g., "Creativity 10, Effort 5, Neatness 5")
3. Reports display categories correctly

---

### **Phase 2: Google Feature Toggle + OAuth (Week 2)**
**Goal:** Enable/disable + connect Google Workspace

**Deliverables:**
- Migration: `google_workspace_settings`
- Google Cloud Console setup (documented checklist)
- Backend:
  - Feature toggle endpoint
  - OAuth service (uses existing Google OAuth foundation)
  - Token encryption service
  - Test connection endpoint
- Frontend:
  - Settings → Integrations page
  - Feature toggle (on/off)
  - "Connect Google Workspace" button (only when enabled)
  - Connection status display
  - Disconnect button
- Permissions: `google_classroom_integration` feature

**Google Cloud Setup Checklist:**
1. Create Google Cloud project
2. Enable Google Classroom API
3. Configure OAuth consent screen
4. Create OAuth 2.0 client (Web application)
5. Set redirect URI
6. Add scopes (read-only)
7. Get client ID + secret → add to Alma env

**Testing:**
1. Admin toggles feature ON → Google Classroom UI appears
2. Admin toggles OFF → UI hidden
3. Admin connects → shows "Connected as admin@school.edu"
4. Admin disconnects → status shows disconnected
5. Test connection → verifies tokens work

---

### **Phase 3: Course Mapping (Week 2-3)**
**Goal:** Link Alma classes to Google courses

**Deliverables:**
- Migration: `google_classroom_course_mappings`
- Backend:
  - Fetch teacher's Google courses (uses their OAuth)
  - CRUD endpoints for mappings
  - Auto-suggest logic (name similarity)
- Frontend:
  - Course Mapping page (settings)
  - Table showing Alma class+subject → Google course
  - Manual pairing UI
  - "Auto-suggest matches" button
  - Bulk apply suggestions

**Testing:**
1. Admin sees list of teachers' Google courses
2. Manual pair: "Class 10-A Math" ↔ "MCR3U 2024"
3. Auto-suggest identifies 8/10 obvious matches
4. Deactivate mapping (soft delete)

---

### **Phase 4: Assessment Linking + Rubric Import (Week 3-4)**
**Goal:** Link Alma assessments to Google coursework, import rubric structure

**Deliverables:**
- Modify `assessments` table (add Google columns)
- Backend:
  - Fetch coursework for a Google course
  - Link/unlink endpoints
  - **Rubric import logic**: When linking, fetch Google's rubric criteria and auto-create matching `rubric_categories` in Alma
  - Handle case where Google has no rubric (fall back to total marks only)
- Frontend:
  - Extend assessment creation flow
  - "Grading Method" section: Manual vs Google Classroom
  - When "Google Classroom" selected:
    - Dropdown of Google coursework for that class
    - Preview imported rubric structure
    - Confirm & save
  - "Link to Google" option on existing assessments too

**Rubric Import Logic:**
```
When teacher links assessment to Google coursework:
  1. Fetch coursework from Google (includes rubric if present)
  2. If rubric exists:
     - Create assessment_rubrics record (source='google_classroom')
     - Create rubric_categories for each Google criterion
     - Store google_criterion_id for mapping back
  3. If no rubric:
     - Just link the coursework_id
     - Grades will be total marks only
```

**Testing:**
1. Link Alma "Unit 6 Test" to Google "Unit 6 Trigonometry Test"
2. Google has KTAC rubric → Alma auto-imports 4 categories
3. Link assessment with no Google rubric → works with total marks only
4. Unlink assessment → keeps existing scores, no new syncs

---

### **Phase 5: Manual Grade Pull + Sync UI (Week 4-5)**
**Goal:** Teacher clicks "Pull Grades" → grades sync

**Deliverables:**
- Migration: `google_sync_audit_log`
- Backend:
  - `POST /assessments/:id/pull-grades` endpoint
  - Grade pull service:
    - Fetches student submissions from Google
    - Fetches rubric scores per submission
    - Maps Google student IDs to Alma students (by email)
    - Updates `student_grades` (total marks)
    - Updates `student_rubric_scores` (per-category if rubric)
    - Logs to audit table
  - Error handling for common cases:
    - Student in Google not in Alma
    - Student in Alma not in Google class
    - Token expired (auto-refresh)
    - Google API rate limits
- Frontend:
  - "Pull Grades" button on assessment page (prominent)
  - Loading state during sync
  - Success/error toast with details
  - Sync status badge (Never synced, Last synced X ago, Errors)
  - Sync history page (per assessment)
  - Confirmation before pulling if scores already exist

**Sync Behavior:**
```
When teacher clicks "Pull Grades":
  1. Show confirmation if scores already exist
  2. Call Google API for student submissions
  3. For each submission:
     a. Match student by email
     b. Extract total score
     c. Extract per-criterion scores (if rubric)
     d. Update or create student_grades
     e. Update or create student_rubric_scores
  4. Log all outcomes
  5. Show summary: "18 students synced, 2 not found in Alma"
```

**Testing:**
1. Teacher grades 20 students in Google → clicks "Pull Grades" in Alma
2. All 20 scores appear with KTAC breakdown
3. Teacher re-grades in Google → clicks "Pull Grades" → updates work
4. Sync history shows all attempts
5. Handle: Google assignment deleted → clear error message

---

## 🎨 Complete UI Screens

### **Screen 1: Settings → Integrations → Google Classroom**

```
┌─────────────────────────────────────────────────────┐
│  Google Classroom Integration                        │
│  Grade sync with Google Classroom                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Enable Feature: [Toggle ON/OFF]                    │
│                                                      │
│  ─── When Enabled ───                                │
│                                                      │
│  Connection Status:                                  │
│  ● Connected as admin@credoschool.edu                │
│  Connected on Dec 10, 2024                          │
│                                                      │
│  [Test Connection]  [Disconnect]                    │
│                                                      │
│  ─── Course Mappings ───                             │
│                                                      │
│  Map Alma classes to Google Classroom courses:      │
│                                                      │
│  [Auto-suggest matches]  [Add Manual Mapping]       │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ Alma Class-Subject    │ Google Course        │  │
│  ├──────────────────────┼──────────────────────┤  │
│  │ Class 10-A Math      │ MCR3U 2024 ✓         │  │
│  │ Class 10-B Math      │ MCR3U 2024 (Section B)│  │
│  │ Class 9-A Science    │ Not mapped [Link]    │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

### **Screen 2: Create Assessment (Modified)**

```
┌─────────────────────────────────────────────────────┐
│  Create Assessment                                   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Title: [Unit 6 Trigonometry Test              ]    │
│  Subject: [Math                            ▼]       │
│  Class: [Class 10-A                        ▼]       │
│  Type: [Term Test                          ▼]       │
│  Total Marks: [35]                                  │
│  Due Date: [Dec 15, 2024]                          │
│                                                      │
│  ─── Grading Method ───                              │
│                                                      │
│  ○ Manual entry                                     │
│  ● Grade via Google Classroom                       │
│    (Available: Feature enabled + Connected)         │
│                                                      │
│    Link to Google assignment:                       │
│    [Select assignment                  ▼]           │
│      • Unit 5 Quiz                                  │
│      • Unit 6 Trigonometry Test ← selected          │
│      • Midterm Review                               │
│                                                      │
│    ✓ Rubric detected in Google Classroom:           │
│      • Knowledge (10 marks)                         │
│      • Thinking (8 marks)                           │
│      • Application (12 marks)                       │
│      • Communication (5 marks)                      │
│                                                      │
│  ─── OR ───                                          │
│                                                      │
│  ○ Manual entry with rubric                         │
│    [Use KTAC preset] [Custom rubric]                │
│                                                      │
│  [Cancel]                    [Create Assessment]    │
└─────────────────────────────────────────────────────┘
```

---

### **Screen 3: Assessment Detail (with Google Link)**

```
┌─────────────────────────────────────────────────────┐
│  Unit 6 Trigonometry Test        [🔗 Google Synced] │
│  Class 10-A Math • Term Test • 35 marks             │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ Google Classroom Sync                         │  │
│  │                                                │  │
│  │ Linked to: MCR3U 2024 › Unit 6 Trig Test     │  │
│  │ Last synced: 2 hours ago (18/20 students)    │  │
│  │                                                │  │
│  │ [🔄 Pull Grades]  [Unlink] [View History]    │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ─── Student Grades ───                              │
│                                                      │
│  ┌───────────┬─────┬────┬────┬────┬─────┬──────┐  │
│  │ Student   │ K   │ T  │ A  │ C  │Total│Status│  │
│  ├───────────┼─────┼────┼────┼────┼─────┼──────┤  │
│  │ Ahmed Ali │ 9/10│6/8 │11/12│4/5│ 30  │  ✓   │  │
│  │ Sara K.   │10/10│8/8 │12/12│5/5│ 35  │  ✓   │  │
│  │ Zain M.   │ 7/10│5/8 │ 9/12│3/5│ 24  │  ✓   │  │
│  │ Fatima H. │  -  │ -  │  -  │ - │  -  │Pending│ │
│  └───────────┴─────┴────┴────┴────┴─────┴──────┘  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

### **Screen 4: Manual Rubric Entry (No Google)**

```
┌─────────────────────────────────────────────────────┐
│  Enter Marks: Unit 5 Quiz                            │
│  Rubric: Ontario KTAC (35 total)                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Student: Ahmed Ali                                 │
│                                                      │
│  Knowledge (out of 10):    [9]                      │
│  Thinking (out of 8):      [6]                      │
│  Application (out of 12):  [11]                     │
│  Communication (out of 5): [4]                      │
│  ─────────────────────                              │
│  Total: 30 / 35                                     │
│                                                      │
│  Feedback:                                          │
│  [Great work on the application section...]         │
│                                                      │
│  [Previous]  [Save & Next Student]                  │
└─────────────────────────────────────────────────────┘
```

---

## 🔐 Security & Best Practices

**Token Management:**
- Encrypt all tokens at rest (use Supabase Vault or app-level encryption)
- Never send tokens to frontend
- Auto-refresh access tokens before expiry
- On refresh failure, mark connection as broken (require reconnect)

**Permission Checks:**
- Feature toggle checked at every endpoint
- Teacher can only pull grades for classes they're assigned to
- Admin-only for connect/disconnect/mappings
- Audit log all sync operations

**Data Privacy:**
- Only request read-only scopes
- Show clear consent screen: "Alma will read your Google Classroom assignments and grades"
- Data stays within your school's Google Workspace domain
- No student PII sent to Google beyond what's already there

**Rate Limiting:**
- Google API: 1,200 queries/min per user (very high)
- Add debounce on "Pull Grades" button (prevent double-clicks)
- Batch API calls where possible

---

## 📋 Final Cursor Prompt

Here's the complete, ready-to-use prompt:

---

### **Feature: Google Classroom Grade Sync + Flexible Rubric System**

**Context:** Add ability for teachers to pull grades (including rubric-based scores) from Google Classroom into Alma's Assessment Module. Rubric system works standalone too (any rubric structure, not just Ontario KTAC). Feature is opt-in per branch via settings toggle. Sync is manual (teacher clicks "Pull Grades" button), not automatic cron.

**Core Principles:**
1. Read-only integration (no data pushed to Google)
2. Manual sync (teacher-triggered, not scheduled)
3. Optional feature (branch-level enable/disable toggle)
4. Rubric-agnostic (works with KTAC, Cambridge, custom, or no rubric)
5. Follows existing Alma patterns (branch-scoped, RLS, permissions matrix)

**User Flow:**
1. Admin enables Google Classroom feature in Settings
2. Admin connects branch's Google Workspace (OAuth)
3. Admin maps Alma class-sections to Google Classroom courses
4. Teacher creates assessment in Alma (normal flow) with:
   - Option A: Manual entry (with or without rubric)
   - Option B: Grade via Google Classroom (links to specific Google coursework)
5. Teacher grades in Google Classroom (as they normally do)
6. Teacher clicks "Pull Grades" button in Alma
7. Grades sync (total + per-category if rubric)
8. Reports show breakdown

**Database Changes (see full schemas above):**
- Modify: `assessments` (add `grading_source`, `google_coursework_id`, `google_course_id`, `google_last_synced_at`, `has_rubric`)
- New: `assessment_rubrics`, `rubric_categories`, `rubric_presets`, `rubric_preset_categories`, `student_rubric_scores`
- New: `google_workspace_settings` (per-branch, follows `certificate_settings` pattern)
- New: `google_classroom_course_mappings`, `google_sync_audit_log`

**Seed Data:**
- Global rubric preset: "Ontario KTAC" with 4 categories (Knowledge, Thinking, Application, Communication)
- Feature permissions: `google_classroom_integration`, `assessment_rubrics`

**Google API Scopes (read-only):**
- `classroom.courses.readonly`
- `classroom.coursework.students.readonly`
- `classroom.rosters.readonly`
- `classroom.student-submissions.students.readonly`

**Permissions:**
- Enable/disable feature toggle: `school_admin`, `principal`
- Connect/disconnect Google Workspace: `school_admin`, `principal`
- Course mappings CRUD: `school_admin`, `principal`
- Create/manage rubric presets: `school_admin`, `principal`
- Add rubric to assessment: teachers (assigned to that class-subject)
- Link assessment to Google: teachers (assigned to that class-subject)
- Pull grades: teachers (assigned to that class-subject)
- View rubric breakdown: same as viewing assessment

**Phases:**
1. Rubric foundation (standalone value)
2. Feature toggle + OAuth connection
3. Course mapping UI
4. Assessment linking + rubric import from Google
5. Manual grade pull + sync UI

**Follow existing patterns:**
- Per-branch settings: `certificate_settings` pattern (UNIQUE constraint on branch_id)
- Auth: extend existing Google OAuth in `auth.service.ts` with additional scopes
- Controller structure: `substitutions.controller.ts`
- Feature permission matrix: existing `features` + `role_permissions` tables
- Migration naming: `YYYYMMDDHHMMSS_google_classroom_integration.sql`

**Files to reference:**
- `certificate_settings` migration - settings table pattern
- `auth.service.ts` - Google OAuth foundation
- `substitutions.controller.ts` - controller structure
- `assessments.controller.ts` - to modify for rubric endpoints

**Key requirements:**
- All UI hidden when feature toggle is OFF
- Encrypted token storage
- Auto-refresh Google access tokens
- Match Google students to Alma students by email
- Handle missing/deleted Google assignments gracefully
- Preserve existing Alma marks if unlinking from Google
- Confirmation dialog before overwriting existing scores

**Testing scenarios:**
1. Feature disabled → No Google UI anywhere
2. Feature enabled, not connected → "Connect" prompt shown
3. Connect Google → OAuth flow completes → status shows
4. Auto-suggest maps 8/10 classes correctly
5. Create manual KTAC assessment → enter per-category marks → report shows breakdown
6. Link Alma assessment to Google → rubric auto-imported
7. Click "Pull Grades" → all students synced with per-category scores
8. Re-grade in Google → click "Pull Grades" again → updates work
9. Unlink assessment → existing scores preserved
10. Disable feature → UI hidden, but data intact for future re-enable

**Success criteria:**
- Rubric system works standalone (Phase 1 alone is valuable)
- Feature can be toggled without breaking existing data
- Teachers can pull grades with one click
- Per-category breakdown visible in reports
- Clean disconnect that doesn't corrupt existing assessments

---

## ✅ Summary

**What You're Building:**

1. ✅ **Rubric System** (works standalone) - Ontario KTAC, Cambridge, custom, any structure
2. ✅ **Feature Toggle** - Enable/disable Google Classroom per branch
3. ✅ **OAuth Connection** - Connect branch's Google Workspace
4. ✅ **Course Mapping** - Link Alma classes to Google courses
5. ✅ **Assessment Linking** - Link individual assessments to Google coursework
6. ✅ **Rubric Import** - Auto-detect Google's rubric structure
7. ✅ **Manual Pull** - Teacher clicks button to sync grades
8. ✅ **Audit Log** - Track all sync attempts

**Timeline: 4-5 weeks across 5 phases**

**Immediate value: Phase 1 delivers rubric feature in Week 1 (before any Google work)**

Ready to hand this to Cursor! 🚀
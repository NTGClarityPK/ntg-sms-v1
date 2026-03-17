# Settings & Configuration

Complete guide to configuring the NTG School Management System (SMS).

## 📋 Overview

The Settings area is used to configure core school structures and behaviour that drive other modules (attendance, assessments, timetable, reporting, etc.).

Settings are typically managed by:

- School Admin
- Principal / Academic Coordinator (depending on permissions)

{% @mermaid/diagram content="graph TB
A[Settings] --> B[Academic Years]
A --> C[Academic (Core Lookups)]
A --> D[Schedule]
A --> E[Assessment]
A --> F[Communication]
A --> G[Behaviour]
A --> H[Permissions]
A --> I[Subject Templates]
A --> J[Theme Settings]" %}

## 📅 Academic Years

Academic years control the active operating year of the school.

### Creating an academic year

**Steps:**

1. Go to **Settings → Academic Years**
2. Click **Add**
3. Enter year information
4. Save

### Active vs Locked

- **Active**: the year used for current operations.
- **Locked**: prevents modifications (used when a year is finalised).

## 🏫 Academic (Core Lookups)

Core lookups include:

- Subjects
- Classes
- Sections
- Levels
- Level ↔ Class mapping

### Managing lookups

**Steps:**

1. Go to **Settings → Academic**
2. Select the relevant tab (subjects/classes/sections/levels/mapping)
3. Add/edit items
4. Save changes

## 🗓️ Schedule

Schedule settings include:

- School days
- Timing templates
- Class timing assignments
- Public holidays

### Managing school days and timings

**Steps:**

1. Go to **Settings → Schedule**
2. Configure school days
3. Create timing templates (often per level)
4. Assign timing templates as needed

### Managing holidays

**Steps:**

1. Go to **Settings → Schedule**
2. Open holidays/calendar section
3. Add or edit holiday dates
4. Save

## 📝 Assessment

Assessment settings include:

- Assessment types
- Grade templates (ranges)
- Class ↔ grade template assignments
- Leave quota settings (used by leave workflow)

### Managing assessment types

**Steps:**

1. Go to **Settings → Assessment**
2. Add/edit assessment types
3. Save

### Managing grade templates

**Steps:**

1. Go to **Settings → Assessment**
2. Create or edit grade templates and grade ranges
3. Assign templates to classes
4. Save

## 💬 Communication

Communication settings control the allowed messaging directions between stakeholders (e.g. teacher ↔ student/parent), depending on the configuration enabled.

## ⭐ Behaviour

Behaviour settings control the behavioural module configuration (feature flags and attributes).

## 🛡️ Permissions

Permissions determine which modules each role can view/edit. The portal sidebar is permission-driven.

### Updating role permissions

**Steps:**

1. Go to **Settings → Permissions**
2. Select a role
3. Configure feature access
4. Save

## 🧩 Subject Templates

Subject templates are configured from **Settings → Subject Templates** and are used to standardise academic setup where applicable.

## 🎨 Theme Settings

Theme settings control portal appearance (colours and presentation) using the central theme configuration.

## 🆘 Troubleshooting

**Changes don’t appear in other pages:**

- Refresh the page
- Confirm you are in the correct branch context
- Confirm you have permissions to edit the setting


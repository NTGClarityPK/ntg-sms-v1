# 📖 Documentation Structure

```
user-guide/
├── README.md                          # Introduction (this space)
├── SUMMARY.md                         # Table of contents
├── introduction/                      # How to use these docs
│   ├── whats-in-this-space.md
│   ├── quick-start.md
│   ├── documentation-structure.md     # This file
│   ├── documentation-sections.md
│   ├── finding-information.md
│   ├── quick-reference.md
│   ├── troubleshooting.md
│   ├── tips-and-best-practices.md
│   ├── security.md
│   ├── support.md
│   └── documentation-updates.md
├── user-manual/                       # Complete user manual
│   ├── README.md
│   └── academic-year-logic.md
└── features/                          # Feature-specific guides
    ├── authentication-and-access.md   # Login, reset password, branch selection, PIN
    ├── settings-and-configuration.md  # School setup, academic, fees, integrations, permissions
    ├── user-roles.md                  # Users, roles, permission-driven visibility
    ├── students.md                    # Students management + bulk import
    ├── staff.md                       # Staff listing + schedules
    ├── parent-associations.md         # Parent–student linking
    ├── attendance.md                  # Attendance mark/view + history + child view
    ├── assessments.md                 # Assessments + grades + statistics
    ├── rubrics.md                     # Rubric presets and criterion marking
    ├── google-classroom.md            # Read-only Classroom grade and rubric sync
    ├── timetable-and-schedule.md      # Timetable + my timetable + conflicts
    ├── teacher-substitution.md        # Cover for absent teachers
    ├── behavioural.md                 # Star-rating matrix + pending view
    ├── promotion-and-placement.md     # Year-end promotion and placement
    ├── results.md                     # Report cards, comments, publishing
    ├── reports.md                     # Student/class/admin reports + public statistics
    ├── leaves.md                      # Leave requests workflow
    ├── early-departure.md             # Early departure workflow
    ├── events.md                      # Events list/create/view + my events
    ├── notifications.md               # Notifications page + bell + unread counts
    ├── messages.md                    # Messages module
    ├── fee-management.md              # Fee templates, challans, payments
    ├── billing.md                     # Subscription plan and invoices
    ├── certificates.md                # Certificate templates and generation
    ├── id-cards.md                    # ID card generation
    ├── data-export.md                 # Secure school data backup
    ├── inventory-uniforms.md          # Inventory items/requests/history
    ├── library.md                     # Library module
    ├── storage.md                     # Storage admin page
    └── offline-documents.md           # Redirects to Storage (legacy route)
```

## How this maps to GitBook

* **One GitBook page = one Markdown file**
* The sidebar order comes from `SUMMARY.md`
* Pages are published from the product repository, so documentation ships alongside the feature it describes

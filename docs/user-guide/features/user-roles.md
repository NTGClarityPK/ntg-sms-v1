# 👥 User Roles

Complete guide to users, roles, and permissions-driven access in NTG Alma.

## 📋 Overview

NTG Alma uses role-based access control:

- Users can have one or more roles
- Feature visibility (including sidebar items) depends on permissions
- Some features are view-only for certain roles and editable for others

{% @mermaid/diagram content="graph TB
A[User] --> B[One or more Roles]
B --> C[Permissions per Feature]
C --> D[Portal Visibility]
C --> E[Allowed Actions]
F[Branch Context] --> D
F --> E" %}

## 👤 Users

### Viewing users

**Steps:**

1. Go to **Users**
2. Use search/filter controls (where available)
3. Open a user to view details

### Common user attributes (typical)

- Name / email (as available)
- Role assignments
- Branch membership (if applicable)

## 🧩 Roles

Roles represent what type of user someone is within the school context.

Examples used in the system include:

- School Admin, Principal, Academic Coordinator
- Class Teacher, Subject Teacher
- Guidance Counsellor
- Parent, Student
- Super Admin

## 🛡️ Permissions

Permissions determine:

- Which modules appear in the sidebar
- Which pages/actions a user can access

### If you can’t see a module

Check:

1. Your assigned role(s)
2. Your permissions configuration for that role
3. Your current branch selection/context
4. For parents: whether you’re in child context

## 🆘 Troubleshooting

**I can see the module but actions are disabled:**

- Your permission may be **View** rather than **Edit**

**I can’t see Users at all:**

- Users management is restricted to roles that have permissions enabled for that module


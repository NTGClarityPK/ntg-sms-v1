# Introduction

{% hint style="info" %}
**Note:** *NTG Alma* is the commercial name for our School Management System; internally we may reference it as *NTG Alma*.
{% endhint %}

Welcome to the **NTG Alma - School Management System Developer Documentation**! This space contains all technical documentation for developers, DevOps engineers, and system administrators working with the NTG Alma platform.

{% hint style="warning" %}
**Private space.** Do not publish secrets, live credentials, or exploit detail for open issues. Use checklists and remediation pointers instead.
{% endhint %}

## 📚 What's in This Space

This documentation space covers:

* **🚀 System Setup & Installation** - Getting the development environment running
* **🔑 Environment Variables** - Every backend and frontend variable
* **🏗️ Architecture & Design** - Understanding the system's technical architecture
* **🗄️ Database Schema** - Complete database structure and relationships
* **🎓 Student Lifecycle** - Academic workflows and state machines
* **🔐 Security** - Security best practices, RBAC, and RLS implementation
* **🐛 Troubleshooting** - Common development and deployment failures
* **🚢 CI/CD Deployment** - Deployment using Docker and GitHub Actions
* **🧩 Modules** - Per-module developer notes

## 🚀 Quick Start

### For New Developers

1. Start with [**🚀 Getting Started**](getting-started.md) - Complete setup instructions
2. Configure [**🔑 Environment Variables**](environment-variables.md) - Backend and frontend config
3. Review [**🏗️ Architecture**](architecture.md) - Understand system design
4. Explore [**🗄️ Database Schema**](database-schema.md) - Learn the data model
5. Read [**🔐 Security**](security.md) - Security best practices

### For DevOps Engineers

1. [**🚢 CI/CD Deployment**](ci-cd-deployment.md) - Docker and GitHub Actions
2. [**🔑 Environment Variables**](environment-variables.md) - Production configuration
3. [**🏗️ Architecture**](architecture.md) - Infrastructure overview
4. [**🔐 Security**](security.md) - Production security configuration

## 📖 Documentation Structure

```
developer-guide/
├── README.md                  # This file
├── SUMMARY.md                 # Table of contents
├── getting-started.md         # Setup and installation guide
├── environment-variables.md   # All environment variables
├── architecture.md            # System architecture documentation
├── database-schema.md         # Database structure and design
├── student-lifecycle.md       # Student workflows and state machines
├── security.md                # Security implementation guide
├── troubleshooting.md         # Common failures and fixes
├── ci-cd-deployment.md        # CI/CD deployment guide
└── modules/                   # Per-module developer notes
    ├── google-classroom.md
    ├── billing.md
    └── rubrics.md
```

## 🎯 Documentation Sections

### [🚀 Getting Started](getting-started.md)

* Prerequisites and requirements
* Backend and frontend setup
* Supabase project and migrations
* Running the application
* Troubleshooting common setup issues

### [🔑 Environment Variables](environment-variables.md)

* Backend variables and which are required
* Frontend public variables
* Optional integrations (Google Classroom, Stripe, web push, Reach Support)
* Security rules for example files

### [🏗️ Architecture](architecture.md)

* Three-tier overview (frontend, backend, database)
* Backend NestJS module structure
* Frontend Next.js App Router structure
* Multi-tenancy and branch isolation
* API conventions and request flow

### [🗄️ Database Schema](database-schema.md)

* Schema overview and entity relationships
* Table structures and enums
* Row-level security policies
* Indexes and performance considerations

### [🎓 Student Lifecycle](student-lifecycle.md)

* Student status state machine
* Enrolment and promotion workflows
* Attendance and assessment flows
* Result card generation

### [🔐 Security](security.md)

* Authentication (Supabase Auth + JWT)
* Role-based access control
* Row-level security and tenant isolation
* API and database security checklist

### [🚢 CI/CD Deployment](ci-cd-deployment.md)

* Docker and GitHub Actions
* Environment configuration
* Health checks and production considerations

## 🛠️ Development Workflow

{% stepper %}
{% step %}

### Clone Repository

```bash
git clone https://github.com/NTGClarityPK/ntg-sms-v1.git
cd ntg-sms-v1
```

{% endstep %}

{% step %}

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
npm run start:dev
```

{% endstep %}

{% step %}

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

{% endstep %}
{% endstepper %}

See [🚀 Getting Started](getting-started.md) for detailed instructions.

## 📝 Documentation Standards

When contributing to developer documentation:

* **Code examples** - include working snippets
* **Diagrams** - use Mermaid for architecture diagrams
* **Step-by-step** - provide reproducible instructions
* **Troubleshooting** - add symptoms and fixes
* **No secrets** - placeholders only, never real credentials

## 🔗 Related Documentation

### User Documentation

End-user guides live in the [User Documentation space](https://ntg-1.gitbook.io/ntg-sms-user-docs/), maintained under `docs/user-guide/` in the same repository.

The user documentation contains:

* User manual for school staff, teachers, and parents
* Feature guides (Students, Attendance, Assessments, Fees, Results, and more)
* Step-by-step operational guides
* Troubleshooting for end users

## 🔄 Documentation Updates

This space is published from `docs/developer-guide/` via GitBook Git Sync, so documentation changes travel with the code that caused them.

***

**Start Here:** [🚀 Getting Started](getting-started.md)

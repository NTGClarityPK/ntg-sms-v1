# ⚙️ Settings & Configuration

Complete guide to configuring **NTG Alma**.

## Overview

Settings configure school structures and behaviour that drive other modules (attendance, assessments, timetable, fees, reporting, and more).

Typically managed by:

- School Admin
- Principal / Academic Coordinator (depending on permissions)

Settings are organised into **categories** in the sidebar:

| Category | Sections |
|----------|----------|
| **School setup** | Business Information, Communication, General |
| **Academic** | Academic Years, Schedule, Result & Reports |
| **Operations** | Inventory Management, Integrations, Data Export |
| **Finance** | Fees |
| **Appearance** | Theme Settings, Public Statistics |
| **Access control** | Permissions |

Some sections are gated by role or plan (for example Data Export, Public Statistics, Result & Reports).

## Business Information

Holds school identity and school-wide behaviour: school name, school code, domain, contact email and phone, timezone, fiscal year start, VAT number, and **default language**.

**Steps:**

1. Go to **Settings → Business Information**
2. Edit **Basic Details** and **Business Settings**
3. Click **Save**

### Default language

**Where:** Settings → Business Information → **Business Settings → Default language**

Options: **English (UK)**, **English (US)**, and **Arabic**.

- New schools start on **English (UK)**.
- The default applies to every user who has **not** chosen a personal language.
- Users with a personal language keep it until they choose **Use school default**.

**Choosing your own language (any user):** use the language control in the top bar (globe).

| Option | Effect |
|--------|--------|
| **Use school default** | Follow the school default now and in future |
| English (UK) / English (US) / Arabic | Personal override on every device after login |

**Arabic** also switches the portal to a right-to-left layout. Proper nouns (names, class codes) are not translated.

Platform operators can also set organisation default locale from the [Admin Portal](admin-portal.md) tenant form.

## Academic Years

1. Go to **Settings → Academic Years**
2. Create the year and mark the correct one **Active**
3. Use **Locked** only when the year is finalised

## Schedule

School days, timing templates, class timing assignments, and public holidays.

1. Go to **Settings → Schedule**
2. Configure school days and timing templates
3. Add holidays as needed

## Result & Reports

Configure result/report related options where enabled for your plan.

## Inventory Management

Uniform/inventory operational settings used by inventory workflows.

## Integrations

Google Classroom connection, course mappings, and **Rubric presets**. See [Google Classroom](google-classroom.md) and [Rubrics](rubrics.md).

## Data Export

Export school data for backup/offboarding. See [Data Export](data-export.md).

## Fees (Fee Settings)

Challan appearance and fee templates. Day-to-day challan generation lives under the Fees module — see [Fee Management](fee-management.md).

## Theme Settings

Portal appearance (colours and presentation).

## Public Statistics

Branch public statistics configuration (typically school-admin).

## Communication

Allowed messaging directions between stakeholders.

## General

General school operational switches that are not covered by the sections above (including academic structure helpers such as subjects/classes where surfaced here in your build).

## Permissions

1. Go to **Settings → Permissions**
2. Select a role
3. Configure feature access
4. Save

The portal sidebar is permission-driven (and may also respect subscription plan entitlements).

## Troubleshooting

**Changes don’t appear elsewhere**

- Refresh the page
- Confirm branch context
- Confirm you can edit the setting

**School default language changed but some users still see the old one**

- Those users have a **personal** language — ask them to choose **Use school default**

**Wrong language for me**

- Check the top-bar language control
- If set to school default, check **Business Information → Default language**

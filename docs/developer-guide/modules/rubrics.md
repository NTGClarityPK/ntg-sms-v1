# Rubrics (Developer)

## Overview

Rubrics support Alma-native presets (e.g. KTAC) and Google Classroom rubric import when an assessment is Classroom-linked.

Key backend area: `backend/src/modules/rubrics/`
Frontend: `frontend/src/components/features/rubrics/` and Settings integrations UI.

## Behaviour notes

- Attaching Alma presets is blocked when the assessment is Google-linked
- Google rubric import replaces Alma rubric structure when fingerprints differ
- Assessment `total_marks` is not overwritten by rubric import

## Related

- [Google Classroom](google-classroom.md)
- User guide: Rubrics / Google Classroom pages under `docs/user-guide/features/`

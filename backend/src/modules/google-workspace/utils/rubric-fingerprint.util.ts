import type { AssessmentRubricDto } from '../../rubrics/dto/assessment-rubric.dto';
import type {
  GoogleClassroomRubric,
  GoogleRubricCriterion,
  GoogleStudentSubmission,
} from '../types/google-classroom.types';

function normaliseTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function criterionMaxPoints(criterion: GoogleRubricCriterion): number {
  if (criterion.levels && criterion.levels.length > 0) {
    return Math.max(...criterion.levels.map((l) => l.points ?? 0));
  }
  return 0;
}

/** Stable fingerprint for Google ↔ Alma rubric structure comparison. */
export function fingerprintGoogleRubric(
  rubric: GoogleClassroomRubric,
): string {
  const id = rubric.id ?? '';
  const parts = (rubric.criteria ?? [])
    .map(
      (c) =>
        `${c.id}:${normaliseTitle(c.title)}:${criterionMaxPoints(c)}`,
    )
    .sort();
  return `${id}|${parts.join(',')}`;
}

export function fingerprintAlmaRubric(
  rubric: AssessmentRubricDto,
): string {
  const id = rubric.googleRubricId ?? '';
  const parts = rubric.categories
    .filter((c) => !!c.googleCriterionId)
    .map(
      (c) =>
        `${c.googleCriterionId}:${normaliseTitle(c.categoryName)}:${c.maxMarks}`,
    )
    .sort();
  return `${id}|${parts.join(',')}`;
}

export function collectRubricHintsFromSubmissions(
  submissions: GoogleStudentSubmission[],
): { rubricIdHint: string | null; criterionIds: Set<string> } {
  let rubricIdHint: string | null = null;
  const criterionIds = new Set<string>();

  for (const submission of submissions) {
    if (!rubricIdHint && submission.rubricId) {
      rubricIdHint = submission.rubricId;
    }
    const assigned = submission.assignedRubricGrades ?? {};
    const draft = submission.draftRubricGrades ?? {};
    for (const [key, value] of Object.entries(assigned)) {
      criterionIds.add(value.criterionId || key);
    }
    for (const [key, value] of Object.entries(draft)) {
      criterionIds.add(value.criterionId || key);
    }
  }

  return { rubricIdHint, criterionIds };
}

/**
 * Skip the Google rubrics API when Alma already has a full Google-linked
 * structure that matches the submission hints we already paid for.
 */
export function shouldFetchGoogleRubric(
  alma: AssessmentRubricDto | null | undefined,
  rubricIdHint: string | null,
  criterionIdsFromSubs: Set<string>,
): boolean {
  if (!alma?.categories?.length) return true;

  const almaGoogleIds = alma.categories
    .map((c) => c.googleCriterionId)
    .filter((id): id is string => !!id);

  if (almaGoogleIds.length === 0) return true;
  if (almaGoogleIds.length !== alma.categories.length) return true;

  if (
    rubricIdHint &&
    alma.googleRubricId &&
    rubricIdHint !== alma.googleRubricId
  ) {
    return true;
  }

  if (criterionIdsFromSubs.size > 0) {
    const almaSet = new Set(almaGoogleIds);
    for (const id of criterionIdsFromSubs) {
      if (!almaSet.has(id)) return true;
    }
  }

  // Fully linked Google-sourced (or previously linked) rubric — reuse local copy.
  if (alma.source === 'google_classroom' || alma.googleRubricId) {
    return false;
  }

  // Alma-only source: fetch once so Google can override.
  return true;
}

export function mapGoogleCriteriaForImport(
  rubric: GoogleClassroomRubric,
): Array<{
  id: string;
  title: string;
  description?: string;
  maxPoints: number;
}> {
  return (rubric.criteria ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    maxPoints: criterionMaxPoints(c),
  }));
}

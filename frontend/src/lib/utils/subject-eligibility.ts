import type { SubjectTemplate } from '@/types/subject-templates';
import type { Level } from '@/types/settings';

export type SubjectApplicabilityIndex = {
  /** classId → applicable subject IDs when the class has templates */
  byClassId: Map<string, Set<string>>;
  /** Subjects that appear in at least one branch template */
  subjectsInAnyTemplate: Set<string>;
  /** True when the class has at least one template (class or level) */
  classHasTemplates: Map<string, boolean>;
};

/**
 * Build which subjects apply to each class from subject templates assigned to
 * the class directly or via its level.
 *
 * - Class with templates → union of those templates' subjects only.
 * - Class with no templates → only subjects that are not in any template
 *   (legacy untemplated subjects). Templated subjects stay blocked.
 */
export function buildSubjectApplicabilityIndex(
  templates: SubjectTemplate[],
  levels: Level[],
): SubjectApplicabilityIndex {
  const classIdToLevelIds = new Map<string, string[]>();
  for (const level of levels) {
    for (const cls of level.classes ?? []) {
      const existing = classIdToLevelIds.get(cls.id) ?? [];
      existing.push(level.id);
      classIdToLevelIds.set(cls.id, existing);
    }
  }

  const subjectsInAnyTemplate = new Set<string>();
  for (const template of templates) {
    for (const subjectId of template.subjectIds ?? []) {
      subjectsInAnyTemplate.add(subjectId);
    }
  }

  const allClassIds = new Set<string>(classIdToLevelIds.keys());
  for (const template of templates) {
    for (const classId of template.assignedClassIds ?? []) {
      allClassIds.add(classId);
    }
  }

  const byClassId = new Map<string, Set<string>>();
  const classHasTemplates = new Map<string, boolean>();

  for (const classId of allClassIds) {
    const levelIds = new Set(classIdToLevelIds.get(classId) ?? []);
    const subjectIds = new Set<string>();
    let hasTemplates = false;

    for (const template of templates) {
      const assignedToClass = (template.assignedClassIds ?? []).includes(classId);
      const assignedToLevel = (template.assignedLevelIds ?? []).some((id) =>
        levelIds.has(id),
      );
      if (!assignedToClass && !assignedToLevel) continue;
      hasTemplates = true;
      for (const subjectId of template.subjectIds ?? []) {
        subjectIds.add(subjectId);
      }
    }

    classHasTemplates.set(classId, hasTemplates);
    byClassId.set(classId, subjectIds);
  }

  return { byClassId, subjectsInAnyTemplate, classHasTemplates };
}

export function isSubjectApplicableToClass(
  index: SubjectApplicabilityIndex,
  classId: string,
  subjectId: string,
): boolean {
  const hasTemplates = index.classHasTemplates.get(classId) ?? false;
  if (hasTemplates) {
    return index.byClassId.get(classId)?.has(subjectId) ?? false;
  }
  return !index.subjectsInAnyTemplate.has(subjectId);
}

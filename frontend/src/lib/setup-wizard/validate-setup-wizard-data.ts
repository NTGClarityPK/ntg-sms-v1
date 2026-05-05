import type { SetupWizardData } from '@/components/features/settings/wizard-steps/types';

/**
 * Validates the full wizard payload before any setup API calls run.
 * Prevents partial persistence when a later step would fail (e.g. missing grade ranges).
 * @param translate Optional next-intl translator for `settings` keys.
 */
export function validateSetupWizardDataBeforeSave(
  data: SetupWizardData,
  translate?: (key: string) => string,
): void {
  if (data.academicYear) {
    const y = data.academicYear;
    if (!y.name?.trim()) {
      throw new Error('Academic year name is required.');
    }
    if (!y.startDate?.trim() || !y.endDate?.trim()) {
      throw new Error('Academic year start and end dates are required.');
    }
  }

  const termExaminationCount = (data.assessment.assessmentTypes ?? []).filter(
    (at) => at.isTermExamination === true,
  ).length;
  if (termExaminationCount < 2) {
    const msg = translate?.('setupWizardTermExamMinTwo');
    throw new Error(
      msg && !msg.includes('setupWizardTermExamMinTwo')
        ? msg
        : 'Mark at least two assessment types as term examinations (e.g. Mid Term and Final Term) before finishing setup.',
    );
  }

  for (const t of data.assessment.gradeTemplates) {
    const name = t.name?.trim() ?? '';
    if (!name) {
      throw new Error('Each grade template must have a name.');
    }
    const ranges = t.ranges ?? [];
    if (ranges.length === 0) {
      throw new Error(
        `Grade template "${name}" needs at least one grade range. Add ranges before finishing setup.`,
      );
    }

    const letters = new Set<string>();
    const sorted = [...ranges].sort((a, b) => a.sortOrder - b.sortOrder);
    for (const r of sorted) {
      const letter = (r.letter ?? '').trim();
      if (!letter) {
        throw new Error(`Grade template "${name}": each range needs a letter or label.`);
      }
      if (letters.has(letter)) {
        throw new Error(`Grade template "${name}": duplicate grade "${letter}".`);
      }
      letters.add(letter);
      if (r.minPercentage > r.maxPercentage) {
        throw new Error(
          `Grade template "${name}": for "${letter}", minimum percentage must be less than or equal to maximum.`,
        );
      }
    }
  }
}

'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Checkbox, MultiSelect, Select, Stack, Textarea, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import '@mantine/dates/styles.css';
import { IconCalendar } from '@tabler/icons-react';
import {
  CERTIFICATE_FIELD_CONFIG,
  type CertificateFieldDef,
} from '@/lib/certificates/certificateFieldConfig';
import type { CertificateType } from '@/types/certificates';

type Props = {
  certificateType: CertificateType;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  signatureSlotLabels?: { signature1: string; signature2: string };
};

function parseLocalDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fieldPlaceholder(
  certificateType: CertificateType,
  fieldKey: string,
  translate: ReturnType<typeof useTranslations<'certificates'>>,
): string | undefined {
  if (certificateType !== 'custom') return undefined;
  const key = `fieldPlaceholders.${fieldKey}`;
  const text = translate(key);
  return text === key ? undefined : text;
}

export function CertificateDynamicForm({
  certificateType,
  values,
  onChange,
  signatureSlotLabels,
}: Props) {
  const t = useTranslations('certificates');
  const fields = CERTIFICATE_FIELD_CONFIG[certificateType].filter((field) => {
    if (
      field.key === 'certificateNumberOverride' &&
      values.showCertificateNumber === false
    ) {
      return false;
    }
    if (
      field.key === 'citationAcademicYear' &&
      values.showCitationAcademicYear === false
    ) {
      return false;
    }
    return true;
  });

  const optionSets = useMemo(
    () => ({
      conduct: [
        { value: 'Excellent', label: t('options.conduct.excellent') },
        { value: 'Good', label: t('options.conduct.good') },
        { value: 'Fair', label: t('options.conduct.fair') },
        { value: 'Poor', label: t('options.conduct.poor') },
      ],
      progress: [
        { value: 'Excellent', label: t('options.progress.excellent') },
        { value: 'Good', label: t('options.progress.good') },
        { value: 'Fair', label: t('options.progress.fair') },
        { value: 'Poor', label: t('options.progress.poor') },
      ],
      competitionLevel: [
        { value: 'School', label: t('options.competitionLevel.school') },
        { value: 'District', label: t('options.competitionLevel.district') },
        { value: 'National', label: t('options.competitionLevel.national') },
      ],
      subjectOrOverall: [
        { value: 'Overall', label: t('options.subjectOrOverall.overall') },
        { value: 'Subject', label: t('options.subjectOrOverall.subject') },
      ],
      characterTraits: [
        { value: 'Honest', label: t('options.traits.honest') },
        { value: 'Disciplined', label: t('options.traits.disciplined') },
        { value: 'Respectful', label: t('options.traits.respectful') },
        { value: 'Responsible', label: t('options.traits.responsible') },
        { value: 'Cooperative', label: t('options.traits.cooperative') },
        { value: 'Hardworking', label: t('options.traits.hardworking') },
      ],
    }),
    [t],
  );

  const renderField = (field: CertificateFieldDef) => {
    let label = t(`fields.${field.key}`);
    if (field.key === 'signature1Name' && signatureSlotLabels?.signature1) {
      label = t('fields.signature1Name', { role: signatureSlotLabels.signature1 });
    }
    if (field.key === 'signature2Name' && signatureSlotLabels?.signature2) {
      label = t('fields.signature2Name', { role: signatureSlotLabels.signature2 });
    }
    const placeholder = fieldPlaceholder(certificateType, field.key, t);
    const val = values[field.key];

    if (field.kind === 'checkbox') {
      const defaultChecked =
        field.key === 'showDistinctionBadge' ||
        field.key === 'showCertificateNumber' ||
        field.key === 'showCitationAcademicYear' ||
        field.key === 'showClosingMessage';
      const checked = val === undefined ? defaultChecked : Boolean(val);
      const descriptionKey = `fields.${field.key}Description` as const;
      let description: string | undefined;
      try {
        description = t(descriptionKey);
        if (description === descriptionKey) description = undefined;
      } catch {
        description = undefined;
      }
      return (
        <Checkbox
          key={field.key}
          id={`cert-field-${field.key}`}
          label={label}
          description={description}
          checked={checked}
          onChange={(e) => onChange(field.key, e.currentTarget.checked)}
        />
      );
    }

    if (field.kind === 'select' && field.optionsKey) {
      const data = optionSets[field.optionsKey];
      return (
        <Select
          key={field.key}
          id={`cert-field-${field.key}`}
          label={label}
          required={field.required}
          data={data}
          value={(val as string) ?? null}
          onChange={(v) => onChange(field.key, v ?? '')}
        />
      );
    }

    if (field.kind === 'multiselect' && field.optionsKey) {
      const data = optionSets[field.optionsKey];
      return (
        <MultiSelect
          key={field.key}
          id={`cert-field-${field.key}`}
          label={label}
          data={data}
          value={Array.isArray(val) ? (val as string[]) : []}
          onChange={(v) => onChange(field.key, v)}
        />
      );
    }

    if (field.kind === 'date') {
      return (
        <DatePickerInput
          key={field.key}
          id={`cert-field-${field.key}`}
          label={label}
          required={field.required}
          placeholder={t('issue.selectDate')}
          value={parseLocalDate(val)}
          onChange={(d) => onChange(field.key, d ? formatLocalDate(d) : '')}
          leftSection={<IconCalendar size={16} />}
          clearable
        />
      );
    }

    if (field.kind === 'textarea') {
      return (
        <Textarea
          key={field.key}
          id={`cert-field-${field.key}`}
          label={label}
          placeholder={placeholder}
          minRows={3}
          value={(val as string) ?? ''}
          onChange={(e) => onChange(field.key, e.currentTarget.value)}
        />
      );
    }

    const description =
      field.key === 'signature1Name' || field.key === 'signature2Name'
        ? t('fields.signatureNameDescription')
        : undefined;

    return (
      <TextInput
        key={field.key}
        id={`cert-field-${field.key}`}
        label={label}
        description={description}
        placeholder={placeholder}
        required={field.required}
        value={(val as string) ?? ''}
        onChange={(e) => onChange(field.key, e.currentTarget.value)}
      />
    );
  };

  return <Stack gap="md">{fields.map(renderField)}</Stack>;
}

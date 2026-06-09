'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Alert,
  Button,
  Group,
  List,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Title,
  useMantineTheme,
} from '@mantine/core';
import Link from 'next/link';
import {
  IconAward,
  IconCertificate,
  IconMedal,
  IconSchool,
  IconTrophy,
  IconUser,
  IconWriting,
} from '@tabler/icons-react';
import { useClassSections } from '@/hooks/useClassSections';
import { useActiveAcademicYear } from '@/hooks/useAcademicYears';
import { useStudents } from '@/hooks/useStudents';
import {
  useCertificateIssueFormDefaults,
  useGenerateCertificatePreview,
  useIssueCertificate,
} from '@/hooks/useCertificates';
import { CertificateDynamicForm } from '@/components/features/certificates/CertificateDynamicForm';
import { CertificateLivePreview } from '@/components/features/certificates/CertificateLivePreview';
import { CertificateSelectFieldSkeleton } from '@/components/features/certificates/CertificateSkeletons';
import {
  isAwardCertificateType,
  isLeavingCertificateType,
} from '@/lib/certificates/getDesignForType';
import { LEAVING_ENROLMENT_STATUSES } from '@/lib/certificates/leaving-eligibility';
import {
  areCertificateFieldsComplete,
  defaultCertificateFormValues,
  toCertificateDataPayload,
} from '@/lib/certificates/certificateFieldConfig';
import { parseApiErrorMessage } from '@/lib/parse-api-error';
import type { CertificateType } from '@/types/certificates';
import type { ClassSection } from '@/types/class-sections';
import type { Student } from '@/types/students';

type Props = {
  /** Called after a certificate is issued successfully (e.g. switch to History tab). */
  onIssued?: () => void;
};

export function CertificateIssueWizard({ onIssued }: Props) {
  const t = useTranslations('certificates');
  const tNav = useTranslations('navigation');
  const theme = useMantineTheme();
  const [certificateType, setCertificateType] = useState<CertificateType | null>(null);
  const [classSectionId, setClassSectionId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const appliedSignatureDefaultsKey = useRef<string | null>(null);

  const { data: activeYearResponse, isLoading: activeYearLoading } = useActiveAcademicYear();
  const activeYearId = activeYearResponse?.data?.id;
  const { data: classSectionsResponse, isLoading: classSectionsLoading } = useClassSections({
    minimal: true,
    limit: 200,
    academicYearId: activeYearId,
    enabled: !!activeYearId,
  });

  const classSectionOptions = useMemo(() => {
    const list = (classSectionsResponse?.data as ClassSection[] | undefined) ?? [];
    return list.map((cs) => ({
      value: cs.id,
      label: `${cs.className ?? ''} ${cs.sectionName ?? ''}`.trim() || cs.id,
    }));
  }, [classSectionsResponse?.data]);

  const selectedSection = useMemo(() => {
    const list = (classSectionsResponse?.data as ClassSection[] | undefined) ?? [];
    return list.find((cs) => cs.id === classSectionId);
  }, [classSectionsResponse?.data, classSectionId]);

  const isLeaving = certificateType ? isLeavingCertificateType(certificateType) : false;

  const { data: studentsResponse, isLoading: studentsLoading } = useStudents({
    page: 1,
    limit: 200,
    classIds: selectedSection?.classId ? [selectedSection.classId] : undefined,
    sectionIds: selectedSection?.sectionId ? [selectedSection.sectionId] : undefined,
    isActive: isLeaving ? undefined : true,
    enrolmentStatuses: isLeaving ? [...LEAVING_ENROLMENT_STATUSES] : undefined,
    enabled: !!certificateType && (isLeaving ? true : !!classSectionId),
  });

  const students = (studentsResponse?.data as Student[] | undefined) ?? [];
  const studentOptions = students.map((s) => ({
    value: s.id,
    label: `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || s.studentId,
  }));

  const { data: issueFormDefaults } = useCertificateIssueFormDefaults(
    studentId,
    certificateType,
  );

  const { mutate: generatePreview, isPending: previewPending } =
    useGenerateCertificatePreview();
  const issueMutation = useIssueCertificate();

  const signatureSlotLabels = useMemo(
    () =>
      issueFormDefaults
        ? {
            signature1: issueFormDefaults.signature1Label,
            signature2: issueFormDefaults.signature2Label,
          }
        : undefined,
    [issueFormDefaults],
  );

  const reset = useCallback(() => {
    setCertificateType(null);
    setClassSectionId(null);
    setStudentId(null);
    setFormValues({});
    setPreviewHtml('');
    setPreviewError(null);
  }, []);

  const selectType = (type: CertificateType) => {
    if (certificateType !== type) {
      setClassSectionId(null);
      setStudentId(null);
      setFormValues({});
      setPreviewHtml('');
      setPreviewError(null);
    }
    setCertificateType(type);
  };

  const handleClassChange = (value: string | null) => {
    setClassSectionId(value);
    setStudentId(null);
    setFormValues({});
    setPreviewHtml('');
    setPreviewError(null);
  };

  const activeYearName = activeYearResponse?.data?.name;

  const handleStudentChange = (value: string | null) => {
    appliedSignatureDefaultsKey.current = null;
    setStudentId(value);
    setFormValues(
      value && certificateType
        ? defaultCertificateFormValues(certificateType, {
            academicYearName: activeYearName,
          })
        : {},
    );
    setPreviewHtml('');
    setPreviewError(null);
  };

  /** Patch academic year into defaults once the active year finishes loading. */
  useEffect(() => {
    if (!certificateType || !studentId || !activeYearName) return;
    setFormValues((prev) => {
      const next = { ...prev };
      let changed = false;
      if (certificateType === 'custom') {
        const current = typeof prev.citationAcademicYear === 'string' ? prev.citationAcademicYear : '';
        if (!current.trim() || current === '2025–2026') {
          next.citationAcademicYear = activeYearName;
          changed = true;
        }
      }
      if (certificateType === 'academic' || certificateType === 'promotion') {
        const current = typeof prev.academicYear === 'string' ? prev.academicYear : '';
        if (!current.trim() || current === '2025–2026') {
          next.academicYear = activeYearName;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [activeYearName, certificateType, studentId]);

  useEffect(() => {
    if (!issueFormDefaults || !studentId || !certificateType) return;
    const key = `${studentId}:${certificateType}`;
    if (appliedSignatureDefaultsKey.current === key) return;
    appliedSignatureDefaultsKey.current = key;
    setFormValues((prev) => ({
      ...prev,
      signature1Name: issueFormDefaults.signature1Name,
      signature2Name: issueFormDefaults.signature2Name,
    }));
  }, [issueFormDefaults, studentId, certificateType]);

  const handleFieldChange = (key: string, value: unknown) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const fieldsComplete =
    !!certificateType && areCertificateFieldsComplete(certificateType, formValues);

  useEffect(() => {
    if (!certificateType || !studentId) return;

    if (!fieldsComplete) {
      setPreviewHtml('');
      setPreviewError(null);
      return;
    }

    let cancelled = false;
    const payload = toCertificateDataPayload(certificateType, formValues);
    const timer = setTimeout(() => {
      generatePreview(
        {
          studentId,
          certificateType,
          certificateData: payload,
        },
        {
          onSuccess: (html) => {
            if (cancelled) return;
            if (html.trim().length > 0) {
              setPreviewHtml(html);
              setPreviewError(null);
            } else {
              setPreviewHtml('');
              setPreviewError(t('issue.previewFailed'));
            }
          },
          onError: async (err) => {
            if (cancelled) return;
            setPreviewHtml('');
            const { message } = await parseApiErrorMessage(err);
            setPreviewError(message ?? t('issue.previewFailed'));
          },
        },
      );
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [certificateType, studentId, formValues, fieldsComplete, generatePreview, t]);

  const typeCard = (type: CertificateType, icon: React.ReactNode) => {
    const selected = certificateType === type;
    const primary = theme.primaryColor;
    return (
      <Paper
        key={type}
        withBorder
        p="md"
        radius="md"
        style={{
          cursor: 'pointer',
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? theme.colors[primary][6] : theme.colors.gray[3],
          background: selected ? theme.colors[primary][0] : undefined,
          transition: 'border-color 120ms ease, background-color 120ms ease',
        }}
        onClick={() => selectType(type)}
        id={`cert-issue-type-${type}`}
      >
        <Stack align="center" gap="xs">
          {icon}
          <Text fw={600} size="sm" ta="center">
            {t(`types.${type}`)}
          </Text>
        </Stack>
      </Paper>
    );
  };

  const handleIssue = () => {
    if (!certificateType || !studentId) return;
    issueMutation.mutate(
      {
        studentId,
        certificateType,
        certificateData: toCertificateDataPayload(certificateType, formValues),
      },
      {
        onSuccess: () => {
          reset();
          onIssued?.();
        },
      },
    );
  };

  return (
    <Paper withBorder p="lg" radius="md" id="cert-issue-panel">
      <Stack gap="lg">
        <Text size="sm" c="dimmed">
          {t('issue.selectTypeHint')}
        </Text>
        <Title order={4}>{t('issue.awardGroup')}</Title>
        <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }}>
          {typeCard('sports', <IconTrophy size={32} />)}
          {typeCard('academic', <IconMedal size={32} />)}
          {typeCard('promotion', <IconAward size={32} />)}
          {typeCard('participation', <IconCertificate size={32} />)}
          {typeCard('custom', <IconWriting size={32} />)}
        </SimpleGrid>
        <Title order={4}>{t('issue.adminGroup')}</Title>
        <SimpleGrid cols={{ base: 2, sm: 2 }}>
          {typeCard('leaving', <IconSchool size={32} />)}
          {typeCard('character', <IconUser size={32} />)}
        </SimpleGrid>

        {certificateType && (
          <Stack gap="md" id="cert-issue-selection">
            {isLeaving && (
              <Alert
                color={theme.primaryColor}
                variant="light"
                id="cert-leaving-hint"
                title={t('issue.leavingHintTitle')}
              >
                <Text size="sm">{t('issue.leavingHint')}</Text>
                <List size="sm" mt="xs" spacing={4}>
                  <List.Item>{t('issue.leavingStepPromotion')}</List.Item>
                  <List.Item>{t('issue.leavingStepOutcomes')}</List.Item>
                  <List.Item>{t('issue.leavingStepReturn')}</List.Item>
                </List>
                <Button
                  component={Link}
                  href="/promotion-placement"
                  color={theme.primaryColor}
                  variant="light"
                  size="xs"
                  mt="sm"
                  id="cert-leaving-go-promotion"
                >
                  {tNav('promotionPlacement')}
                </Button>
              </Alert>
            )}
            {!isLeaving &&
              (activeYearLoading || classSectionsLoading ? (
                <CertificateSelectFieldSkeleton />
              ) : (
                <Select
                  id="cert-issue-class"
                  label={t('issue.classFilter')}
                  placeholder={t('issue.classFilterPlaceholder')}
                  data={classSectionOptions}
                  value={classSectionId}
                  onChange={handleClassChange}
                  clearable
                  searchable
                />
              ))}
            {isLeaving &&
              (activeYearLoading || classSectionsLoading ? (
                <CertificateSelectFieldSkeleton />
              ) : (
                <Select
                  id="cert-issue-class-leaving"
                  label={t('issue.classFilterOptional')}
                  description={t('issue.classFilterOptionalDescription')}
                  placeholder={t('issue.classFilterPlaceholder')}
                  data={classSectionOptions}
                  value={classSectionId}
                  onChange={handleClassChange}
                  clearable
                  searchable
                />
              ))}
            {(isLeaving || classSectionId) &&
              (studentsLoading ? (
                <CertificateSelectFieldSkeleton />
              ) : (
                <Select
                  id="cert-issue-student"
                  label={t('issue.selectStudent')}
                  placeholder={t('issue.selectStudentPlaceholder')}
                  data={studentOptions}
                  value={studentId}
                  onChange={handleStudentChange}
                  searchable
                  clearable
                  nothingFoundMessage={
                    isLeaving ? t('issue.noLeavingStudents') : t('issue.noStudents')
                  }
                />
              ))}
          </Stack>
        )}

        {certificateType && studentId && (
          <Paper withBorder p="md" radius="md" id="cert-issue-details">
            <Stack gap="lg">
              <CertificateDynamicForm
                certificateType={certificateType}
                values={formValues}
                onChange={handleFieldChange}
                signatureSlotLabels={signatureSlotLabels}
              />
              <CertificateLivePreview
                html={previewHtml}
                loading={previewPending}
                isLandscape={isAwardCertificateType(certificateType)}
                title={t('issue.preview')}
                emptyLabel={
                  fieldsComplete ? t('issue.previewEmpty') : t('issue.previewRequiredFields')
                }
                errorMessage={previewError}
              />
            </Stack>
            <Group justify="flex-end" mt="md">
              <Button
                id="cert-issue-submit"
                loading={issueMutation.isPending}
                disabled={issueMutation.isPending}
                onClick={handleIssue}
              >
                {t('issue.submit')}
              </Button>
            </Group>
          </Paper>
        )}
      </Stack>
    </Paper>
  );
}

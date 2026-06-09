'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Alert,
  Button,
  FileInput,
  Group,
  List,
  MultiSelect,
  Paper,
  Select,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import Link from 'next/link';
import { IconDownload } from '@tabler/icons-react';
import { useDebouncedValue } from '@mantine/hooks';
import { useClassSections } from '@/hooks/useClassSections';
import { useActiveAcademicYear } from '@/hooks/useAcademicYears';
import {
  useGenerateIdCards,
  useIdCardStats,
  useUploadIdCardPhoto,
  downloadBulkIdCardsZip,
} from '@/hooks/useIdCards';
import { useRoles } from '@/hooks/useRoles';
import { useStaff } from '@/hooks/useStaff';
import { IdCardDesignPreview } from '@/components/features/id-cards/IdCardDesignPreview';
import { IdCardPhotoIdReference } from '@/components/features/id-cards/IdCardPhotoIdReference';
import { IdCardStatsCards } from '@/components/features/id-cards/IdCardStatsCards';
import { STAFF_ID_CARD_ROLE_EXCLUDE } from '@/lib/id-cards/format-staff-role';
import type { IdCardDesignVariant, IdCardPersonType } from '@/types/id-cards';

function GenerateSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="md">
        <div>
          <Title order={4}>{title}</Title>
          {description ? (
            <Text size="sm" c="dimmed" mt={4}>
              {description}
            </Text>
          ) : null}
        </div>
        {children}
      </Stack>
    </Paper>
  );
}

export function IdCardsGenerateWizard() {
  const t = useTranslations('idCards');
  const [personType, setPersonType] = useState<IdCardPersonType>('student');
  const [classSectionId, setClassSectionId] = useState<string | null>(null);
  const [staffRoleId, setStaffRoleId] = useState<string | null>(null);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [debouncedStaffSearch] = useDebouncedValue(staffSearch, 300);
  const [designVariant, setDesignVariant] = useState<IdCardDesignVariant>('classic');
  const [photosAcknowledged, setPhotosAcknowledged] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [generatedCardIds, setGeneratedCardIds] = useState<string[]>([]);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [zipLoading, setZipLoading] = useState(false);

  const { data: stats, isLoading: statsLoading } = useIdCardStats();
  const { data: activeYearResponse } = useActiveAcademicYear();
  const activeYearId = activeYearResponse?.data?.id;
  const { data: classSectionsResponse } = useClassSections({
    minimal: true,
    limit: 200,
    academicYearId: activeYearId,
    enabled: !!activeYearId && personType === 'student',
  });
  const { data: rolesResponse } = useRoles();
  const generateCards = useGenerateIdCards();
  const uploadPhoto = useUploadIdCardPhoto();

  const { data: staffResponse, isLoading: staffPickerLoading } = useStaff({
    isActive: true,
    limit: 200,
    role: staffRoleId ?? undefined,
    search: debouncedStaffSearch || undefined,
    enabled: personType === 'staff',
  });

  const classSections = classSectionsResponse?.data ?? [];

  const classOptions = classSections.map((cs) => ({
    value: cs.id,
    label: `${cs.className ?? ''} ${cs.sectionName ?? ''}`.trim(),
  }));

  const staffRoleOptions = useMemo(() => {
    const roles = rolesResponse?.data ?? [];
    return roles
      .filter((r) => !STAFF_ID_CARD_ROLE_EXCLUDE.has(r.name.toLowerCase()))
      .map((r) => ({ value: r.id, label: r.displayName }));
  }, [rolesResponse?.data]);

  const staffPickerOptions = useMemo(() => {
    const list = staffResponse?.data ?? [];
    return list.map((s) => ({
      value: s.id,
      label: `${s.fullName ?? '—'}${s.employeeId ? ` (${s.employeeId})` : ''}`.trim(),
    }));
  }, [staffResponse?.data]);

  const selectedClassSectionLabel =
    classOptions.find((o) => o.value === classSectionId)?.label ?? '';

  const recipientsReady = personType === 'student' ? !!classSectionId : true;

  const canGenerate = recipientsReady;

  const generatePayload = {
    personType,
    classSectionId: personType === 'student' ? (classSectionId ?? undefined) : undefined,
    staffRoleId:
      personType === 'staff' && !selectedStaffIds.length ? (staffRoleId ?? undefined) : undefined,
    personIds:
      personType === 'staff' && selectedStaffIds.length > 0 ? selectedStaffIds : undefined,
    designVariant,
  };

  const isGenerateComplete = generatedCardIds.length > 0;

  const resetRecipientFlow = () => {
    setPhotosAcknowledged(false);
    setUploadFiles([]);
  };

  const runGenerate = async () => {
    setGeneratedCardIds([]);
    setGenerateError(null);
    try {
      const cards = await generateCards.mutateAsync(generatePayload);
      setGeneratedCardIds(cards.map((c) => c.id));
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : t('wizard.failed'));
    }
  };

  const uploadAllPhotos = async () => {
    for (const file of uploadFiles) {
      await uploadPhoto.mutateAsync({
        personType,
        file,
        matchByFilename: true,
      });
    }
    setUploadFiles([]);
    setPhotosAcknowledged(true);
  };

  return (
    <Stack gap="md">
      <IdCardStatsCards stats={stats} isLoading={statsLoading} />

      <GenerateSection title={t('wizard.step1')} description={t('wizard.step1Desc')}>
        <Select
          id="id-cards-wizard-person-type"
          label={t('personType')}
          value={personType}
          onChange={(v) => {
            if (!v) return;
            setPersonType(v as IdCardPersonType);
            setClassSectionId(null);
            setStaffRoleId(null);
            setSelectedStaffIds([]);
            setStaffSearch('');
            resetRecipientFlow();
          }}
          data={[
            { value: 'student', label: t('tabs.students') },
            { value: 'staff', label: t('tabs.staff') },
          ]}
        />
        {personType === 'student' ? (
          <Select
            id="id-cards-wizard-class-section"
            label={t('classSection')}
            placeholder={t('selectClassSection')}
            data={classOptions}
            value={classSectionId}
            onChange={(v) => {
              setClassSectionId(v);
              resetRecipientFlow();
            }}
            searchable
            clearable
          />
        ) : (
          <>
            <Select
              id="id-cards-wizard-staff-role"
              label={t('staffRoleFilter')}
              placeholder={t('staffRoleFilterAll')}
              data={staffRoleOptions}
              value={staffRoleId}
              onChange={setStaffRoleId}
              searchable
              clearable
            />
            <MultiSelect
              id="id-cards-wizard-staff-picker"
              label={t('staffPickerLabel')}
              placeholder={t('staffPickerPlaceholder')}
              data={staffPickerOptions}
              value={selectedStaffIds}
              onChange={setSelectedStaffIds}
              searchable
              clearable
              searchValue={staffSearch}
              onSearchChange={setStaffSearch}
              nothingFoundMessage={
                staffPickerLoading ? t('staffPickerLoading') : t('staffPickerEmpty')
              }
            />
            <Text size="sm" c="dimmed">
              {t('staffPickerHint')}
            </Text>
          </>
        )}
        <IdCardDesignPreview
          variant={designVariant}
          onVariantChange={setDesignVariant}
          personType={personType}
        />
      </GenerateSection>

      {recipientsReady ? (
        <GenerateSection title={t('wizard.step2')} description={t('wizard.step2Desc')}>
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              {t('wizard.photoGuidelinesTitle')}
            </Text>
            <List size="sm" spacing={6} c="dimmed">
              <List.Item>{t('wizard.photoGuideline1')}</List.Item>
              <List.Item>{t('wizard.photoGuideline2')}</List.Item>
              <List.Item>{t('wizard.photoGuideline3')}</List.Item>
              <List.Item>{t('wizard.photoGuideline4')}</List.Item>
              <List.Item>{t('wizard.photoGuideline5')}</List.Item>
            </List>
          </Stack>
          <IdCardPhotoIdReference
            personType={personType}
            classSectionId={classSectionId}
            classSectionLabel={selectedClassSectionLabel}
            staffRoleId={staffRoleId}
            selectedStaffIds={selectedStaffIds}
          />
          <FileInput
            id="id-cards-wizard-photos"
            label={t('uploadPhotos')}
            multiple
            accept="image/png,image/jpeg,image/webp"
            value={uploadFiles}
            onChange={setUploadFiles}
          />
          <Group>
            <Button
              id="id-cards-wizard-upload-photos"
              disabled={uploadFiles.length === 0 || uploadPhoto.isPending}
              loading={uploadPhoto.isPending}
              onClick={() => void uploadAllPhotos()}
            >
              {t('wizard.uploadAndContinue')}
            </Button>
            <Button
              id="id-cards-wizard-skip-photos"
              variant="subtle"
              onClick={() => setPhotosAcknowledged(true)}
            >
              {t('wizard.skip')}
            </Button>
          </Group>
        </GenerateSection>
      ) : null}

      {recipientsReady && photosAcknowledged ? (
        <GenerateSection title={t('wizard.step3')} description={t('wizard.step3Desc')}>
          <Alert>{t('wizard.reviewHint')}</Alert>
          <Button
            id="id-cards-wizard-generate"
            disabled={!canGenerate || generateCards.isPending}
            loading={generateCards.isPending}
            onClick={() => void runGenerate()}
          >
            {t('wizard.generateNow')}
          </Button>
        </GenerateSection>
      ) : null}

      {generateError ? (
        <Alert color="red">{generateError}</Alert>
      ) : null}

      {isGenerateComplete ? (
        <GenerateSection title={t('wizard.step4')} description={t('wizard.step4Desc')}>
          <Alert color="green">{t('wizard.complete')}</Alert>
          <Button
            id="id-cards-wizard-download-pdf-zip"
            leftSection={<IconDownload size={18} />}
            loading={zipLoading}
            disabled={zipLoading}
            onClick={async () => {
              setZipLoading(true);
              try {
                await downloadBulkIdCardsZip(generatedCardIds, 'single', {
                  designVariant,
                  messages: {
                    preparing: t('downloadPdfPreparing'),
                    failed: t('downloadPdfFailed'),
                  },
                });
              } finally {
                setZipLoading(false);
              }
            }}
          >
            {t('wizard.downloadZip')}
          </Button>
          <Button id="id-cards-wizard-finish" component={Link} href="/id-cards" variant="light">
            {t('wizard.viewCards')}
          </Button>
        </GenerateSection>
      ) : null}
    </Stack>
  );
}

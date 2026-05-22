'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Alert,
  Button,
  Group,
  Pagination,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useClassSections } from '@/hooks/useClassSections';
import { useActiveAcademicYear } from '@/hooks/useAcademicYears';
import {
  useIdCards,
  useUpdateIdCardStatus,
  downloadBulkIdCardsZip,
} from '@/hooks/useIdCards';
import type { ClassSection } from '@/types/class-sections';
import { IdCardGrid, IdCardGridSkeleton } from '@/components/features/id-cards/IdCardGrid';
import { IdCardDesignVariantToggle } from '@/components/features/id-cards/IdCardDesignVariantToggle';
import { IdCardsGenerateWizard } from '@/components/features/id-cards/IdCardsGenerateWizard';
import type { IdCard, IdCardDesignVariant, IdCardPersonType, IdCardStatus } from '@/types/id-cards';

const PAGE_SIZE = 24;

export default function IdCardsPage() {
  const t = useTranslations('idCards');
  const searchParams = useSearchParams();
  const initialTab = searchParams?.get('tab') ?? 'generate';
  const [tab, setTab] = useState<string | null>(initialTab);
  const [statusFilter, setStatusFilter] = useState<IdCardStatus | null>(null);
  const [photoFilter, setPhotoFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [downloadDesignVariant, setDownloadDesignVariant] = useState<IdCardDesignVariant>('classic');
  const [classSectionId, setClassSectionId] = useState<string | null>(null);

  const listPersonType = tab === 'staff' ? 'staff' : tab === 'student' ? 'student' : null;
  const missingPhotoOnly = photoFilter === 'missing';

  const { data: activeYearResponse } = useActiveAcademicYear();
  const activeYearId = activeYearResponse?.data?.id;
  const { data: classSectionsResponse } = useClassSections({
    minimal: true,
    limit: 200,
    academicYearId: activeYearId,
    enabled: !!activeYearId && tab === 'student',
  });

  const classSectionOptions = useMemo(() => {
    const list = (classSectionsResponse?.data as ClassSection[] | undefined) ?? [];
    return list
      .sort((a, b) => {
        const classOrderA = a.classSortOrder ?? 999;
        const classOrderB = b.classSortOrder ?? 999;
        if (classOrderA !== classOrderB) return classOrderA - classOrderB;
        const sectionOrderA = a.sectionSortOrder ?? 999;
        const sectionOrderB = b.sectionSortOrder ?? 999;
        return sectionOrderA - sectionOrderB;
      })
      .map((cs) => ({
        value: cs.id,
        label: `${cs.className ?? ''} ${cs.sectionName ?? ''}`.trim() || cs.id,
      }));
  }, [classSectionsResponse?.data]);

  const { data, isLoading, error } = useIdCards({
    personType: listPersonType ?? undefined,
    status: statusFilter ?? undefined,
    classSectionId: tab === 'student' ? (classSectionId ?? undefined) : undefined,
    search: search || undefined,
    missingPhotoOnly,
    page,
    limit: PAGE_SIZE,
    enabled: listPersonType !== null,
  });

  const updateStatus = useUpdateIdCardStatus();

  const cards = data?.data ?? [];
  const meta = data?.meta;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const statusOptions = useMemo(
    () =>
      (['draft', 'approved', 'printed', 'issued', 'revoked'] as IdCardStatus[]).map((s) => ({
        value: s,
        label: t(`status.${s}`),
      })),
    [t],
  );

  const photoFilterOptions = useMemo(
    () => [{ value: 'missing', label: t('missingPhotosOnly') }],
    [t],
  );

  const pdfMessages = {
    preparing: t('downloadPdfPreparing'),
    failed: t('downloadPdfFailed'),
  };

  const resetFilters = () => {
    setPage(1);
    setSelectedIds([]);
  };

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%" wrap="nowrap" align="center" gap="sm">
          <Title order={1} style={{ flex: 1, minWidth: 0 }} lineClamp={1}>
            {t('title')}
          </Title>
        </Group>
      </div>
      <div style={{ marginTop: '60px', padding: 'var(--mantine-spacing-md)' }}>
        <Stack gap="md">
          <Tabs
            value={tab}
            onChange={(v) => {
              setTab(v);
              resetFilters();
              setClassSectionId(null);
              setSearch('');
              setStatusFilter(null);
              setPhotoFilter(null);
            }}
          >
            <Tabs.List>
              <Tabs.Tab value="generate" id="id-cards-tab-generate">
                {t('tabs.generate')}
              </Tabs.Tab>
              <Tabs.Tab value="student" id="id-cards-tab-students">
                {t('tabs.students')}
              </Tabs.Tab>
              <Tabs.Tab value="staff" id="id-cards-tab-staff">
                {t('tabs.staff')}
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="generate" pt="md">
              <IdCardsGenerateWizard />
            </Tabs.Panel>

            <Tabs.Panel value="student" pt="md">
              <IdCardsListPanel
                personType="student"
                cards={cards}
                meta={meta}
                page={page}
                onPageChange={(p) => {
                  setPage(p);
                  setSelectedIds([]);
                }}
                isLoading={isLoading}
                error={error}
                search={search}
                onSearchChange={(v) => {
                  setSearch(v);
                  resetFilters();
                }}
                statusFilter={statusFilter}
                onStatusFilterChange={(v) => {
                  setStatusFilter(v);
                  resetFilters();
                }}
                statusOptions={statusOptions}
                photoFilter={photoFilter}
                onPhotoFilterChange={(v) => {
                  setPhotoFilter(v);
                  resetFilters();
                }}
                photoFilterOptions={photoFilterOptions}
                classSectionId={classSectionId}
                onClassSectionIdChange={(id) => {
                  setClassSectionId(id);
                  resetFilters();
                }}
                classSectionOptions={classSectionOptions}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={setSelectedIds}
                onApprove={(cardIds) => updateStatus.mutate({ status: 'approved', cardIds })}
                onBulkDownload={() =>
                  void downloadBulkIdCardsZip(selectedIds, 'single', {
                    designVariant: downloadDesignVariant,
                    messages: pdfMessages,
                  })
                }
                approveLoading={updateStatus.isPending}
                downloadDesignVariant={downloadDesignVariant}
                onDownloadDesignVariantChange={setDownloadDesignVariant}
                pdfMessages={pdfMessages}
                t={t}
              />
            </Tabs.Panel>

            <Tabs.Panel value="staff" pt="md">
              <IdCardsListPanel
                personType="staff"
                cards={cards}
                meta={meta}
                page={page}
                onPageChange={(p) => {
                  setPage(p);
                  setSelectedIds([]);
                }}
                isLoading={isLoading}
                error={error}
                search={search}
                onSearchChange={(v) => {
                  setSearch(v);
                  resetFilters();
                }}
                statusFilter={statusFilter}
                onStatusFilterChange={(v) => {
                  setStatusFilter(v);
                  resetFilters();
                }}
                statusOptions={statusOptions}
                photoFilter={photoFilter}
                onPhotoFilterChange={(v) => {
                  setPhotoFilter(v);
                  resetFilters();
                }}
                photoFilterOptions={photoFilterOptions}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={setSelectedIds}
                onApprove={(cardIds) => updateStatus.mutate({ status: 'approved', cardIds })}
                onBulkDownload={() =>
                  void downloadBulkIdCardsZip(selectedIds, 'single', {
                    designVariant: downloadDesignVariant,
                    messages: pdfMessages,
                  })
                }
                approveLoading={updateStatus.isPending}
                downloadDesignVariant={downloadDesignVariant}
                onDownloadDesignVariantChange={setDownloadDesignVariant}
                pdfMessages={pdfMessages}
                t={t}
              />
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </div>
    </>
  );
}

type ListPanelProps = {
  personType: IdCardPersonType;
  cards: IdCard[];
  meta?: { total: number; page: number; limit: number; totalPages: number };
  page: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
  error: Error | null;
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: IdCardStatus | null;
  onStatusFilterChange: (v: IdCardStatus | null) => void;
  statusOptions: { value: string; label: string }[];
  photoFilter: string | null;
  onPhotoFilterChange: (v: string | null) => void;
  photoFilterOptions: { value: string; label: string }[];
  classSectionId?: string | null;
  onClassSectionIdChange?: (v: string | null) => void;
  classSectionOptions?: { value: string; label: string }[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (ids: string[]) => void;
  onApprove: (cardIds: string[]) => void;
  onBulkDownload: () => void;
  approveLoading: boolean;
  downloadDesignVariant: IdCardDesignVariant;
  onDownloadDesignVariantChange: (v: IdCardDesignVariant) => void;
  pdfMessages: { preparing: string; failed: string };
  t: ReturnType<typeof useTranslations<'idCards'>>;
};

function IdCardsListPanel({
  personType,
  cards,
  meta,
  page,
  onPageChange,
  isLoading,
  error,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  statusOptions,
  photoFilter,
  onPhotoFilterChange,
  photoFilterOptions,
  classSectionId = null,
  onClassSectionIdChange,
  classSectionOptions = [],
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onApprove,
  onBulkDownload,
  approveLoading,
  downloadDesignVariant,
  onDownloadDesignVariantChange,
  pdfMessages,
  t,
}: ListPanelProps) {
  const showClassSectionFilter =
    personType === 'student' && classSectionOptions.length > 0 && !!onClassSectionIdChange;
  const selectedCards = cards.filter((c) => c.id && selectedIds.includes(c.id));
  const approvableIds = selectedCards.filter((c) => c.status === 'draft').map((c) => c.id);
  const emptyMessage = personType === 'staff' ? t('emptyStaff') : t('emptyStudents');

  return (
    <Stack gap="md">
      <Group align="flex-end" wrap="wrap" gap="sm">
        <TextInput
          id="id-cards-search"
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => onSearchChange(e.currentTarget.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        {showClassSectionFilter && (
          <Select
            id="id-cards-class-section-filter"
            placeholder={t('filterAllClassSections')}
            clearable
            searchable
            data={classSectionOptions}
            value={classSectionId}
            onChange={onClassSectionIdChange}
            style={{ minWidth: 200 }}
          />
        )}
        <Select
          id="id-cards-status-filter"
          placeholder={t('filterStatus')}
          clearable
          data={statusOptions}
          value={statusFilter}
          onChange={(v) => onStatusFilterChange(v as IdCardStatus | null)}
          style={{ minWidth: 140 }}
        />
        <Select
          id="id-cards-photo-filter"
          placeholder={t('filterAllPhotos')}
          clearable
          data={photoFilterOptions}
          value={photoFilter}
          onChange={onPhotoFilterChange}
          style={{ minWidth: 160 }}
        />
      </Group>

      <IdCardDesignVariantToggle
        value={downloadDesignVariant}
        onChange={onDownloadDesignVariantChange}
        id="id-cards-list-design-variant"
      />

      {selectedIds.length > 0 && (
        <Stack gap="xs">
          <Group>
            {approvableIds.length > 0 && (
              <Button
                id="id-cards-bulk-approve"
                variant="light"
                disabled={approveLoading}
                loading={approveLoading}
                onClick={() => onApprove(approvableIds)}
              >
                {t('approveSelected', { count: approvableIds.length })}
              </Button>
            )}
            <Button id="id-cards-bulk-download" variant="light" onClick={onBulkDownload}>
              {t('downloadZip')}
            </Button>
          </Group>
          {approvableIds.length === 0 && (
            <Text size="sm" c="dimmed">
              {t('allSelectedApproved')}
            </Text>
          )}
        </Stack>
      )}

      {isLoading ? (
        <IdCardGridSkeleton />
      ) : error ? (
        <Alert color="red">{error.message}</Alert>
      ) : cards.length === 0 ? (
        <Text c="dimmed">{emptyMessage}</Text>
      ) : (
        <>
          <IdCardGrid
            cards={cards}
            personType={personType}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
            onToggleSelectAll={onToggleSelectAll}
            downloadDesignVariant={downloadDesignVariant}
            pdfMessages={pdfMessages}
          />
          {meta && meta.totalPages > 1 && (
            <Group justify="center" mt="md">
              <Pagination total={meta.totalPages} value={page} onChange={onPageChange} />
            </Group>
          )}
        </>
      )}
    </Stack>
  );
}

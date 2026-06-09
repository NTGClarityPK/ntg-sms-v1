'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Pagination,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import '@mantine/dates/styles.css';
import { modals } from '@mantine/modals';
import { IconBan, IconCalendar, IconDownload } from '@tabler/icons-react';
import {
  downloadCertificatePdf,
  exportCertificateHistoryCsv,
  useCertificateHistory,
  useRevokeCertificate,
} from '@/hooks/useCertificates';
import { useClassSections } from '@/hooks/useClassSections';
import { useActiveAcademicYear } from '@/hooks/useAcademicYears';
import type { Certificate, CertificateStatus, CertificateType } from '@/types/certificates';
import type { ClassSection } from '@/types/class-sections';

const TYPES: CertificateType[] = [
  'sports',
  'academic',
  'promotion',
  'participation',
  'custom',
  'leaving',
  'character',
];

const STATUSES: CertificateStatus[] = ['issued', 'revoked', 'draft'];

type Props = {
  mine?: boolean;
};

export function CertificateHistoryTable({ mine = false }: Props) {
  const t = useTranslations('certificates');
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<CertificateType | null>(null);
  const [statusFilter, setStatusFilter] = useState<CertificateStatus | null>(null);
  const [classSectionId, setClassSectionId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const { data: activeYearResponse } = useActiveAcademicYear();
  const activeYearId = activeYearResponse?.data?.id;
  const { data: classSectionsResponse } = useClassSections({
    minimal: true,
    limit: 200,
    academicYearId: activeYearId,
    enabled: !mine,
  });

  const classSectionOptions = useMemo(() => {
    const list = (classSectionsResponse?.data as ClassSection[] | undefined) ?? [];
    return list.map((cs) => ({
      value: cs.id,
      label: `${cs.className ?? ''} ${cs.sectionName ?? ''}`.trim() || cs.id,
    }));
  }, [classSectionsResponse?.data]);

  const { data, isLoading, isFetching, error } = useCertificateHistory({
    page,
    limit: 20,
    type: typeFilter ?? undefined,
    status: statusFilter ?? undefined,
    classSectionId: classSectionId ?? undefined,
    startDate: startDate ? startDate.toISOString().slice(0, 10) : undefined,
    endDate: endDate ? endDate.toISOString().slice(0, 10) : undefined,
    mine,
  });

  const revokeMutation = useRevokeCertificate();
  const rows = data?.data ?? [];
  const meta = data?.meta;

  const statusColor = (s: CertificateStatus) => {
    if (s === 'issued') return 'green';
    if (s === 'revoked') return 'red';
    return 'gray';
  };

  const handleRevoke = (cert: Certificate) => {
    modals.openConfirmModal({
      title: t('history.revokeConfirmTitle'),
      children: <Text size="sm">{t('history.revokeConfirmMessage')}</Text>,
      labels: { confirm: t('history.revoke'), cancel: t('history.cancel') },
      confirmProps: { color: 'red', id: 'cert-revoke-confirm' },
      onConfirm: () => revokeMutation.mutate(cert.id),
    });
  };

  const historyBusy = isLoading || isFetching || !data;

  if (error) {
    return <Text c="red">{error.message}</Text>;
  }

  return (
    <Stack gap="md">
      <Group grow align="flex-end">
        <Select
          id="cert-history-type"
          label={t('history.filterType')}
          data={TYPES.map((v) => ({ value: v, label: t(`types.${v}`) }))}
          value={typeFilter}
          onChange={(v) => {
            setTypeFilter(v as CertificateType | null);
            setPage(1);
          }}
          clearable
        />
        <Select
          id="cert-history-status"
          label={t('history.filterStatus')}
          data={STATUSES.map((v) => ({ value: v, label: t(`status.${v}`) }))}
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v as CertificateStatus | null);
            setPage(1);
          }}
          clearable
        />
        {!mine && (
          <Select
            id="cert-history-class"
            label={t('history.filterClass')}
            data={classSectionOptions}
            value={classSectionId}
            onChange={(v) => {
              setClassSectionId(v);
              setPage(1);
            }}
            clearable
          />
        )}
        <DatePickerInput
          id="cert-history-start"
          label={t('history.startDate')}
          placeholder={t('issue.selectDate')}
          value={startDate}
          onChange={setStartDate}
          leftSection={<IconCalendar size={16} />}
          clearable
        />
        <DatePickerInput
          id="cert-history-end"
          label={t('history.endDate')}
          placeholder={t('issue.selectDate')}
          value={endDate}
          onChange={setEndDate}
          leftSection={<IconCalendar size={16} />}
          clearable
        />
      </Group>

      {!mine && (
        <Group>
          <Button
            id="cert-history-export"
            variant="light"
            onClick={() =>
              exportCertificateHistoryCsv({
                type: typeFilter ?? undefined,
                status: statusFilter ?? undefined,
                classSectionId: classSectionId ?? undefined,
                startDate: startDate ? startDate.toISOString().slice(0, 10) : undefined,
                endDate: endDate ? endDate.toISOString().slice(0, 10) : undefined,
              })
            }
          >
            {t('history.exportCsv')}
          </Button>
        </Group>
      )}

      <Paper withBorder p="md" radius="md" style={{ overflow: 'hidden' }}>
        {historyBusy ? (
          <Stack gap="sm">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} height={48} radius="sm" />
            ))}
          </Stack>
        ) : rows.length === 0 ? (
          <Text c="dimmed" py="md">
            {t('history.empty')}
          </Text>
        ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('history.colStudent')}</Table.Th>
              <Table.Th>{t('history.colType')}</Table.Th>
              <Table.Th>{t('history.colDate')}</Table.Th>
              <Table.Th>{t('history.colIssuedBy')}</Table.Th>
              <Table.Th>{t('history.colStatus')}</Table.Th>
              <Table.Th>{t('history.colActions')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((cert) => (
              <Table.Tr key={cert.id}>
                <Table.Td>{cert.studentName}</Table.Td>
                <Table.Td>{t(`types.${cert.certificateType}`)}</Table.Td>
                <Table.Td>{new Date(cert.issuedAt).toLocaleDateString()}</Table.Td>
                <Table.Td>{cert.issuedByName ?? '—'}</Table.Td>
                <Table.Td>
                  <Badge color={statusColor(cert.status)}>{t(`status.${cert.status}`)}</Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    {cert.pdfUrl && cert.status === 'issued' && (
                      <ActionIcon
                        id={`cert-download-${cert.id}`}
                        variant="subtle"
                        title={t('history.download')}
                        onClick={() => downloadCertificatePdf(cert.id, mine)}
                      >
                        <IconDownload size={18} />
                      </ActionIcon>
                    )}
                    {!mine && cert.status === 'issued' && (
                      <ActionIcon
                        id={`cert-revoke-${cert.id}`}
                        variant="subtle"
                        color="red"
                        title={t('history.revoke')}
                        onClick={() => handleRevoke(cert)}
                        loading={revokeMutation.isPending}
                      >
                        <IconBan size={18} />
                      </ActionIcon>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        )}
      </Paper>

      {meta && meta.totalPages > 1 && (
        <Pagination
          id="cert-history-pagination"
          value={page}
          onChange={setPage}
          total={meta.totalPages}
        />
      )}

    </Stack>
  );
}

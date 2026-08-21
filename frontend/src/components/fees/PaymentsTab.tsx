'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Pagination,
  Divider,
  Group,
  Image,
  Modal,
  Paper,
  Select,
  Skeleton,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useMemo, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle, IconDownload, IconEye, IconRefresh } from '@tabler/icons-react';
import { useClassSections } from '@/hooks/useClassSections';
import { useFeePaymentsHistory, useRegenerateFeeReceipt } from '@/hooks/api/useFees';
import { apiClient } from '@/lib/api-client';
import { DatePickerInput } from '@mantine/dates';
import '@mantine/dates/styles.css';

function withCacheBust(url: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${Date.now()}`;
}

type PendingPayment = {
  id: string;
  challanNumber: string;
  studentName: string;
  amountPaid: number;
  paymentDate: string;
  bankName: string | null;
  transactionReference: string | null;
  proofDocumentUrl: string | null;
  uploadedAt: string;
};

type PaymentReview = {
  challan: { challanNumber: string; payableAmount: number; dueDate: string; receiptUrl: string | null };
  payment: {
    id: string;
    amountPaid: number;
    paymentDate: string;
    paymentMethod: string;
    bankName: string | null;
    transactionReference: string | null;
    proofDocumentUrl: string | null;
    status: string;
    verifiedAt: string | null;
    rejectionReason: string | null;
    notes: string | null;
  };
};

type ProofPreview = {
  url: string;
  fileName: string;
  mimeType?: string | null;
};

function statusBadge(status: string) {
  const s = (status ?? '').toLowerCase();
  if (s === 'pending_review') return { color: 'orange', label: 'Pending review' };
  if (s === 'verified') return { color: 'green', label: 'Verified' };
  if (s === 'rejected') return { color: 'red', label: 'Rejected' };
  return { color: 'gray', label: status || '—' };
}

function paymentMethodBadge(method: string) {
  const m = (method ?? '').toLowerCase();
  if (m === 'bank_transfer') return { color: 'blue', label: 'Bank transfer' };
  if (m === 'cash') return { color: 'grape', label: 'Cash' };
  return { color: 'gray', label: method || '—' };
}

function inferPreviewType(input: { fileName: string; mimeType?: string | null; url?: string }) {
  const fileName = (input.fileName ?? '').toLowerCase();
  const mimeType = (input.mimeType ?? '').toLowerCase();
  const url = (input.url ?? '').toLowerCase();
  const isImage =
    mimeType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/.test(fileName) || /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|#|$)/.test(url);
  if (isImage) return 'image' as const;
  const isPdf = mimeType.includes('pdf') || fileName.endsWith('.pdf') || /\.pdf(\?|#|$)/.test(url);
  if (isPdf) return 'pdf' as const;
  return 'unsupported' as const;
}

export function PaymentsTab() {
  const t = useTranslations('fees');
  const router = useRouter();
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [review, setReview] = useState<PaymentReview | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [proofPreview, setProofPreview] = useState<ProofPreview | null>(null);

  const [classSectionId, setClassSectionId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>('Pending_Review');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>(() => [null, null]);

  const classSectionsQuery = useClassSections({ page: 1, limit: 200, minimal: true, isActive: true });
  const selectedClassSection = useMemo(() => {
    const list = classSectionsQuery.data?.data ?? [];
    return classSectionId ? list.find((cs) => cs.id === classSectionId) ?? null : null;
  }, [classSectionId, classSectionsQuery.data?.data]);

  const historyQuery = useFeePaymentsHistory({
    classId: selectedClassSection?.classId,
    sectionId: selectedClassSection?.sectionId,
    status: status && status !== 'All' ? status : undefined,
    search: search.trim() ? search.trim() : undefined,
    startDate: dateRange[0] ? dateRange[0].toISOString().slice(0, 10) : undefined,
    endDate: dateRange[1] ? dateRange[1].toISOString().slice(0, 10) : undefined,
    limit: 100,
    page,
  });

  const regenerateReceipt = useRegenerateFeeReceipt();

  async function openFreshReceipt(paymentId: string) {
    try {
      const result = await regenerateReceipt.mutateAsync(paymentId);
      const url = result.receiptUrl;
      if (!url) {
        notifications.show({
          title: t('payments.receiptPrepareErrorTitle'),
          message: t('payments.receiptMissingUrl'),
          color: 'red',
        });
        return;
      }
      window.open(withCacheBust(url), '_blank', 'noopener,noreferrer');
    } catch (e: unknown) {
      notifications.show({
        title: t('payments.receiptPrepareErrorTitle'),
        message: e instanceof Error ? e.message : t('payments.receiptPrepareErrorMessage'),
        color: 'red',
      });
    }
  }

  async function openReview(id: string) {
    setSelectedId(id);
    setReview(null);
    open();
    try {
      const res = await apiClient.get<PaymentReview>(`/api/v1/fees/payments/${id}`);
      setReview(res.data);
      setAdminNotes(res.data.payment.notes ?? '');
      setRejectReason('');
    } catch (e: unknown) {
      notifications.show({ title: 'Error', message: e instanceof Error ? e.message : 'Failed to load payment', color: 'red' });
      close();
    }
  }

  async function verify() {
    if (!selectedId) return;
    await apiClient.put(`/api/v1/fees/payments/${selectedId}/verify`, { adminNotes });
    notifications.show({ title: 'Success', message: 'Payment verified', color: 'green' });
    close();
    await historyQuery.refetch();
  }

  async function reject() {
    if (!selectedId) return;
    await apiClient.put(`/api/v1/fees/payments/${selectedId}/reject`, { reason: rejectReason });
    notifications.show({ title: 'Success', message: 'Payment rejected', color: 'green' });
    close();
    await historyQuery.refetch();
  }

  const rows = historyQuery.data?.data?.rows ?? [];
  const totals = historyQuery.data?.data?.totals ?? { collected: 0, pending: 0 };
  const meta = historyQuery.data?.meta;

  return (
    <>
      <Stack gap="sm">
        <Group justify="space-between" wrap="wrap">
          <Text fw={600}>{t('tabs.payments')}</Text>
          <Group gap="xs">
            <Button
              id="fees-payments-overdue"
              variant="light"
              color="orange"
              leftSection={<IconAlertTriangle size={16} />}
              onClick={() => router.push('/reports?tab=fees')}
            >
              {t('payments.overdueBalances')}
            </Button>
            <Tooltip label={t('payments.refresh')}>
              <ActionIcon
                id="fees-payments-refresh"
                variant="light"
                size="lg"
                loading={historyQuery.isFetching}
                onClick={() => void historyQuery.refetch()}
              >
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        <Group grow>
          <Select
            id="fees-payments-class-section"
            label={t('payments.filters.class')}
            placeholder={t('payments.filters.classPlaceholder')}
            data={(classSectionsQuery.data?.data ?? []).map((cs) => ({
              value: cs.id,
              label: `${cs.classDisplayName ?? cs.className ?? ''}-${cs.sectionName ?? ''}`.replace('--', '-').trim(),
            }))}
            value={classSectionId}
            onChange={setClassSectionId}
            searchable
            nothingFoundMessage={classSectionsQuery.isLoading ? t('payments.filters.loadingClasses') : t('payments.filters.noClasses')}
          />
          <Select
            id="fees-payments-status"
            label={t('payments.filters.status')}
            value={status}
            onChange={setStatus}
            data={[
              { value: 'All', label: t('payments.filters.all') },
              { value: 'Pending_Review', label: t('payments.filters.pending') },
              { value: 'Verified', label: t('payments.filters.verified') },
              { value: 'Rejected', label: t('payments.filters.rejected') },
            ]}
          />
        </Group>

        <DatePickerInput
          id="fees-payments-date-range"
          type="range"
          label={t('payments.filters.dateRange')}
          placeholder={t('payments.filters.dateRangePlaceholder')}
          value={dateRange}
          onChange={(next) => {
            setDateRange(next ?? [null, null]);
            setPage(1);
          }}
          clearable
        />

        <TextInput
          id="fees-payments-search"
          label={t('payments.filters.search')}
          placeholder={t('payments.filters.searchPlaceholder')}
          value={search}
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            setPage(1);
          }}
        />

        <Group justify="flex-end" gap="md">
          <Button
            id="fees-payments-export"
            variant="light"
            leftSection={<IconDownload size={16} />}
            onClick={async () => {
              try {
                const params = {
                  classId: selectedClassSection?.classId,
                  sectionId: selectedClassSection?.sectionId,
                  status: status && status !== 'All' ? status : undefined,
                  search: search.trim() ? search.trim() : undefined,
                  startDate: dateRange[0] ? dateRange[0].toISOString().slice(0, 10) : undefined,
                  endDate: dateRange[1] ? dateRange[1].toISOString().slice(0, 10) : undefined,
                };
                const { blob, filename } = await apiClient.getBlobWithFilename('/api/v1/fees/payments/export', {
                  params,
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename ?? 'fee-payments-history.xlsx';
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
              } catch (e: unknown) {
                notifications.show({
                  title: t('payments.exportErrorTitle'),
                  message: e instanceof Error ? e.message : t('payments.exportErrorMessage'),
                  color: 'red',
                });
              }
            }}
          >
            {t('payments.export')}
          </Button>
          <Badge>{t('payments.totals.collected', { amount: totals.collected.toLocaleString() })}</Badge>
          <Badge variant="light">{t('payments.totals.pending', { amount: totals.pending.toLocaleString() })}</Badge>
        </Group>
      </Stack>

      {historyQuery.isLoading ? (
        <Stack gap="xs" mt="sm">
          <Skeleton height={18} width="30%" />
          <Skeleton height={240} />
        </Stack>
      ) : historyQuery.error ? (
        <Alert color="red" mt="sm">
          {t('payments.historyLoadError')}
        </Alert>
      ) : rows.length === 0 ? (
        <Text mt="sm" c="dimmed">
          {t('payments.historyEmpty')}
        </Text>
      ) : (
        <Paper withBorder radius="md" p={0} mt="sm">
          <Table.ScrollContainer minWidth={760}>
            <Table striped highlightOnHover horizontalSpacing="md" verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('payments.historyTable.date')}</Table.Th>
                  <Table.Th>{t('payments.historyTable.student')}</Table.Th>
                  <Table.Th>{t('payments.historyTable.amount')}</Table.Th>
                  <Table.Th>{t('payments.historyTable.status')}</Table.Th>
                  <Table.Th style={{ width: '1%', whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {t('payments.historyTable.actions')}
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((r) => {
                  const badge = statusBadge(r.status);
                  return (
                    <Table.Tr key={r.id}>
                      <Table.Td>
                        <Text size="sm">{r.paymentDate}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={600} lineClamp={1}>
                          {r.studentName}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="sm">{r.amountPaid.toLocaleString()}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={badge.color}>
                          {badge.label}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs" justify="flex-end" wrap="nowrap">
                          {r.status === 'Verified' ? (
                            <Button
                              id={`fees-payment-receipt-${r.id}`}
                              type="button"
                              variant="light"
                              size="xs"
                              loading={
                                regenerateReceipt.isPending && regenerateReceipt.variables === r.id
                              }
                              disabled={regenerateReceipt.isPending}
                              onClick={() => void openFreshReceipt(r.id)}
                            >
                              {t('payments.receipt')}
                            </Button>
                          ) : null}
                          {r.status === 'Pending_Review' ? (
                            <Button id={`fees-payment-review-${r.id}`} size="xs" onClick={() => void openReview(r.id)}>
                              {t('payments.review')}
                            </Button>
                          ) : null}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      )}

      {meta && meta.totalPages > 1 ? (
        <Group justify="flex-end" mt="sm">
          <Pagination value={page} onChange={setPage} total={meta.totalPages} />
        </Group>
      ) : null}

      <Modal opened={opened} onClose={close} title={t('payments.reviewTitle')} size="lg">
        {!review ? (
          <Skeleton height={180} />
        ) : (
          <Stack gap="md">
            <Paper withBorder radius="md" p="md">
              <Stack gap="xs">
                <Group justify="space-between" align="flex-start" wrap="wrap">
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">
                      {t('payments.reviewChallan')}
                    </Text>
                    <Text fw={700} ff="monospace">
                      {review.challan.challanNumber}
                    </Text>
                  </Stack>
                  <Badge variant="light" color={statusBadge(review.payment.status).color}>
                    {statusBadge(review.payment.status).label}
                  </Badge>
                </Group>

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">
                      {t('payments.historyTable.amount')}
                    </Text>
                    <Text fw={600}>{review.payment.amountPaid.toLocaleString()}</Text>
                  </Stack>
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">
                      {t('payments.filters.status')}
                    </Text>
                    <Badge variant="light" color={paymentMethodBadge(review.payment.paymentMethod).color}>
                      {paymentMethodBadge(review.payment.paymentMethod).label}
                    </Badge>
                  </Stack>
                </SimpleGrid>

                <Divider my={4} />

                {review.payment.proofDocumentUrl ? (
                  <Stack gap="sm">
                    <Group justify="center" gap="sm">
                      <Button
                        id="fees-payment-view-proof"
                        variant="light"
                        leftSection={<IconEye size={16} />}
                        style={{ minWidth: 220 }}
                        onClick={() => {
                          const url = review.payment.proofDocumentUrl;
                          if (!url) return;
                          setProofPreview({
                            url,
                            fileName: `payment-proof-${review.payment.id}`,
                            mimeType: null,
                          });
                        }}
                      >
                        {t('payments.openProof')}
                      </Button>
                      <Button
                        id="fees-payment-download-proof"
                        variant="light"
                        component="a"
                        href={review.payment.proofDocumentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        leftSection={<IconDownload size={16} />}
                        style={{ minWidth: 220 }}
                      >
                        {t('payments.downloadProof')}
                      </Button>
                    </Group>
                  </Stack>
                ) : (
                  <Text size="sm" c="dimmed">
                    {t('payments.openProof')}: —
                  </Text>
                )}
              </Stack>
            </Paper>

            <TextInput
              id="fees-payment-admin-notes"
              label={t('payments.adminNotes')}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.currentTarget.value)}
            />
            <TextInput
              id="fees-payment-reject-reason"
              label={t('payments.rejectReason')}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.currentTarget.value)}
            />

            <Group justify="flex-end">
              <Button
                id="fees-payment-reject"
                color="red"
                variant="light"
                onClick={() => void reject()}
                disabled={!rejectReason.trim()}
              >
                {t('payments.reject')}
              </Button>
              <Button id="fees-payment-verify" onClick={() => void verify()}>
                {t('payments.verify')}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <Modal
        opened={!!proofPreview}
        onClose={() => setProofPreview(null)}
        title={proofPreview?.fileName ?? 'Proof'}
        size="xl"
        centered
      >
        {!proofPreview ? null : (() => {
          const type = inferPreviewType({ fileName: proofPreview.fileName, mimeType: proofPreview.mimeType, url: proofPreview.url });
          if (type === 'image') {
            return <Image src={proofPreview.url} alt={proofPreview.fileName} fit="contain" radius="sm" />;
          }
          if (type === 'pdf') {
            return (
              <Stack gap="sm">
                <Text size="xs" c="dimmed">
                  {t('pdfPreviewNote')}
                </Text>
                <iframe
                  src={proofPreview.url}
                  title={proofPreview.fileName}
                  style={{
                    width: '100%',
                    minHeight: '70vh',
                    border: '1px solid var(--mantine-color-gray-3)',
                    borderRadius: '8px',
                  }}
                />
              </Stack>
            );
          }
          return (
            <Stack gap="sm">
              <Text size="sm" c="dimmed">
                Preview not available for this file type.
              </Text>
              <Group justify="flex-end">
                <Button
                  variant="light"
                  component="a"
                  href={proofPreview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  leftSection={<IconDownload size={16} />}
                >
                  {t('payments.downloadProof')}
                </Button>
              </Group>
            </Stack>
          );
        })()}
      </Modal>
    </>
  );
}


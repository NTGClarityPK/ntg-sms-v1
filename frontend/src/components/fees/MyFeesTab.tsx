'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Alert,
  Badge,
  Button,
  FileInput,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import '@mantine/dates/styles.css';
import { IconAlertCircle, IconDownload, IconUpload } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useMyFeePayments, useMyPendingFeeChallans, useSubmitFeePaymentProof } from '@/hooks/api/useFees';

type Mode = 'parent' | 'student';

function withCacheBust(url: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${Date.now()}`;
}

function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function statusBadge(status: string) {
  const s = (status ?? '').toLowerCase();
  if (s === 'pending_payment') return { color: 'yellow', label: 'Pending payment' };
  if (s === 'under_review') return { color: 'orange', label: 'Under review' };
  if (s === 'verified') return { color: 'green', label: 'Verified' };
  if (s === 'rejected') return { color: 'red', label: 'Rejected' };
  if (s === 'pending_review') return { color: 'orange', label: 'Pending review' };
  return { color: 'gray', label: status || '—' };
}

export function MyFeesTab(props: { mode: Mode }) {
  const tFees = useTranslations('fees');
  const tCommon = useTranslations('common');
  void tCommon;

  const challansQuery = useMyPendingFeeChallans({ mode: props.mode });
  const paymentsQuery = useMyFeePayments({ mode: props.mode });

  const submitProof = useSubmitFeePaymentProof({ mode: props.mode });
  const [uploadModal, setUploadModal] = useState<null | {
    challanId: string;
    challanNumber: string;
    studentName: string;
    payableAmount: number;
  }>(null);

  const [paymentDate, setPaymentDate] = useState<Date | null>(new Date());
  const [amountPaid, setAmountPaid] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('Bank_Transfer');
  const [bankName, setBankName] = useState<string>('');
  const [transactionReference, setTransactionReference] = useState<string>('');
  const [proofFile, setProofFile] = useState<File | null>(null);

  const pendingChallans = challansQuery.data ?? [];
  const history = paymentsQuery.data ?? [];

  const canSubmit = useMemo(() => {
    if (!uploadModal) return false;
    if (!proofFile) return false;
    if (!paymentDate) return false;
    if (typeof amountPaid !== 'number' || Number.isNaN(amountPaid)) return false;
    if (amountPaid <= 0) return false;
    if (!paymentMethod.trim()) return false;
    return true;
  }, [amountPaid, paymentDate, paymentMethod, proofFile, uploadModal]);

  return (
    <Stack gap="md">
      <Tabs defaultValue="feePayment">
        <Tabs.List>
          <Tabs.Tab value="feePayment">{tFees('tabs.feePayment')}</Tabs.Tab>
          <Tabs.Tab value="paymentHistory">{tFees('tabs.paymentHistory')}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="feePayment" pt="md">
          {challansQuery.isLoading ? (
            <Stack gap="xs">
              <Skeleton height={18} width="30%" />
              <Skeleton height={240} />
            </Stack>
          ) : challansQuery.error ? (
            <Alert icon={<IconAlertCircle size={16} />} color="red" title={tFees('myFees.loadErrorTitle')}>
              {tFees('myFees.loadErrorMessage')}
            </Alert>
          ) : pendingChallans.length === 0 ? (
            <Text c="dimmed">{tFees('myFees.noGeneratedChallans')}</Text>
          ) : (
            <Paper withBorder radius="md" p={0}>
              <Table.ScrollContainer minWidth={760}>
                <Table striped highlightOnHover horizontalSpacing="md" verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{tFees('myFees.table.student')}</Table.Th>
                      <Table.Th>{tFees('myFees.table.challan')}</Table.Th>
                      <Table.Th>{tFees('myFees.table.month')}</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>{tFees('myFees.table.amount')}</Table.Th>
                      <Table.Th>{tFees('myFees.table.status')}</Table.Th>
                      <Table.Th style={{ width: '1%', whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {tFees('myFees.table.actions')}
                      </Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {pendingChallans.map((c) => {
                      const badge = statusBadge(c.status);
                      return (
                        <Table.Tr key={c.id}>
                          <Table.Td>
                            <Text size="sm" fw={600} lineClamp={1}>
                              {c.studentName}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" ff="monospace">
                              {c.challanNumber}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{c.month}</Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text size="sm">{Number(c.payableAmount).toLocaleString()}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge variant="light" color={badge.color}>
                              {badge.label}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Group gap="xs" justify="flex-end" wrap="nowrap">
                              {c.pdfUrl ? (
                                <Button
                                  component="a"
                                  href={withCacheBust(c.pdfUrl)}
                                  target="_blank"
                                  rel="noreferrer"
                                  leftSection={<IconDownload size={16} />}
                                  size="xs"
                                  variant="light"
                                >
                                  {tFees('myFees.download')}
                                </Button>
                              ) : null}
                              <Button
                                leftSection={<IconUpload size={16} />}
                                size="xs"
                                onClick={() => {
                                  setUploadModal({
                                    challanId: c.id,
                                    challanNumber: c.challanNumber,
                                    studentName: c.studentName,
                                    payableAmount: c.payableAmount,
                                  });
                                  setPaymentDate(new Date());
                                  setAmountPaid(c.payableAmount);
                                  setPaymentMethod('Bank_Transfer');
                                  setBankName('');
                                  setTransactionReference('');
                                  setProofFile(null);
                                }}
                                disabled={c.status === 'Under_Review'}
                              >
                                {tFees('myFees.submitProof')}
                              </Button>
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
        </Tabs.Panel>

        <Tabs.Panel value="paymentHistory" pt="md">
          {paymentsQuery.isLoading ? (
            <Stack gap="xs">
              <Skeleton height={18} width="30%" />
              <Skeleton height={240} />
            </Stack>
          ) : paymentsQuery.error ? (
            <Alert icon={<IconAlertCircle size={16} />} color="red" title={tFees('myFees.historyLoadErrorTitle')}>
              {tFees('myFees.historyLoadErrorMessage')}
            </Alert>
          ) : history.length === 0 ? (
            <Text c="dimmed">{tFees('myFees.historyEmpty')}</Text>
          ) : (
            <Paper withBorder radius="md" p={0}>
              <Table.ScrollContainer minWidth={760}>
                <Table striped highlightOnHover horizontalSpacing="md" verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{tFees('myFees.historyTable.date')}</Table.Th>
                      <Table.Th>{tFees('myFees.historyTable.student')}</Table.Th>
                      <Table.Th>{tFees('myFees.historyTable.challan')}</Table.Th>
                      <Table.Th>{tFees('myFees.historyTable.month')}</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>{tFees('myFees.historyTable.amount')}</Table.Th>
                      <Table.Th>{tFees('myFees.historyTable.status')}</Table.Th>
                      <Table.Th style={{ width: '1%', whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {tFees('myFees.historyTable.actions')}
                      </Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {history.map((p, idx) => {
                      const badge = statusBadge(p.status);
                      return (
                        <Table.Tr key={`${p.challanNumber}-${p.paymentDate}-${idx}`}>
                          <Table.Td>
                            <Text size="sm">{p.paymentDate}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" fw={600} lineClamp={1}>
                              {p.studentName}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" ff="monospace">
                              {p.challanNumber}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{p.month}</Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text size="sm">{Number(p.amountPaid).toLocaleString()}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge variant="light" color={badge.color}>
                              {badge.label}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Group gap="xs" justify="flex-end" wrap="nowrap">
                              {p.receiptUrl ? (
                                <Button
                                  component="a"
                                  href={withCacheBust(p.receiptUrl)}
                                  target="_blank"
                                  rel="noreferrer"
                                  size="xs"
                                  variant="light"
                                >
                                  {tFees('myFees.receipt')}
                                </Button>
                              ) : (
                                <Text size="sm" c="dimmed">
                                  —
                                </Text>
                              )}
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
        </Tabs.Panel>
      </Tabs>

      <Modal
        opened={!!uploadModal}
        onClose={() => setUploadModal(null)}
        title={uploadModal ? tFees('myFees.uploadTitle', { challan: uploadModal.challanNumber }) : tFees('myFees.uploadTitleFallback')}
        size="lg"
      >
        {!uploadModal ? null : (
          <Stack gap="sm">
            <Alert variant="light" color="blue">
              {tFees('myFees.uploadHint', { student: uploadModal.studentName, amount: uploadModal.payableAmount.toLocaleString() })}
            </Alert>

            <Group grow>
              <DatePickerInput
                label={tFees('myFees.form.paymentDate')}
                value={paymentDate}
                onChange={setPaymentDate}
                clearable={false}
              />
              <NumberInput
                label={tFees('myFees.form.amountPaid')}
                value={amountPaid ?? undefined}
                onChange={(v) => setAmountPaid(typeof v === 'number' ? v : null)}
                min={0}
              />
            </Group>

            <Group grow>
              <Select
                label={tFees('myFees.form.paymentMethod')}
                value={paymentMethod}
                onChange={(v) => setPaymentMethod(v ?? '')}
                data={[
                  { value: 'Bank_Transfer', label: tFees('myFees.methods.bankTransfer') },
                  { value: 'Cash', label: tFees('myFees.methods.cash') },
                ]}
              />
              <TextInput
                label={tFees('myFees.form.bankName')}
                value={bankName}
                onChange={(e) => setBankName(e.currentTarget.value)}
              />
            </Group>

            <TextInput
              label={tFees('myFees.form.transactionReference')}
              value={transactionReference}
              onChange={(e) => setTransactionReference(e.currentTarget.value)}
            />

            <FileInput
              label={tFees('myFees.form.proof')}
              placeholder={tFees('myFees.form.proofPlaceholder')}
              value={proofFile}
              onChange={setProofFile}
              clearable
              accept="image/png,image/jpeg,application/pdf"
            />

            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => setUploadModal(null)} disabled={submitProof.isPending}>
                {tCommon('cancel')}
              </Button>
              <Button
                onClick={async () => {
                  if (!uploadModal) return;
                  if (!proofFile) return;
                  if (!paymentDate) return;
                  if (typeof amountPaid !== 'number' || Number.isNaN(amountPaid)) return;
                  try {
                    await submitProof.mutateAsync({
                      challanId: uploadModal.challanId,
                      amountPaid,
                      paymentDate: toLocalIsoDate(paymentDate),
                      paymentMethod,
                      bankName: bankName.trim() ? bankName.trim() : null,
                      transactionReference: transactionReference.trim() ? transactionReference.trim() : null,
                      proofDocument: proofFile,
                    });
                    notifications.show({
                      title: tFees('myFees.uploadSuccessTitle'),
                      message: tFees('myFees.uploadSuccessMessage'),
                      color: 'green',
                    });
                    setUploadModal(null);
                  } catch (e) {
                    notifications.show({
                      title: tFees('myFees.uploadErrorTitle'),
                      message: e instanceof Error ? e.message : tFees('myFees.uploadErrorMessage'),
                      color: 'red',
                    });
                  }
                }}
                disabled={!canSubmit || submitProof.isPending}
                loading={submitProof.isPending && canSubmit}
              >
                {tFees('myFees.submit')}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}


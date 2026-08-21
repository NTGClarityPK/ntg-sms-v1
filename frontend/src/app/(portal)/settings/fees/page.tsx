'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useCreateFeeTemplate, useDeleteFeeTemplate, useFeeChallanSettings, useFeeTemplates, useUpsertFeeChallanSettings } from '@/hooks/api/useFees';
import type { FeeTemplate } from '@/types/fees';
import { notifications } from '@mantine/notifications';
import { useSubscriptionFeatures } from '@/hooks/api/useSubscription';

type MetricForm = {
  name: string;
  amountType: 'Absolute' | 'Percentage';
  amount: number;
};

function FeeSettingsContent() {
  const t = useTranslations('fees');
  const [opened, setOpened] = useState(false);

  const { data: templates, isLoading, error } = useFeeTemplates();
  const createMutation = useCreateFeeTemplate();
  const deleteMutation = useDeleteFeeTemplate();

  const challanSettingsQuery = useFeeChallanSettings();
  const upsertChallanSettings = useUpsertFeeChallanSettings();

  const challanForm = useForm({
    initialValues: {
      bankName: '',
      accountTitle: '',
      accountNumber: '',
      bankBranchCode: '',
      paymentInstructions: '',
      footerText: '',
    },
  });

  useEffect(() => {
    const s = challanSettingsQuery.data;
    if (!s) return;
    challanForm.setValues({
      bankName: s.bankName ?? '',
      accountTitle: s.accountTitle ?? '',
      accountNumber: s.accountNumber ?? '',
      bankBranchCode: s.bankBranchCode ?? '',
      paymentInstructions: s.paymentInstructions ?? '',
      footerText: s.footerText ?? '',
    });
    challanForm.resetDirty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challanSettingsQuery.data]);

  const form = useForm({
    initialValues: {
      name: '',
      type: 'Fee' as 'Fee' | 'Discount',
      scope: 'Levels' as 'Levels' | 'Class' | 'Class-Section' | 'Individual',
      daysUntilDue: 30,
      autoApply: false,
      metrics: [{ name: '', amountType: 'Absolute' as const, amount: 0 }] as MetricForm[],
    },
    validate: {
      name: (v) => (!v.trim() ? t('validation.nameRequired') : null),
      daysUntilDue: (v) => (v < 1 || v > 365 ? t('validation.daysUntilDueRange') : null),
      metrics: {
        name: (v) => (!v.trim() ? t('validation.metricNameRequired') : null),
        amount: (v) => (v <= 0 ? t('validation.metricAmountPositive') : null),
      },
    },
  });

  const total = useMemo(() => form.values.metrics.reduce((s, m) => s + (Number(m.amount) || 0), 0), [form.values.metrics]);

  const rows = (templates ?? []) as FeeTemplate[];

  return (
    <>
      <div className="page-title-bar">
        <Title order={1}>{t('settings.title')}</Title>
        <Group>
          <Button id="fees-create-template" leftSection={<IconPlus size={16} />} onClick={() => setOpened(true)}>
            {t('settings.createTemplate')}
          </Button>
        </Group>
      </div>

      <div style={{ marginTop: '60px', padding: 'var(--mantine-spacing-md)' }}>
        <Paper withBorder radius="md" p="md" mb="md">
          <Stack gap="sm">
            <Group justify="space-between" wrap="wrap">
              <Stack gap={2}>
                <Text fw={700}>{t('settings.challanSettings.title')}</Text>
                <Text size="sm" c="dimmed">
                  {t('settings.challanSettings.description')}
                </Text>
              </Stack>
              <Button
                id="fees-challan-settings-save"
                onClick={async () => {
                  try {
                    await upsertChallanSettings.mutateAsync({
                      bankName: challanForm.values.bankName.trim() || null,
                      accountTitle: challanForm.values.accountTitle.trim() || null,
                      accountNumber: challanForm.values.accountNumber.trim() || null,
                      bankBranchCode: challanForm.values.bankBranchCode.trim() || null,
                      paymentInstructions: challanForm.values.paymentInstructions.trim() || null,
                      footerText: challanForm.values.footerText.trim() || null,
                    });
                    notifications.show({ title: t('common.success'), message: t('settings.challanSettings.saved'), color: 'green' });
                    challanForm.resetDirty();
                  } catch (e) {
                    notifications.show({
                      title: t('settings.challanSettings.saveErrorTitle'),
                      message: e instanceof Error ? e.message : t('settings.challanSettings.saveErrorMessage'),
                      color: 'red',
                    });
                  }
                }}
                loading={upsertChallanSettings.isPending}
                disabled={upsertChallanSettings.isPending || !challanForm.isDirty()}
              >
                {t('common.save')}
              </Button>
            </Group>

            {challanSettingsQuery.isLoading ? (
              <Text size="sm" c="dimmed">
                {t('settings.challanSettings.loading')}
              </Text>
            ) : challanSettingsQuery.error ? (
              <Alert color="red" title={t('settings.challanSettings.loadErrorTitle')}>
                {t('settings.challanSettings.loadErrorMessage')}
              </Alert>
            ) : (
              <Stack gap="sm">
                <Group grow>
                  <TextInput
                    id="fees-challan-settings-bank-name"
                    label={t('settings.challanSettings.bankName')}
                    {...challanForm.getInputProps('bankName')}
                  />
                  <TextInput
                    id="fees-challan-settings-account-title"
                    label={t('settings.challanSettings.accountTitle')}
                    {...challanForm.getInputProps('accountTitle')}
                  />
                </Group>
                <Group grow>
                  <TextInput
                    id="fees-challan-settings-account-number"
                    label={t('settings.challanSettings.accountNumber')}
                    {...challanForm.getInputProps('accountNumber')}
                  />
                  <TextInput
                    id="fees-challan-settings-branch-code"
                    label={t('settings.challanSettings.branchCode')}
                    {...challanForm.getInputProps('bankBranchCode')}
                  />
                </Group>

                <Textarea
                  id="fees-challan-settings-payment-instructions"
                  label={t('settings.challanSettings.paymentInstructions')}
                  minRows={3}
                  autosize
                  {...challanForm.getInputProps('paymentInstructions')}
                />

                <Textarea
                  id="fees-challan-settings-footer-text"
                  label={t('settings.challanSettings.footerNoticeText')}
                  minRows={3}
                  autosize
                  {...challanForm.getInputProps('footerText')}
                />
              </Stack>
            )}
          </Stack>
        </Paper>

        {isLoading ? (
          <Text>{t('settings.loading')}</Text>
        ) : error ? (
          <Text c="red">{t('settings.errorLoading')}</Text>
        ) : rows.length === 0 ? (
          <Text>{t('settings.empty')}</Text>
        ) : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('settings.table.name')}</Table.Th>
                <Table.Th>{t('settings.table.type')}</Table.Th>
                <Table.Th>{t('settings.table.scope')}</Table.Th>
                <Table.Th>{t('settings.table.metrics')}</Table.Th>
                <Table.Th>{t('settings.table.total')}</Table.Th>
                <Table.Th>{t('settings.table.actions')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((tpl) => (
                <Table.Tr key={tpl.id}>
                  <Table.Td>{tpl.name}</Table.Td>
                  <Table.Td>
                    <Badge color={tpl.type === 'Fee' ? 'blue' : 'green'}>{tpl.type}</Badge>
                  </Table.Td>
                  <Table.Td>{tpl.scope}</Table.Td>
                  <Table.Td>{tpl.metrics.length}</Table.Td>
                  <Table.Td>{tpl.metrics.reduce((s, m) => s + Number(m.amount || 0), 0).toLocaleString()}</Table.Td>
                  <Table.Td>
                    <ActionIcon
                      id={`fees-delete-template-${tpl.id}`}
                      color="red"
                      variant="subtle"
                      onClick={() => deleteMutation.mutate(tpl.id)}
                      loading={deleteMutation.isPending}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </div>

      <Modal opened={opened} onClose={() => setOpened(false)} title={t('settings.createTemplateTitle')} size="xl">
        <form
          onSubmit={form.onSubmit(async (values) => {
            await createMutation.mutateAsync({
              name: values.name,
              type: values.type,
              scope: values.scope,
              autoApply: values.scope === 'Individual' ? values.autoApply : false,
              autoApplyCondition: values.scope === 'Individual' && values.autoApply ? { parent_has_role: 'staff' } : null,
              metrics: values.metrics.map((m, i) => ({
                name: m.name,
                amountType: m.amountType,
                amount: m.amount,
                displayOrder: i,
              })),
            });
            form.reset();
            setOpened(false);
          })}
        >
          <Stack>
            <TextInput id="fee-template-name" label={t('form.name')} required {...form.getInputProps('name')} />

            <Group grow>
              <Select
                id="fee-template-type"
                label={t('form.type')}
                data={[
                  { value: 'Fee', label: t('form.typeFee') },
                  { value: 'Discount', label: t('form.typeDiscount') },
                ]}
                required
                {...form.getInputProps('type')}
              />
              <Select
                id="fee-template-scope"
                label={t('form.scope')}
                data={[
                  { value: 'Levels', label: t('form.scopeLevels') },
                  { value: 'Class', label: t('form.scopeClass') },
                  { value: 'Class-Section', label: t('form.scopeClassSection') },
                  { value: 'Individual', label: t('form.scopeIndividual') },
                ]}
                required
                {...form.getInputProps('scope')}
              />
            </Group>

            {form.values.scope === 'Individual' ? (
              <Checkbox
                id="fee-template-auto-apply"
                label={t('form.autoApply')}
                {...form.getInputProps('autoApply', { type: 'checkbox' })}
              />
            ) : null}

            <Stack>
              <Group justify="space-between">
                <Text fw={600}>{t('form.metrics')}</Text>
                <Button
                  id="fee-template-add-metric"
                  variant="light"
                  onClick={() => form.insertListItem('metrics', { name: '', amountType: 'Absolute', amount: 0 })}
                >
                  {t('form.addMetric')}
                </Button>
              </Group>

              {form.values.metrics.map((_, i) => (
                <Group key={i} align="flex-start" wrap="nowrap">
                  <TextInput
                    id={`fee-template-metric-${i}-name`}
                    label={t('form.metricName')}
                    style={{ flex: 1 }}
                    required
                    {...form.getInputProps(`metrics.${i}.name`)}
                  />
                  <Select
                    id={`fee-template-metric-${i}-type`}
                    label={t('form.metricType')}
                    data={[
                      { value: 'Absolute', label: t('form.metricTypeAbsolute') },
                      { value: 'Percentage', label: t('form.metricTypePercentage') },
                    ]}
                    style={{ width: 160 }}
                    required
                    {...form.getInputProps(`metrics.${i}.amountType`)}
                  />
                  <NumberInput
                    id={`fee-template-metric-${i}-amount`}
                    label={t('form.metricAmount')}
                    min={0}
                    style={{ width: 160 }}
                    required
                    {...form.getInputProps(`metrics.${i}.amount`)}
                  />
                  <ActionIcon
                    id={`fee-template-metric-${i}-remove`}
                    color="red"
                    variant="subtle"
                    mt={28}
                    onClick={() => form.removeListItem('metrics', i)}
                    disabled={form.values.metrics.length === 1}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              ))}
            </Stack>

            <Text>{t('form.templateTotal', { total: total.toLocaleString() })}</Text>

            <Group justify="flex-end">
              <Button id="fee-template-cancel" variant="subtle" onClick={() => setOpened(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                id="fee-template-save"
                type="submit"
                loading={createMutation.isPending}
                disabled={createMutation.isPending}
              >
                {t('common.save')}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}

export default function FeeSettingsPage() {
  const t = useTranslations('fees');
  const router = useRouter();
  const { data: features, isLoading: featuresLoading } = useSubscriptionFeatures();

  useEffect(() => {
    if (features && !features.hasFeeManagement) {
      router.replace('/settings');
    }
  }, [features, router]);

  if (featuresLoading || !features) {
    return (
      <>
        <div className="page-title-bar">
          <Title order={1}>{t('settings.title')}</Title>
        </div>
        <div style={{ marginTop: '60px', padding: 'var(--mantine-spacing-md)' }}>
          <Stack gap="md">
            <Skeleton height={120} radius="md" />
            <Skeleton height={80} radius="md" />
            <Skeleton height={200} radius="md" />
          </Stack>
        </div>
      </>
    );
  }

  if (!features.hasFeeManagement) {
    return null;
  }

  return <FeeSettingsContent />;
}


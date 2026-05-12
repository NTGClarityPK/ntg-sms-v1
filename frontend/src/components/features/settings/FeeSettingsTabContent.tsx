'use client';

import { useTranslations } from 'next-intl';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Checkbox,
  Skeleton,
  MultiSelect,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus, IconTrash, IconCash } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { modals } from '@mantine/modals';
import {
  useCreateFeeTemplate,
  useCreateFeeTemplateAssignment,
  useDeleteFeeTemplate,
  useFeeChallanSettings,
  useFeeTemplates,
  useUpsertFeeChallanSettings,
} from '@/hooks/api/useFees';
import type { FeeTemplate } from '@/types/fees';
import { useClasses, useLevels } from '@/hooks/useCoreLookups';
import { useClassSections } from '@/hooks/useClassSections';
import { notifications } from '@mantine/notifications';

type MetricForm = {
  name: string;
  amountType: 'Absolute' | 'Percentage';
  amount: number;
  perDay: boolean;
};

export function FeeSettingsTabContent() {
  const tFees = useTranslations('fees');
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const [opened, setOpened] = useState(false);
  const [assignModal, setAssignModal] = useState<null | { templateId: string; templateName: string; templateScope: FeeTemplate['scope'] }>(null);

  const { data: templates, isLoading, error } = useFeeTemplates();
  const createMutation = useCreateFeeTemplate();
  const deleteMutation = useDeleteFeeTemplate();
  const assignMutation = useCreateFeeTemplateAssignment();

  const challanSettingsQuery = useFeeChallanSettings();
  const upsertChallanSettings = useUpsertFeeChallanSettings();

  const levelsQuery = useLevels();
  const classesQuery = useClasses();
  const classSectionsQuery = useClassSections({ page: 1, limit: 500, minimal: true, isActive: true });

  const challanForm = useForm({
    initialValues: {
      challanTemplate: 'Minimal' as 'Minimal' | 'Modern',
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
      challanTemplate: s.challanTemplate ?? 'Minimal',
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

  const assignForm = useForm({
    initialValues: {
      scopeIds: [] as string[],
    },
    validate: {
      scopeIds: (v) => (v.length === 0 ? tFees('settings.assign.validation.scopeRequired') : null),
    },
  });

  const form = useForm({
    initialValues: {
      name: '',
      type: 'Fee' as 'Fee' | 'Discount',
      scope: 'Levels' as 'Levels' | 'Class' | 'Class-Section' | 'Individual',
      currencyCode: 'PKR' as 'PKR' | 'IQD' | 'SAR' | 'USD',
      proRateType: 'Full_Month' as 'Full_Month' | 'Half_Month' | 'Daily_Pro_Rate',
      daysUntilDue: 30,
      autoApply: false,
      metrics: [{ name: '', amountType: 'Absolute' as const, amount: 0, perDay: false }] as MetricForm[],
    },
    validate: {
      name: (v) => (!v.trim() ? tFees('validation.nameRequired') : null),
      daysUntilDue: (v) => (v < 1 || v > 365 ? tFees('validation.daysUntilDueRange') : null),
      metrics: {
        name: (v) => (!v.trim() ? tFees('validation.metricNameRequired') : null),
        amount: (v, values, path) => {
          const idxStr = String(path ?? '').match(/metrics\.(\d+)\.amount/)?.[1];
          const idx = typeof idxStr === 'string' ? Number(idxStr) : NaN;
          const amountType = Number.isFinite(idx) ? values.metrics[idx]?.amountType : undefined;

          if (typeof v !== 'number' || Number.isNaN(v)) return tFees('validation.metricAmountPositive');
          if (v <= 0) return tFees('validation.metricAmountPositive');

          if (amountType === 'Percentage' && v > 100) return tFees('validation.metricPercentageMax');
          return null;
        },
      },
    },
  });

  const total = useMemo(
    () => form.values.metrics.reduce((s, m) => s + (Number(m.amount) || 0), 0),
    [form.values.metrics],
  );

  const rows = (templates ?? []) as FeeTemplate[];

  return (
    <>
      <Group gap="sm" mb="md">
        <IconCash size={18} />
        <Text fw={700}>{tFees('settings.title')}</Text>
      </Group>

      {/* Challan settings section */}
      <Paper withBorder radius="md" p="md" mb="md">
        <Stack gap="sm">
          <Group justify="space-between" wrap="wrap">
            <Stack gap={2}>
              <Text fw={700}>{tFees('settings.challanSettings.title')}</Text>
              <Text size="sm" c="dimmed">
                {tFees('settings.challanSettings.description')}
              </Text>
            </Stack>
            <Button
              id="settings-fees-challan-settings-save"
              onClick={async () => {
                try {
                  await upsertChallanSettings.mutateAsync({
                    challanTemplate: challanForm.values.challanTemplate,
                    bankName: challanForm.values.bankName.trim() || null,
                    accountTitle: challanForm.values.accountTitle.trim() || null,
                    accountNumber: challanForm.values.accountNumber.trim() || null,
                    bankBranchCode: challanForm.values.bankBranchCode.trim() || null,
                    paymentInstructions: challanForm.values.paymentInstructions.trim() || null,
                    footerText: challanForm.values.footerText.trim() || null,
                  });
                  notifications.show({
                    title: tCommon('save'),
                    message: tFees('settings.challanSettings.saved'),
                    color: 'green',
                  });
                  challanForm.resetDirty();
                } catch (e) {
                  notifications.show({
                    title: tFees('settings.challanSettings.saveErrorTitle'),
                    message: e instanceof Error ? e.message : tFees('settings.challanSettings.saveErrorMessage'),
                    color: 'red',
                  });
                }
              }}
              loading={upsertChallanSettings.isPending}
              disabled={
                upsertChallanSettings.isPending ||
                challanSettingsQuery.isLoading ||
                !challanForm.isDirty()
              }
            >
              {tCommon('save')}
            </Button>
          </Group>

          {challanSettingsQuery.error ? (
            <Alert color="red" title={tFees('settings.challanSettings.loadErrorTitle')}>
              {tFees('settings.challanSettings.loadErrorMessage')}
            </Alert>
          ) : null}

          <Stack gap="sm">
            <Select
              id="settings-fees-challan-settings-template"
              label={tFees('settings.challanSettings.templateLabel')}
              description={tFees('settings.challanSettings.templateDescription')}
              disabled={challanSettingsQuery.isLoading || upsertChallanSettings.isPending}
              data={[
                { value: 'Minimal', label: tFees('settings.challanSettings.templateMinimal') },
                { value: 'Modern', label: tFees('settings.challanSettings.templateModern') },
              ]}
              {...challanForm.getInputProps('challanTemplate')}
            />

            <Skeleton visible={challanSettingsQuery.isLoading}>
              <Group grow>
                <TextInput
                  id="settings-fees-challan-settings-bank-name"
                  label={tFees('settings.challanSettings.bankName')}
                  disabled={challanSettingsQuery.isLoading || upsertChallanSettings.isPending}
                  {...challanForm.getInputProps('bankName')}
                />
                <TextInput
                  id="settings-fees-challan-settings-account-title"
                  label={tFees('settings.challanSettings.accountTitle')}
                  disabled={challanSettingsQuery.isLoading || upsertChallanSettings.isPending}
                  {...challanForm.getInputProps('accountTitle')}
                />
              </Group>
            </Skeleton>

            <Skeleton visible={challanSettingsQuery.isLoading}>
              <Group grow>
                <TextInput
                  id="settings-fees-challan-settings-account-number"
                  label={tFees('settings.challanSettings.accountNumber')}
                  disabled={challanSettingsQuery.isLoading || upsertChallanSettings.isPending}
                  {...challanForm.getInputProps('accountNumber')}
                />
                <TextInput
                  id="settings-fees-challan-settings-branch-code"
                  label={tFees('settings.challanSettings.branchCode')}
                  disabled={challanSettingsQuery.isLoading || upsertChallanSettings.isPending}
                  {...challanForm.getInputProps('bankBranchCode')}
                />
              </Group>
            </Skeleton>

            <Skeleton visible={challanSettingsQuery.isLoading}>
              <Textarea
                id="settings-fees-challan-settings-payment-instructions"
                label={tFees('settings.challanSettings.paymentInstructions')}
                minRows={3}
                autosize
                disabled={challanSettingsQuery.isLoading || upsertChallanSettings.isPending}
                {...challanForm.getInputProps('paymentInstructions')}
              />
            </Skeleton>

            <Skeleton visible={challanSettingsQuery.isLoading}>
              <Textarea
                id="settings-fees-challan-settings-footer-text"
                label={tFees('settings.challanSettings.footerNoticeText')}
                minRows={3}
                autosize
                disabled={challanSettingsQuery.isLoading || upsertChallanSettings.isPending}
                {...challanForm.getInputProps('footerText')}
              />
            </Skeleton>
          </Stack>
        </Stack>
      </Paper>

      {/* Fee templates section */}
      <Paper withBorder radius="md" p={0}>
        <Group justify="space-between" p="md" wrap="wrap">
          <Stack gap={2}>
            <Text fw={700}>{tFees('settings.templates.title')}</Text>
            <Text size="sm" c="dimmed">
              {tFees('settings.templates.description')}
            </Text>
          </Stack>
          <Button
            id="settings-fees-create-template"
            leftSection={<IconPlus size={16} />}
            onClick={() => setOpened(true)}
            disabled={createMutation.isPending}
          >
            {tFees('settings.createTemplate')}
          </Button>
        </Group>

        {isLoading ? (
          <Stack gap="sm" p="md">
            <Skeleton height={24} width="30%" />
            <Skeleton height={44} />
            <Skeleton height={44} />
            <Skeleton height={44} />
            <Skeleton height={44} />
            <Skeleton height={44} />
          </Stack>
        ) : error ? (
          <Text c="red" p="md">
            {tFees('settings.errorLoading')}
          </Text>
        ) : rows.length === 0 ? (
          <Text p="md">{tFees('settings.empty')}</Text>
        ) : (
          <Table.ScrollContainer minWidth={920}>
            <Table
              highlightOnHover
              striped
              verticalSpacing="sm"
              horizontalSpacing="md"
              style={{ tableLayout: 'fixed' }}
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: '32%' }}>{tFees('settings.table.name')}</Table.Th>
                  <Table.Th style={{ width: 110, whiteSpace: 'nowrap', textAlign: 'center' }}>
                    {tFees('settings.table.type')}
                  </Table.Th>
                  <Table.Th style={{ width: 140, whiteSpace: 'nowrap', textAlign: 'center' }}>
                    {tFees('settings.table.scope')}
                  </Table.Th>
                  <Table.Th style={{ width: 90, whiteSpace: 'nowrap', textAlign: 'center' }}>
                    {tFees('settings.table.metrics')}
                  </Table.Th>
                  <Table.Th style={{ width: 120, whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {tFees('settings.table.total')}
                  </Table.Th>
                  <Table.Th>{tFees('settings.table.assigned')}</Table.Th>
                  <Table.Th style={{ width: 140, whiteSpace: 'nowrap', textAlign: 'center' }}>
                    {tFees('settings.table.actions')}
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((tpl) => {
                  const assignedLabels = (tpl.assignments ?? []).map((a) => {
                    if (a.scopeType === 'Level') {
                      return levelsQuery.data?.data?.find((l) => l.id === a.scopeId)?.name ?? tFees('settings.assign.unknown');
                    }
                    if (a.scopeType === 'Class') {
                      const c = classesQuery.data?.data?.find((x) => x.id === a.scopeId);
                      return c?.displayName ?? c?.name ?? tFees('settings.assign.unknown');
                    }
                    const cs = classSectionsQuery.data?.data?.find((x) => x.id === a.scopeId);
                    return cs
                      ? `${cs.classDisplayName ?? cs.className ?? ''}-${cs.sectionName ?? ''}`.replace('--', '-').trim()
                      : tFees('settings.assign.unknown');
                  });

                  return (
                    <Table.Tr key={tpl.id}>
                      <Table.Td>
                        <Text fw={600} size="sm" lineClamp={2}>
                          {tpl.name}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        <Badge size="sm" variant="light" color={tpl.type === 'Fee' ? 'blue' : 'green'}>
                          {tpl.type}
                        </Badge>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        <Badge size="sm" variant="light" color="gray">
                          {tpl.scope}
                        </Badge>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        <Text size="sm">{tpl.metrics.length}</Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="sm">
                          {new Intl.NumberFormat(undefined, {
                            style: 'currency',
                            currency: tpl.currencyCode ?? 'PKR',
                          }).format(tpl.metrics.reduce((s, m) => s + Number(m.amount || 0), 0))}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {assignedLabels.length === 0 ? (
                          <Text size="sm" c="dimmed">
                            —
                          </Text>
                        ) : (
                          <Group gap={6} wrap="wrap">
                            {assignedLabels.map((label, idx) => (
                              <Badge key={`${tpl.id}-assigned-${idx}`} size="sm" variant="light">
                                {label}
                              </Badge>
                            ))}
                          </Group>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Group justify="flex-end" gap="xs" wrap="nowrap">
                          <Button
                            id={`settings-fees-assign-template-${tpl.id}`}
                            size="xs"
                            variant="light"
                            onClick={() => {
                              setAssignModal({ templateId: tpl.id, templateName: tpl.name, templateScope: tpl.scope });
                              // Preselect existing assignments so user can remove chips
                              assignForm.setValues({ scopeIds: (tpl.assignments ?? []).map((a) => a.scopeId) });
                              assignForm.resetDirty();
                            }}
                          >
                            {tFees('settings.assign.action')}
                          </Button>
                          <ActionIcon
                            id={`settings-fees-delete-template-${tpl.id}`}
                            color="red"
                            variant="subtle"
                            onClick={() => {
                              modals.openConfirmModal({
                                title: tFees('settings.templates.deleteTitle'),
                                centered: true,
                                children: (
                                  <Text size="sm">
                                    {tFees('settings.templates.deleteMessage', { name: tpl.name })}
                                  </Text>
                                ),
                                labels: { confirm: tCommon('delete'), cancel: tCommon('cancel') },
                                confirmProps: {
                                  color: 'red',
                                  id: `fees-template-delete-confirm-${tpl.id}`,
                                  loading: deleteMutation.isPending,
                                  disabled: deleteMutation.isPending,
                                },
                                cancelProps: { id: `fees-template-delete-cancel-${tpl.id}` },
                                onConfirm: async () => {
                                  try {
                                    await deleteMutation.mutateAsync(tpl.id);
                                    notifications.show({
                                      title: tCommon('success'),
                                      message: tFees('settings.templates.deleted'),
                                      color: 'green',
                                    });
                                  } catch (e: unknown) {
                                    notifications.show({
                                      title: tCommon('error'),
                                      message: e instanceof Error ? e.message : tCommon('errors.generic'),
                                      color: 'red',
                                    });
                                  }
                                },
                              });
                            }}
                            loading={deleteMutation.isPending}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      <Modal
        opened={!!assignModal}
        onClose={() => setAssignModal(null)}
        title={tFees('settings.assign.title', { name: assignModal?.templateName ?? '' })}
        size="lg"
      >
        <form
          onSubmit={assignForm.onSubmit(async (values) => {
            if (!assignModal) return;

            const scopeType: 'Level' | 'Class' | 'Section' =
              assignModal.templateScope === 'Levels'
                ? 'Level'
                : assignModal.templateScope === 'Class'
                  ? 'Class'
                  : 'Section'; // Class-Section → store class_section_id in scope_id

            try {
              await Promise.all(
                values.scopeIds.map((scopeId) =>
                  assignMutation.mutateAsync({
                    templateId: assignModal.templateId,
                    scopeType,
                    scopeId,
                  }),
                ),
              );
              notifications.show({
                title: tFees('settings.assign.successTitle'),
                message: tFees('settings.assign.successMessage'),
                color: 'green',
              });
              setAssignModal(null);
            } catch (error) {
              notifications.show({
                title: tFees('settings.assign.errorTitle'),
                message: error instanceof Error ? error.message : tFees('settings.assign.errorMessage'),
                color: 'red',
              });
            }
          })}
        >
          <Stack>
            <Text c="dimmed">{tFees('settings.assign.help')}</Text>

            <MultiSelect
              id="settings-fees-assign-scope"
              label={tFees('settings.assign.scopeLabel')}
              placeholder={tFees('settings.assign.scopePlaceholder')}
              searchable
              data={
                assignModal?.templateScope === 'Levels'
                  ? (levelsQuery.data?.data ?? []).map((l) => ({ value: l.id, label: l.name }))
                  : assignModal?.templateScope === 'Class'
                    ? (classesQuery.data?.data ?? []).map((c) => ({ value: c.id, label: c.displayName ?? c.name }))
                    : (classSectionsQuery.data?.data ?? []).map((cs) => ({
                        value: cs.id,
                        label: `${cs.classDisplayName ?? cs.className ?? ''}-${cs.sectionName ?? ''}`.replace('--', '-').trim(),
                      }))
              }
              nothingFoundMessage={tFees('settings.assign.nothingFound')}
              disabled={assignMutation.isPending}
              {...assignForm.getInputProps('scopeIds')}
            />

            <Group justify="flex-end">
              <Button id="settings-fees-assign-cancel" variant="subtle" onClick={() => setAssignModal(null)}>
                {tCommon('cancel')}
              </Button>
              <Button
                id="settings-fees-assign-save"
                type="submit"
                loading={assignMutation.isPending}
                disabled={assignMutation.isPending}
              >
                {tFees('settings.assign.save')}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={opened} onClose={() => setOpened(false)} title={tFees('settings.createTemplateTitle')} size="xl">
        <form
          onSubmit={form.onSubmit(async (values) => {
            await createMutation.mutateAsync({
              name: values.name,
              type: values.type,
              scope: values.scope,
              currencyCode: values.currencyCode,
              proRateType: values.proRateType,
              autoApply: values.scope === 'Individual' ? values.autoApply : false,
              autoApplyCondition: values.scope === 'Individual' && values.autoApply ? { parent_has_role: 'staff' } : null,
              metrics: values.metrics.map((m, i) => ({
                name: m.name,
                amountType: m.amountType,
                amount: m.amount,
                perDay: values.proRateType === 'Daily_Pro_Rate' ? m.perDay : false,
                displayOrder: i,
              })),
            });
            form.reset();
            setOpened(false);
          })}
        >
          <Stack>
            <TextInput id="settings-fees-template-name" label={tFees('form.name')} required {...form.getInputProps('name')} />

            <Group grow>
              <Select
                id="settings-fees-template-type"
                label={tFees('form.type')}
                data={[
                  { value: 'Fee', label: tFees('form.typeFee') },
                  { value: 'Discount', label: tFees('form.typeDiscount') },
                ]}
                required
                {...form.getInputProps('type')}
              />
              <Select
                id="settings-fees-template-scope"
                label={tFees('form.scope')}
                data={[
                  { value: 'Levels', label: tFees('form.scopeLevels') },
                  { value: 'Class', label: tFees('form.scopeClass') },
                  { value: 'Class-Section', label: tFees('form.scopeClassSection') },
                  { value: 'Individual', label: tFees('form.scopeIndividual') },
                ]}
                required
                {...form.getInputProps('scope')}
              />
            </Group>

            <Select
              id="settings-fees-template-currency"
              label={tFees('form.currency')}
              description={tFees('form.currencyDescription')}
              data={[
                { value: 'PKR', label: tFees('form.currencyPKR') },
                { value: 'IQD', label: tFees('form.currencyIQD') },
                { value: 'SAR', label: tFees('form.currencySAR') },
                { value: 'USD', label: tFees('form.currencyUSD') },
              ]}
              required
              {...form.getInputProps('currencyCode')}
            />

            <Group grow>
              <Select
                id="settings-fees-template-pro-rate"
                label={tFees('form.proRateType')}
                data={[
                  { value: 'Full_Month', label: tFees('form.proRateFull') },
                  { value: 'Daily_Pro_Rate', label: tFees('form.proRateDaily') },
                ]}
                required
                {...form.getInputProps('proRateType')}
                disabled={form.values.scope !== 'Individual'}
              />
            </Group>

            {form.values.scope === 'Individual' ? (
              <Checkbox
                id="settings-fees-template-auto-apply"
                label={tFees('form.autoApply')}
                {...form.getInputProps('autoApply', { type: 'checkbox' })}
              />
            ) : null}

            <Stack>
              <Group justify="space-between">
                <Text fw={600}>{tFees('form.metrics')}</Text>
                <Button
                  id="settings-fees-template-add-metric"
                  variant="light"
                  onClick={() =>
                    form.insertListItem('metrics', {
                      name: '',
                      amountType: 'Absolute',
                      amount: 0,
                      perDay: false,
                    })
                  }
                >
                  {tFees('form.addMetric')}
                </Button>
              </Group>

              {form.values.metrics.map((_, i) => (
                <Group key={i} align="flex-start" wrap="nowrap">
                  <TextInput
                    id={`settings-fees-template-metric-${i}-name`}
                    label={tFees('form.metricName')}
                    style={{ flex: 1 }}
                    required
                    {...form.getInputProps(`metrics.${i}.name`)}
                  />
                  <Select
                    id={`settings-fees-template-metric-${i}-type`}
                    label={tFees('form.metricType')}
                    data={[
                      { value: 'Absolute', label: tFees('form.metricTypeAbsolute') },
                      { value: 'Percentage', label: tFees('form.metricTypePercentage') },
                    ]}
                    style={{ width: 160 }}
                    required
                    {...form.getInputProps(`metrics.${i}.amountType`)}
                  />
                  <NumberInput
                    id={`settings-fees-template-metric-${i}-amount`}
                    label={
                      form.values.metrics[i]?.amountType === 'Percentage'
                        ? tFees('form.metricAmountPercentage')
                        : tFees('form.metricAmount')
                    }
                    min={0}
                    max={form.values.metrics[i]?.amountType === 'Percentage' ? 100 : undefined}
                    style={{ width: 160 }}
                    required
                    rightSection={form.values.metrics[i]?.amountType === 'Percentage' ? '%' : undefined}
                    rightSectionWidth={form.values.metrics[i]?.amountType === 'Percentage' ? 22 : undefined}
                    {...form.getInputProps(`metrics.${i}.amount`)}
                  />
                  {form.values.proRateType === 'Daily_Pro_Rate' ? (
                    <Checkbox
                      id={`settings-fees-template-metric-${i}-per-day`}
                      label={tFees('form.perDay')}
                      mt={28}
                      {...form.getInputProps(`metrics.${i}.perDay`, { type: 'checkbox' })}
                    />
                  ) : null}
                  <ActionIcon
                    id={`settings-fees-template-metric-${i}-remove`}
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

            <Group justify="flex-end">
              <Button id="settings-fees-cancel" variant="subtle" onClick={() => setOpened(false)}>
                {tCommon('cancel')}
              </Button>
              <Button id="settings-fees-save" type="submit" loading={createMutation.isPending} disabled={createMutation.isPending}>
                {tFees('common.save')}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}


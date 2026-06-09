'use client';

import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Group,
  List,
  Paper,
  PasswordInput,
  SegmentedControl,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle, IconDownload } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { useCreateDataExport, useDataExportStatus } from '@/hooks/useDataExport';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { parseApiErrorMessage } from '@/lib/parse-api-error';
import type { DataExportScope } from '@/types/data-export';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DataExportTabContent() {
  const t = useTranslations('settings.dataExport');
  const colors = useThemeColors();
  const statusQuery = useDataExportStatus();
  const exportMutation = useCreateDataExport();
  const [step, setStep] = useState(0);

  const schema = useMemo(
    () =>
      z
        .object({
          acknowledgedWarning: z.literal(true, {
            errorMap: () => ({ message: t('warningAckRequired') }),
          }),
          scope: z.enum(['tenant', 'branch']),
          accountPassword: z.string().min(1, t('accountPasswordRequired')),
          backupPassword: z
            .string()
            .min(12, t('backupPasswordMin'))
            .regex(
              /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/,
              t('backupPasswordComplexity'),
            ),
          confirmBackupPassword: z.string().min(12),
        })
        .refine((v) => v.backupPassword === v.confirmBackupPassword, {
          message: t('backupPasswordMismatch'),
          path: ['confirmBackupPassword'],
        }),
    [t],
  );

  const form = useForm({
    initialValues: {
      acknowledgedWarning: false,
      scope: 'tenant' as DataExportScope,
      accountPassword: '',
      backupPassword: '',
      confirmBackupPassword: '',
    },
    validate: zodResolver(schema),
  });

  const status = statusQuery.data;
  const canExport = status?.canExport ?? true;
  const isExporting = exportMutation.isPending;

  const handleExport = form.onSubmit(async (values) => {
    if (!canExport) {
      notifications.show({ message: t('rateLimitMessage'), color: 'orange' });
      return;
    }
    try {
      const { blob, filename } = await exportMutation.mutateAsync({
        accountPassword: values.accountPassword,
        backupPassword: values.backupPassword,
        confirmBackupPassword: values.confirmBackupPassword,
        scope: values.scope,
        acknowledgedWarning: true,
      });
      downloadBlob(blob, filename ?? 'alma-backup.zip');
      notifications.show({ message: t('exportSuccess'), color: 'green' });
      form.setFieldValue('accountPassword', '');
      form.setFieldValue('backupPassword', '');
      form.setFieldValue('confirmBackupPassword', '');
      setStep(0);
    } catch (err: unknown) {
      const { message, code, status } = await parseApiErrorMessage(err);
      if (status === 429) {
        notifications.show({ message: t('rateLimitMessage'), color: 'orange' });
        void statusQuery.refetch();
        return;
      }
      if (code === 'EXPORT_REAUTH_NOT_CONFIGURED') {
        notifications.show({
          message: message ?? t('reauthNotConfigured'),
          color: 'red',
        });
        return;
      }
      if (code === 'EXPORT_REAUTH_OAUTH_ONLY') {
        notifications.show({ message: message ?? t('oauthNoPassword'), color: 'red' });
        return;
      }
      if (status === 401 || code === 'INVALID_ACCOUNT_PASSWORD') {
        notifications.show({
          message: message ?? t('invalidAccountPassword'),
          color: 'red',
        });
        return;
      }
      notifications.show({ message: message ?? t('exportFailed'), color: 'red' });
    }
  });

  if (statusQuery.isLoading) {
    return (
      <Paper p="md" withBorder>
        <Text size="sm" c="dimmed">
          {t('loadingStatus')}
        </Text>
      </Paper>
    );
  }

  if (statusQuery.isError) {
    return (
      <Alert color={colors.error} title={t('statusErrorTitle')}>
        <Text size="sm">{t('statusErrorMessage')}</Text>
      </Alert>
    );
  }

  return (
    <Paper p="md" withBorder>
      <Stack gap="md">
        <div>
          <Title order={4}>{t('title')}</Title>
          <Text size="sm" c="dimmed" mt="xs">
            {t('description')}
          </Text>
        </div>

        {!canExport && status?.nextAvailableAt && (
          <Alert color="orange" icon={<IconAlertTriangle size={16} />} title={t('rateLimitTitle')}>
            <Text size="sm">
              {t('rateLimitMessage')}{' '}
              {new Date(status.nextAvailableAt).toLocaleString()}
            </Text>
          </Alert>
        )}

        {status?.lastExportAt && (
          <Text size="sm" c="dimmed">
            {t('lastExport', {
              date: new Date(status.lastExportAt).toLocaleString(),
              scope: status.lastScope ? t(`scopeLabel_${status.lastScope}`) : '—',
            })}
          </Text>
        )}

        <Alert color={colors.warning} variant="light" title={t('filesNoteTitle')}>
          <Text size="sm">{t('filesNoteBody')}</Text>
        </Alert>

        {step === 0 && (
          <Stack gap="md">
            <Alert color="red" icon={<IconAlertTriangle size={18} />} title={t('warningTitle')}>
              <List size="sm" spacing="xs">
                <List.Item>{t('warningBullet1')}</List.Item>
                <List.Item>{t('warningBullet2')}</List.Item>
                <List.Item>{t('warningBullet3')}</List.Item>
                <List.Item>{t('warningBullet4')}</List.Item>
                <List.Item>{t('warningBullet5')}</List.Item>
              </List>
            </Alert>
            <Checkbox
              id="data-export-warning-ack"
              label={t('warningAckLabel')}
              checked={form.values.acknowledgedWarning}
              onChange={(e) =>
                form.setFieldValue('acknowledgedWarning', e.currentTarget.checked)
              }
            />
            <Group justify="flex-end">
              <Button
                id="data-export-continue"
                onClick={() => {
                  if (!form.values.acknowledgedWarning) {
                    form.setFieldError('acknowledgedWarning', t('warningAckRequired'));
                    return;
                  }
                  setStep(1);
                }}
              >
                {t('continueButton')}
              </Button>
            </Group>
          </Stack>
        )}

        {step === 1 && (
          <Stack gap="md">
            <Text size="sm" fw={500}>
              {t('scopeTitle')}
            </Text>
            <SegmentedControl
              id="data-export-scope"
              value={form.values.scope}
              onChange={(v) => form.setFieldValue('scope', v as DataExportScope)}
              data={[
                { label: t('scopeTenant'), value: 'tenant' },
                { label: t('scopeBranch'), value: 'branch' },
              ]}
            />
            <Text size="xs" c="dimmed">
              {form.values.scope === 'tenant' ? t('scopeTenantHint') : t('scopeBranchHint')}
            </Text>
            <Group justify="space-between">
              <Button variant="light" onClick={() => setStep(0)}>
                {t('backButton')}
              </Button>
              <Button onClick={() => setStep(2)}>{t('continueButton')}</Button>
            </Group>
          </Stack>
        )}

        {step === 2 && (
          <form onSubmit={handleExport}>
            <Stack gap="md">
              <PasswordInput
                id="data-export-account-password"
                label={t('accountPasswordLabel')}
                description={t('accountPasswordDescription')}
                value={form.values.accountPassword}
                onChange={(e) => form.setFieldValue('accountPassword', e.currentTarget.value)}
                error={form.errors.accountPassword}
                required
              />
              <PasswordInput
                id="data-export-backup-password"
                label={t('backupPasswordLabel')}
                description={t('backupPasswordDescription')}
                value={form.values.backupPassword}
                onChange={(e) => form.setFieldValue('backupPassword', e.currentTarget.value)}
                error={form.errors.backupPassword}
                required
              />
              <PasswordInput
                id="data-export-backup-password-confirm"
                label={t('confirmBackupPasswordLabel')}
                value={form.values.confirmBackupPassword}
                onChange={(e) =>
                  form.setFieldValue('confirmBackupPassword', e.currentTarget.value)
                }
                error={form.errors.confirmBackupPassword}
                required
              />
              <Group justify="space-between">
                <Button variant="light" type="button" onClick={() => setStep(1)} disabled={isExporting}>
                  {t('backButton')}
                </Button>
                <Button
                  id="data-export-submit"
                  type="submit"
                  leftSection={isExporting ? undefined : <IconDownload size={16} />}
                  loading={!(!canExport) && isExporting}
                  disabled={!canExport || isExporting}
                  color={colors.primary}
                >
                  {t('exportButton')}
                </Button>
              </Group>
            </Stack>
          </form>
        )}
      </Stack>
    </Paper>
  );
}

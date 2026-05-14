'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Button, Group, NumberInput, Paper, Select, Skeleton, Stack, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useResultReportSettings, useUpsertResultReportSettings } from '@/hooks/useResults';

export function ResultReportsSettingsTabContent() {
  const t = useTranslations('settings');
  const settingsQuery = useResultReportSettings(true);
  const upsert = useUpsertResultReportSettings();

  const form = useForm({
    initialValues: {
      pdfVariant: 'modern' as 'minimal' | 'modern',
      progressMaxAssessments: 5,
      progressWindowDays: 14,
    },
  });

  useEffect(() => {
    const s = settingsQuery.data;
    if (!s) return;
    form.setValues({
      pdfVariant: s.pdfVariant,
      progressMaxAssessments: s.progressMaxAssessments ?? 5,
      progressWindowDays: s.progressWindowDays ?? 14,
    });
    form.resetDirty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsQuery.data]);

  if (settingsQuery.isLoading) {
    return <Skeleton height={160} radius="sm" />;
  }

  if (settingsQuery.isError) {
    return (
      <Alert color="yellow" title={t('resultReports.accessTitle')}>
        {t('resultReports.accessBody')}
      </Alert>
    );
  }

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="md">
        <Stack gap={4}>
          <Text fw={700}>{t('resultReports.title')}</Text>
          <Text size="sm" c="dimmed">
            {t('resultReports.description')}
          </Text>
        </Stack>
        <Select
          label={t('resultReports.pdfVariantLabel')}
          description={t('resultReports.pdfVariantDescription')}
          data={[
            { value: 'minimal', label: t('resultReports.pdfVariantMinimal') },
            { value: 'modern', label: t('resultReports.pdfVariantModern') },
          ]}
          {...form.getInputProps('pdfVariant')}
        />
        <Group grow>
          <NumberInput
            label={t('resultReports.progressMaxLabel')}
            description={t('resultReports.progressMaxDescription')}
            min={1}
            max={50}
            {...form.getInputProps('progressMaxAssessments')}
          />
          <NumberInput
            label={t('resultReports.progressWindowLabel')}
            description={t('resultReports.progressWindowDescription')}
            min={1}
            max={365}
            {...form.getInputProps('progressWindowDays')}
          />
        </Group>
        <Group justify="flex-end">
          <Button
            loading={upsert.isPending}
            disabled={!form.isDirty()}
            onClick={async () => {
              try {
                await upsert.mutateAsync({
                  pdfVariant: form.values.pdfVariant,
                  progressMaxAssessments: form.values.progressMaxAssessments,
                  progressWindowDays: form.values.progressWindowDays,
                });
                form.resetDirty();
                notifications.show({ title: t('resultReports.saveSuccessTitle'), message: t('resultReports.saveSuccessBody'), color: 'green' });
              } catch {
                notifications.show({ title: t('resultReports.saveErrorTitle'), message: t('resultReports.saveErrorBody'), color: 'red' });
              }
            }}
          >
            {t('resultReports.save')}
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

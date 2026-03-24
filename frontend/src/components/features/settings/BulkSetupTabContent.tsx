'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Alert,
  Badge,
  Button,
  FileInput,
  Group,
  List,
  Paper,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCheck,
  IconDownload,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import * as XLSX from 'xlsx';
import { notifications } from '@mantine/notifications';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import {
  useSettingsImportApply,
  useSettingsImportTemplate,
  useSettingsImportValidate,
} from '@/hooks/useSettingsImport';

export function BulkSetupTabContent() {
  const t = useTranslations('settings');
  const colors = useThemeColors();
  const [file, setFile] = useState<File | null>(null);
  const [validationToken, setValidationToken] = useState<string | null>(null);

  const templateQuery = useSettingsImportTemplate();
  const validateMutation = useSettingsImportValidate();
  const applyMutation = useSettingsImportApply();

  const validationResult = validateMutation.data;
  const applyResult = applyMutation.data;

  const handleDownloadTemplate = () => {
    const definition = templateQuery.data;
    if (!definition) return;

    const workbook = XLSX.utils.book_new();
    definition.sheets.forEach((sheet) => {
      const header = [sheet.columns.reduce<Record<string, string>>((acc, col) => {
        acc[col] = col;
        return acc;
      }, {})];
      const sample = [sheet.sample];
      const rows = header.concat(sample);
      const worksheet = XLSX.utils.json_to_sheet(rows, { skipHeader: true });
      XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
    });
    XLSX.writeFile(workbook, definition.workbookName);

    notifications.show({
      title: t('bulkSetupTemplateDownloadedTitle'),
      message: t('bulkSetupTemplateDownloadedMessage'),
      color: 'green',
      icon: <IconCheck size={16} />,
    });
  };

  const handleUpload = async (uploadedFile: File | null) => {
    setFile(uploadedFile);
    setValidationToken(null);
    if (!uploadedFile) {
      return;
    }

    try {
      const result = await validateMutation.mutateAsync(uploadedFile);
      if (result.validationToken) {
        setValidationToken(result.validationToken);
      }
      if (result.isValid) {
        notifications.show({
          title: t('bulkSetupValidationSuccessTitle'),
          message: t('bulkSetupValidationSuccessMessage'),
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      } else {
        notifications.show({
          title: t('bulkSetupValidationFailedTitle'),
          message: t('bulkSetupValidationFailedMessage'),
          color: 'yellow',
          icon: <IconAlertCircle size={16} />,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('bulkSetupValidationUnknownError');
      notifications.show({
        title: t('bulkSetupValidationFailedTitle'),
        message,
        color: 'red',
        icon: <IconX size={16} />,
      });
    }
  };

  const handleApply = async () => {
    if (!validationToken) {
      notifications.show({
        title: t('bulkSetupApplyMissingTokenTitle'),
        message: t('bulkSetupApplyMissingTokenMessage'),
        color: 'red',
      });
      return;
    }

    try {
      await applyMutation.mutateAsync(validationToken);
      setValidationToken(null);
      setFile(null);
      notifications.show({
        title: t('bulkSetupApplySuccessTitle'),
        message: t('bulkSetupApplySuccessMessage'),
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('bulkSetupApplyUnknownError');
      notifications.show({
        title: t('bulkSetupApplyFailedTitle'),
        message,
        color: 'red',
        icon: <IconX size={16} />,
      });
    }
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={3}>{t('bulkSetupTitle')}</Title>
          <Text size="sm" c="dimmed">
            {t('bulkSetupDescription')}
          </Text>
        </div>
        <Button
          id="settings-bulk-setup-download-template"
          variant="light"
          leftSection={<IconDownload size={16} />}
          onClick={handleDownloadTemplate}
          disabled={templateQuery.isLoading || !templateQuery.data}
        >
          {t('bulkSetupDownloadTemplate')}
        </Button>
      </Group>

      <Alert
        icon={<IconAlertCircle size={16} />}
        color={colors.info}
        title={t('bulkSetupHowToUseTitle')}
      >
        <List spacing={4} size="sm">
          <List.Item>{t('bulkSetupStep1')}</List.Item>
          <List.Item>{t('bulkSetupStep2')}</List.Item>
          <List.Item>{t('bulkSetupStep3')}</List.Item>
          <List.Item>{t('bulkSetupStep4')}</List.Item>
        </List>
      </Alert>

      <Paper withBorder p="md">
        <Stack gap="md">
          <FileInput
            id="settings-bulk-setup-file"
            label={t('bulkSetupUploadLabel')}
            placeholder={t('bulkSetupUploadPlaceholder')}
            accept=".xlsx,.xls"
            value={file}
            onChange={handleUpload}
            leftSection={<IconUpload size={16} />}
            disabled={validateMutation.isPending}
          />
          {validateMutation.isPending && <Skeleton height={8} radius="xl" />}
          {validationResult && (
            <Group justify="space-between">
              <Badge color={validationResult.isValid ? 'green' : 'red'}>
                {validationResult.isValid
                  ? t('bulkSetupStatusValid')
                  : t('bulkSetupStatusInvalid')}
              </Badge>
              <Button
                id="settings-bulk-setup-apply"
                onClick={handleApply}
                loading={applyMutation.isPending}
                disabled={!validationResult.isValid || !validationToken}
                leftSection={<IconCheck size={16} />}
              >
                {t('bulkSetupApplyButton')}
              </Button>
            </Group>
          )}
        </Stack>
      </Paper>

      {validationResult && (
        <Paper withBorder p="md">
          <Stack gap="md">
            <Title order={5}>{t('bulkSetupValidationSummaryTitle')}</Title>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('bulkSetupSummarySheet')}</Table.Th>
                  <Table.Th>{t('bulkSetupSummaryTotal')}</Table.Th>
                  <Table.Th>{t('bulkSetupSummaryValid')}</Table.Th>
                  <Table.Th>{t('bulkSetupSummaryInvalid')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {Object.entries(validationResult.summaryBySheet).map(([sheet, summary]) => (
                  <Table.Tr key={sheet}>
                    <Table.Td>{sheet}</Table.Td>
                    <Table.Td>{summary.totalRows}</Table.Td>
                    <Table.Td>{summary.validRows}</Table.Td>
                    <Table.Td>{summary.invalidRows}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            {validationResult.warnings.length > 0 && (
              <Alert color="yellow" title={t('bulkSetupWarningsTitle')}>
                <List spacing={4} size="sm">
                  {validationResult.warnings.map((warning, index) => (
                    <List.Item key={`${warning}-${index}`}>{warning}</List.Item>
                  ))}
                </List>
              </Alert>
            )}

            {validationResult.errors.length > 0 && (
              <Alert color="red" title={t('bulkSetupErrorsTitle')}>
                <List spacing={4} size="sm">
                  {validationResult.errors.map((error, index) => (
                    <List.Item key={`${error.sheet}-${error.rowNumber}-${index}`}>
                      [{error.sheet}] {t('bulkSetupRowLabel', { row: error.rowNumber })}: {error.message}
                    </List.Item>
                  ))}
                </List>
              </Alert>
            )}
          </Stack>
        </Paper>
      )}

      {applyResult && (
        <Paper withBorder p="md">
          <Stack gap="xs">
            <Title order={5}>{t('bulkSetupApplyResultTitle')}</Title>
            <Text size="sm">{t('bulkSetupApplyResultDescription')}</Text>
            <List size="sm" spacing={2}>
              {Object.entries(applyResult.created).map(([key, value]) => (
                <List.Item key={key}>
                  {key}: {value}
                </List.Item>
              ))}
            </List>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}


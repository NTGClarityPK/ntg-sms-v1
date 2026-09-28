'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  Alert,
  Badge,
  Button,
  FileInput,
  Group,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconArrowLeft,
  IconCheck,
  IconDownload,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import * as XLSX from 'xlsx';
import {
  useBulkParentAssociationsExport,
  useBulkParentAssociationsImport,
  useBulkParentAssociationsImportPreview,
  useBulkParentAssociationsImportTemplate,
  useBulkParentAssociationsImportValidate,
  type BulkParentAssociationImportPreview,
  type BulkParentAssociationImportResult,
  type BulkParentAssociationRowDto,
} from '@/hooks/useBulkImport';

function downloadBase64File(fileName: string, contentBase64: string, mimeType: string): void {
  const binary = atob(contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

type EditableKey =
  | 'username'
  | 'guardian1_email'
  | 'guardian1_name'
  | 'guardian1_relationship'
  | 'guardian2_email'
  | 'guardian2_name'
  | 'guardian2_relationship';

const PREVIEW_COLUMNS: Array<{ key: EditableKey; label: string }> = [
  { key: 'username', label: 'Username' },
  { key: 'guardian1_email', label: 'Guardian 1 Email' },
  { key: 'guardian1_name', label: 'Guardian 1 Name' },
  { key: 'guardian1_relationship', label: 'Guardian 1 Rel.' },
  { key: 'guardian2_email', label: 'Guardian 2 Email' },
  { key: 'guardian2_name', label: 'Guardian 2 Name' },
  { key: 'guardian2_relationship', label: 'Guardian 2 Rel.' },
];

export default function ParentStudentBulkImportPage() {
  const t = useTranslations('user');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BulkParentAssociationImportPreview | null>(null);
  const [lastImportResult, setLastImportResult] =
    useState<BulkParentAssociationImportResult | null>(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const previewMutation = useBulkParentAssociationsImportPreview();
  const importMutation = useBulkParentAssociationsImport();
  const validateMutation = useBulkParentAssociationsImportValidate();
  const exportMutation = useBulkParentAssociationsExport();
  const { data: templateData } = useBulkParentAssociationsImportTemplate();

  const handleFileUpload = async (uploadedFile: File | null) => {
    if (!uploadedFile) {
      setFile(null);
      setPreview(null);
      setLastImportResult(null);
      setIsValidated(false);
      setShowValidation(false);
      return;
    }
    setFile(uploadedFile);
    setPreview(null);
    setLastImportResult(null);
    setIsValidated(false);
    setShowValidation(false);
    try {
      const result = await previewMutation.mutateAsync(uploadedFile);
      setPreview(result);
      notifications.show({
        title: t('bulkFileUploaded'),
        message: t('bulkFileUploadedMessage'),
        color: 'blue',
        icon: <IconAlertCircle size={16} />,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('bulkFailedToParseFile');
      notifications.show({
        title: t('bulkUploadFailed'),
        message,
        color: 'red',
        icon: <IconX size={16} />,
      });
    }
  };

  const updateCell = (rowIndex: number, key: keyof BulkParentAssociationRowDto, value: string) => {
    setPreview((prev) => {
      if (!prev) return prev;
      const rows = prev.rows.map((row, idx) => {
        if (idx !== rowIndex) return row;
        return {
          ...row,
          data: { ...row.data, [key]: value },
          isValid: true,
          errors: [],
        };
      });
      return { ...prev, rows };
    });
    setIsValidated(false);
    setShowValidation(false);
  };

  const handleValidate = async () => {
    if (!preview) return;
    setShowValidation(true);
    try {
      const result = await validateMutation.mutateAsync(
        preview.rows.map((r) => ({ ...r.data, row_number: r.rowNumber })),
      );
      setPreview(result);
      setIsValidated(result.invalidRows === 0);
      if (result.invalidRows === 0) {
        notifications.show({
          title: t('bulkValidated'),
          message: t('bulkValidatedMessage', { count: result.totalRows }),
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      } else {
        const firstInvalid = result.rows.find((r) => !r.isValid);
        notifications.show({
          title: t('bulkValidationFailed'),
          message: t('bulkValidationFailedMessage', {
            count: result.invalidRows,
            row: firstInvalid?.rowNumber ?? 0,
            message: firstInvalid?.errors?.[0] ?? t('bulkRowHasErrors'),
          }),
          color: 'orange',
          icon: <IconAlertCircle size={16} />,
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('bulkFailedToValidate');
      notifications.show({
        title: t('bulkValidationFailed'),
        message,
        color: 'red',
        icon: <IconX size={16} />,
      });
    }
  };

  const handleImport = async () => {
    if (!preview) return;
    const rowsToImport = preview.rows.map((r) => ({
      ...r.data,
      row_number: r.rowNumber,
    }));
    if (rowsToImport.length === 0) {
      notifications.show({
        title: t('bulkNoValidRows'),
        message: t('bulkNoValidRowsMessage'),
        color: 'red',
      });
      return;
    }
    try {
      const result = await importMutation.mutateAsync(rowsToImport);
      setLastImportResult(result);
      setStatusModalOpen(true);
      setFile(null);
      setPreview(null);
      setIsValidated(false);
      setShowValidation(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t('parentAssocBulkFailedToImport');
      notifications.show({
        title: t('bulkImportFailed'),
        message,
        color: 'red',
        icon: <IconX size={16} />,
      });
    }
  };

  const handleExport = async () => {
    try {
      const exported = await exportMutation.mutateAsync();
      downloadBase64File(exported.fileName, exported.contentBase64, exported.mimeType);
      notifications.show({
        title: t('bulkExportComplete'),
        message: t('parentAssocBulkExportCompleteMessage', { count: exported.rowCount }),
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('bulkExportFailed');
      notifications.show({
        title: t('bulkExportFailed'),
        message,
        color: 'red',
        icon: <IconX size={16} />,
      });
    }
  };

  const handleDownloadTemplate = () => {
    const columns = templateData?.columns ?? [
      { key: 'username', label: 'Username', example: 'ahmed.ali' },
      { key: 'first_name', label: 'First Name', example: 'Ahmed' },
      { key: 'last_name', label: 'Last Name', example: 'Ali' },
      { key: 'student_id', label: 'Student ID', example: 'STU-001' },
      { key: 'guardian1_email', label: 'Guardian 1 Email', example: 'father@example.com' },
      { key: 'guardian1_name', label: 'Guardian 1 Name', example: 'Ali Hassan' },
      { key: 'guardian1_phone', label: 'Guardian 1 Phone', example: '+9647701234567' },
      { key: 'guardian1_relationship', label: 'Guardian 1 Relationship', example: 'father' },
      { key: 'guardian2_email', label: 'Guardian 2 Email', example: 'mother@example.com' },
      { key: 'guardian2_name', label: 'Guardian 2 Name', example: 'Sara Hassan' },
      { key: 'guardian2_phone', label: 'Guardian 2 Phone', example: '+9647707654321' },
      { key: 'guardian2_relationship', label: 'Guardian 2 Relationship', example: 'mother' },
    ];
    const header = columns.map((c) => c.label);
    const example = columns.map((c) => c.example);
    const sheet = XLSX.utils.aoa_to_sheet([header, example]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Parent-Student');
    XLSX.writeFile(workbook, 'parent-student-mapping-template.xlsx');
  };

  const importBusy = importMutation.isPending;

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%" wrap="nowrap" align="center" gap="xs">
          <Title order={1} style={{ flex: 1, minWidth: 0 }} lineClamp={1}>
            {t('parentAssocBulkImportTitle')}
          </Title>
          <Group gap="sm" style={{ flexShrink: 0 }}>
            <Button
              id="parent-assoc-bulk-back"
              component={Link}
              href="/mapping?tab=parent-student"
              variant="default"
              leftSection={<IconArrowLeft size={16} />}
            >
              {t('parentAssocBulkBackToMapping')}
            </Button>
            <Button
              id="parent-assoc-bulk-export"
              variant="light"
              leftSection={<IconDownload size={16} />}
              loading={exportMutation.isPending}
              onClick={() => void handleExport()}
            >
              {t('parentAssocBulkExport')}
            </Button>
            <Button
              id="parent-assoc-bulk-template"
              variant="light"
              leftSection={<IconDownload size={16} />}
              onClick={handleDownloadTemplate}
            >
              {t('downloadTemplate')}
            </Button>
          </Group>
        </Group>
      </div>

      <div style={{ marginTop: '60px', padding: 'var(--mantine-spacing-md)' }}>
        <Stack gap="md">
          <Alert color="blue" title={t('howToUse')}>
            <Stack gap={4}>
              <Text size="sm">1. {t('parentAssocBulkStep1')}</Text>
              <Text size="sm">2. {t('parentAssocBulkStep2')}</Text>
              <Text size="sm">3. {t('parentAssocBulkStep3')}</Text>
              <Text size="sm">4. {t('parentAssocBulkStep4')}</Text>
            </Stack>
          </Alert>

          <Paper withBorder p="md">
            <FileInput
              id="parent-assoc-bulk-file"
              label={t('uploadFileLabel')}
              placeholder={t('uploadFilePlaceholder')}
              leftSection={<IconUpload size={16} />}
              accept=".xlsx,.xls,.csv"
              value={file}
              onChange={(f) => void handleFileUpload(f)}
            />
            {previewMutation.isPending && (
              <Group mt="sm" gap="xs">
                <Loader size="sm" />
                <Text size="sm">{t('bulkValidating')}</Text>
              </Group>
            )}
          </Paper>

          {preview && (
            <Paper withBorder p="md">
              <Group justify="space-between" mb="sm" wrap="wrap">
                <Text size="sm">
                  {showValidation
                    ? t('bulkPreviewValidatedSummary', {
                        valid: preview.validRows,
                        invalid: preview.invalidRows,
                        total: preview.totalRows,
                      })
                    : t('bulkPreviewNotValidated', { total: preview.totalRows })}
                </Text>
                <Group gap="sm">
                  <Button
                    id="parent-assoc-bulk-validate"
                    variant="light"
                    loading={validateMutation.isPending}
                    onClick={() => void handleValidate()}
                  >
                    {t('validate')}
                  </Button>
                  <Button
                    id="parent-assoc-bulk-import"
                    leftSection={<IconCheck size={16} />}
                    disabled={!isValidated || preview.invalidRows > 0 || importBusy}
                    loading={importBusy}
                    onClick={() => void handleImport()}
                  >
                    {t('bulkImport')}
                  </Button>
                </Group>
              </Group>

              <ScrollArea>
                <Table striped highlightOnHover withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t('bulkColRow')}</Table.Th>
                      {PREVIEW_COLUMNS.map((col) => (
                        <Table.Th key={col.key}>{col.label}</Table.Th>
                      ))}
                      {showValidation && <Table.Th>{t('bulkColErrors')}</Table.Th>}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {preview.rows.map((row, rowIndex) => (
                      <Table.Tr key={row.rowNumber}>
                        <Table.Td>{row.rowNumber}</Table.Td>
                        {PREVIEW_COLUMNS.map((col) => (
                          <Table.Td key={col.key}>
                            <TextInput
                              id={`parent-assoc-bulk-row-${rowIndex}-${col.key}`}
                              size="xs"
                              value={String(row.data[col.key] ?? '')}
                              onChange={(e) =>
                                updateCell(rowIndex, col.key, e.currentTarget.value)
                              }
                            />
                          </Table.Td>
                        ))}
                        {showValidation && (
                          <Table.Td>
                            {row.errors.length > 0 ? (
                              <Text size="xs" c="red">
                                {row.errors.join('; ')}
                              </Text>
                            ) : (
                              <Badge size="sm" color="green">
                                {t('bulkValid')}
                              </Badge>
                            )}
                          </Table.Td>
                        )}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Paper>
          )}
        </Stack>
      </div>

      <Modal
        id="parent-assoc-bulk-status-modal"
        opened={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title={t('bulkImportStatusTitle')}
        size="lg"
      >
        {lastImportResult && (
          <Stack gap="sm">
            <Text size="sm">{t('bulkStatusAdded', { count: lastImportResult.createdCount ?? 0 })}</Text>
            <Text size="sm">
              {t('bulkStatusUpdated', { count: lastImportResult.updatedCount ?? 0 })}
            </Text>
            <Text size="sm">
              {t('bulkStatusUnchanged', { count: lastImportResult.unchangedCount ?? 0 })}
            </Text>
            <Text size="sm">
              {t('bulkStatusFailedInsert', { count: lastImportResult.failedInsertCount ?? 0 })}
            </Text>
            <Text size="sm">
              {t('bulkStatusFailedUpdate', { count: lastImportResult.failedUpdateCount ?? 0 })}
            </Text>
            {lastImportResult.resultsFile && (
              <Button
                id="parent-assoc-bulk-download-results"
                variant="light"
                leftSection={<IconDownload size={16} />}
                onClick={() => {
                  const resultsFile = lastImportResult.resultsFile;
                  if (!resultsFile) return;
                  downloadBase64File(
                    resultsFile.fileName,
                    resultsFile.contentBase64,
                    resultsFile.mimeType,
                  );
                }}
              >
                {t('bulkDownloadResultsSheet')}
              </Button>
            )}
            {(lastImportResult.rowOutcomes ?? [])
              .filter((o) => o.status === 'failed_insert' || o.status === 'failed_update')
              .slice(0, 20)
              .map((o) => (
                <Text key={`${o.row}-${o.username}`} size="xs" c="red">
                  {t('bulkCreatedRowLabel', { row: o.row, name: o.username })}: {o.reason}
                </Text>
              ))}
          </Stack>
        )}
      </Modal>
    </>
  );
}

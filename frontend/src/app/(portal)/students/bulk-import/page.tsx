'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  alpha,
  Button,
  FileInput,
  Alert,
  Table,
  Badge,
  Title,
  Text,
  Group,
  Stack,
  Paper,
  Select,
  Skeleton,
  TextInput,
  Divider,
  Loader,
  Modal,
  ScrollArea,
  ActionIcon,
  Tooltip,
  List,
  useComputedColorScheme,
  useMantineTheme,
} from '@mantine/core';
import { IconUpload, IconCheck, IconX, IconAlertCircle, IconDownload, IconQuestionMark } from '@tabler/icons-react';
import {
  useBulkImportPreview,
  useBulkImport,
  useBulkImportTemplate,
  useBulkImportValidate,
  useBulkStudentsExport,
  useSubjectTemplateHelp,
} from '@/hooks/useBulkImport';
import { useAcademicYearsList, useActiveAcademicYear } from '@/hooks/useAcademicYears';
import { notifications } from '@mantine/notifications';
import * as XLSX from 'xlsx';
import type { BulkImportPreview, BulkImportResult, BulkStudentRowDto } from '@/hooks/useBulkImport';

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

export default function BulkImportStudentsPage() {
  const t = useTranslations('students');
  const theme = useMantineTheme();
  const computedColorScheme = useComputedColorScheme();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BulkImportPreview | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [lastImportResult, setLastImportResult] = useState<BulkImportResult | null>(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const previewMutation = useBulkImportPreview();
  const importMutation = useBulkImport();
  const validateMutation = useBulkImportValidate();
  const exportMutation = useBulkStudentsExport();
  const { data: templateData } = useBulkImportTemplate();
  const { data: academicYearsResponse } = useAcademicYearsList({ page: 1, limit: 50 });
  const { data: activeAcademicYearResponse } = useActiveAcademicYear();
  const academicYears = academicYearsResponse?.data ?? [];
  const activeAcademicYear = activeAcademicYearResponse?.data ?? null;
  const subjectTemplateHelpQuery = useSubjectTemplateHelp({ enabled: helpOpen });

  useEffect(() => {
    if (!helpOpen) return;
    // Ensure help modal never shows stale template→class mappings.
    void subjectTemplateHelpQuery.refetch();
  }, [helpOpen]);

  const hasSubjectTemplateValidationIssues =
    showValidation &&
    (preview?.rows ?? []).some((r) =>
      (r.errors ?? []).some((e) => String(e).toLowerCase().includes('subject template')),
    );

  const helpTemplates = useMemo(() => {
    const tpls = subjectTemplateHelpQuery.data?.templates ?? [];
    // Avoid extra work in render; keep ordering stable.
    return tpls;
  }, [subjectTemplateHelpQuery.data]);

  useEffect(() => {
    if (!preview) return;
    if (selectedYear) return;
    if (!activeAcademicYear?.id) return;
    setSelectedYear(activeAcademicYear.id);
  }, [preview, selectedYear, activeAcademicYear?.id]);

  const handleFileUpload = async (uploadedFile: File | null) => {
    if (!uploadedFile) {
      setFile(null);
      setPreview(null);
      setSelectedYear(null);
      setLastImportResult(null);
      setIsValidated(false);
      setShowValidation(false);
      return;
    }
    setFile(uploadedFile);
    setPreview(null);
    setSelectedYear(null);
    setLastImportResult(null);
    setIsValidated(false);
    setShowValidation(false);
    try {
      const result = await previewMutation.mutateAsync(uploadedFile);
      setPreview(result);
      notifications.show({
        title: 'File uploaded',
        message: 'Edit any cells if needed, then press Validate.',
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

  const handleImport = async () => {
    if (!preview || !selectedYear) {
      notifications.show({
        title: t('bulkMissingInformation'),
        message: t('bulkPleaseSelectAcademicYear'),
        color: 'red',
      });
      return;
    }
    // Send all rows (including prior Import Status) so the backend can skip added/updated.
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
      const result = await importMutation.mutateAsync({
        rows: rowsToImport,
        academicYearId: selectedYear,
      });
      setLastImportResult(result);
      setStatusModalOpen(true);
      setFile(null);
      setPreview(null);
      setSelectedYear(null);
      setIsValidated(false);
      setShowValidation(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('bulkFailedToImportStudents');
      notifications.show({
        title: t('bulkImportFailed'),
        message,
        color: 'red',
        icon: <IconX size={16} />,
      });
    }
  };

  const handleExportStudents = async () => {
    try {
      const file = await exportMutation.mutateAsync(selectedYear ?? activeAcademicYear?.id);
      downloadBase64File(file.fileName, file.contentBase64, file.mimeType);
      notifications.show({
        title: t('bulkExportComplete'),
        message: t('bulkExportCompleteMessage', { count: file.rowCount }),
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

  const handleDownloadResultsFile = () => {
    const resultsFile = lastImportResult?.resultsFile;
    if (!resultsFile) return;
    downloadBase64File(
      resultsFile.fileName,
      resultsFile.contentBase64,
      resultsFile.mimeType,
    );
  };

  const handleDownloadTemplate = () => {
    const columns = templateData?.columns ?? [
      { key: 'username', label: 'Username', example: 'ahmedali' },
      { key: 'first_name', label: 'First Name', example: 'Ahmed' },
      { key: 'last_name', label: 'Last Name', example: 'Ali' },
      { key: 'gender', label: 'Gender', example: 'male' },
      { key: 'invitation_type', label: 'Invitation Type', example: 'student' },
      {
        key: 'invitation_recipient_email',
        label: 'Invitation Recipient Email (optional)',
        example: 'parent.personal@example.com',
      },
      { key: 'phone', label: 'Phone (optional)', example: '+9647701234567' },
      { key: 'address', label: 'Address (optional)', example: 'Baghdad' },
      { key: 'date_of_birth', label: 'Date of Birth (optional)', example: '2010-05-15' },
      { key: 'blood_group', label: 'Blood Group (optional)', example: 'O+' },
      { key: 'medical_notes', label: 'Medical Notes (optional)', example: 'None' },
      { key: 'admission_date', label: 'Admission Date (optional)', example: '2025-09-01' },
      {
        key: 'google_account_email',
        label: 'Google Account Email (optional)',
        example: 'ahmed.ali@gmail.com',
      },
      { key: 'class_section', label: 'Class-Section (optional)', example: 'Grade 1 - A' },
      {
        key: 'subject_template_name_or_id',
        label: 'Subject Template name or ID (optional)',
        example: 'Primary Curriculum',
      },
      { key: 'create_parent_account', label: 'Create Parent Account', example: 'no' },
      { key: 'parent_email', label: 'Parent Email (for new parent account)', example: 'parent@example.com' },
      { key: 'parent_name', label: 'Parent Name (optional)', example: 'Ali Ahmed' },
      { key: 'parent_phone', label: 'Parent Phone (optional)', example: '+9647709876543' },
      { key: 'parent_relationship', label: 'Parent Relationship (optional)', example: 'guardian' },
    ];
    const sampleRow: Record<string, string> = {};
    columns.forEach((col) => {
      sampleRow[col.label] = col.example;
    });
    const ws = XLSX.utils.json_to_sheet([sampleRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, 'students-import-template.xlsx');
    notifications.show({
      title: t('bulkTemplateDownloaded'),
      message: t('bulkTemplateDownloadedMessage'),
      color: 'green',
      icon: <IconCheck size={16} />,
    });
  };

  const recomputePreviewCounts = (rows: BulkImportPreview['rows']) => {
    const validRows = rows.filter((r) => r.isValid).length;
    return {
      validRows,
      invalidRows: rows.length - validRows,
    };
  };

  const clearPlacementErrorsOnEdit = (
    errors: string[],
    field: keyof BulkStudentRowDto,
    nextValue: string,
  ): string[] => {
    // These errors are produced by backend placement lookups. When user edits the cell,
    // clear the corresponding message immediately so the row UI reflects the new state.
    // Import still re-validates on the backend, so incorrect values will be caught there.
    const lower = errors.map((e) => String(e).toLowerCase());
    return errors.filter((e, idx) => {
      const s = lower[idx] ?? '';

      const isClassNotFound = s.startsWith('class ') && s.includes('not found');
      const isSectionNotFound = s.startsWith('section ') && s.includes('not found');
      const isTemplateAny = s.includes('subject template');
      const isTemplateLinking =
        s.includes('subject template') &&
        (s.includes('not linked') || s.includes('requires a valid class'));

      if (field === 'class_name_or_id') {
        // Changing class can fix class-not-found or template-linking errors.
        // But if user entered another value, we don't know it's valid until Validate is pressed.
        // Only clear if the cell is blanked (class is optional).
        if (nextValue.trim() === '') return !(isClassNotFound || isTemplateLinking);
        return true;
      }
      if (field === 'section_name_or_id') {
        // Only clear if blanked (section is optional).
        if (nextValue.trim() === '') return !isSectionNotFound;
        return true;
      }
      if (field === 'subject_template_name_or_id') {
        // Changing template can fix template-not-found or template-linking errors.
        // Only clear if blanked (template is optional). Otherwise keep the error until Validate re-checks.
        if (nextValue.trim() === '') return !(isTemplateAny || isTemplateLinking);
        return true;
      }
      return true;
    });
  };

  const updatePreviewRow = useCallback(
    (rowIndex: number, field: keyof BulkStudentRowDto, value: string | undefined) => {
      setPreview((prev) => {
        if (!prev) return prev;
        const patch: Partial<BulkStudentRowDto> =
          field === 'invitation_type'
            ? { invitation_type: (value === 'parent' ? 'parent' : 'student') }
            : { [field]: value ?? '' } as Partial<BulkStudentRowDto>;
        const nextRows = prev.rows.map((r, i) => {
          if (i !== rowIndex) return r;
          const nextData = { ...r.data, ...patch };
          const nextValue =
            typeof value === 'string' ? value : value == null ? '' : String(value);
          const nextErrors =
            field === 'class_name_or_id' ||
            field === 'section_name_or_id' ||
            field === 'subject_template_name_or_id'
              ? clearPlacementErrorsOnEdit(r.errors, field, nextValue)
              : r.errors;
          return {
            ...r,
            data: nextData,
            errors: nextErrors,
            isValid: nextErrors.length === 0,
          };
        });

        const counts = recomputePreviewCounts(nextRows);

        return {
          ...prev,
          ...counts,
          rows: nextRows,
        };
      });
      setIsValidated(false);
      setShowValidation(false);
    },
    []
  );

  const editableValidCount =
    preview?.rows.filter((r) => r.isValid).length ?? 0;

  const handleCancelImport = () => {
    setFile(null);
    setPreview(null);
    setSelectedYear(null);
    setIsValidated(false);
    setShowValidation(false);
  };

  const handleValidate = () => {
    void (async () => {
      if (!preview) return;
      setShowValidation(true);
      setIsValidated(false);
      try {
        const payloadRows = preview.rows.map((r) => ({
          ...r.data,
          row_number: r.rowNumber,
        }));
        const result = await validateMutation.mutateAsync(payloadRows);
        setPreview(result);

        if (result.invalidRows === 0) {
          setIsValidated(true);
          notifications.show({
            title: 'Validated',
            message: `All ${result.totalRows} rows are valid. You can import now.`,
            color: 'green',
            icon: <IconCheck size={16} />,
          });
          return;
        }

        const firstInvalid = result.rows.find((r) => !r.isValid);
        const firstMsg = firstInvalid?.errors?.[0] ?? 'Row has errors';
        notifications.show({
          title: 'Validation failed',
          message: `Fix ${result.invalidRows} row(s). First issue: Row ${firstInvalid?.rowNumber ?? ''} — ${firstMsg}`,
          color: 'red',
          icon: <IconX size={16} />,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to validate rows';
        notifications.show({
          title: 'Validation failed',
          message,
          color: 'red',
          icon: <IconX size={16} />,
        });
      }
    })();
  };

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>{t('bulkImportTitle')}</Title>
          <Group gap="sm">
            <Button
              id="bulk-import-export-students"
              leftSection={<IconDownload size={16} />}
              variant="default"
              loading={exportMutation.isPending}
              onClick={() => void handleExportStudents()}
            >
              {t('bulkExportStudents')}
            </Button>
            <Button
              id="bulk-import-download-template"
              leftSection={<IconDownload size={16} />}
              variant="light"
              onClick={handleDownloadTemplate}
            >
              {t('downloadTemplate')}
            </Button>
          </Group>
        </Group>
      </div>

      <div style={{ marginTop: '60px', padding: 'var(--mantine-spacing-md)' }}>
        <Stack gap="lg">
          <Alert icon={<IconAlertCircle size={16} />} title={t('howToUse')} color="blue">
            <ol style={{ margin: 0, paddingLeft: 20 }}>
              <li>{t('bulkStep1')}</li>
              <li>{t('bulkStep2')}</li>
              <li>{t('bulkStep3')}</li>
              <li>{t('bulkStep4')}</li>
            </ol>
          </Alert>

          {lastImportResult != null && (
            <Paper p="md" withBorder>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Title order={5}>{t('lastImportResult')}</Title>
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={() => setStatusModalOpen(true)}
                  >
                    {t('bulkViewImportStatus')}
                  </Button>
                </Group>
                <Text size="sm">
                  {t('bulkImportStatusSummary', {
                    added: lastImportResult.createdCount ?? 0,
                    updated: lastImportResult.updatedCount ?? 0,
                    unchanged: lastImportResult.unchangedCount ?? 0,
                    failedInsert: lastImportResult.failedInsertCount ?? 0,
                    failedUpdate: lastImportResult.failedUpdateCount ?? 0,
                  })}
                </Text>
                {lastImportResult.resultsFile && (
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconDownload size={14} />}
                    onClick={handleDownloadResultsFile}
                  >
                    {t('bulkDownloadResultsSheet')}
                  </Button>
                )}
              </Stack>
            </Paper>
          )}

          <Paper p="md" withBorder>
            <Stack gap="md">
              <FileInput
                id="bulk-import-file"
                label={t('uploadFileLabel')}
                placeholder={t('uploadFilePlaceholder')}
                accept=".xlsx,.xls,.csv"
                value={file}
                onChange={handleFileUpload}
                leftSection={<IconUpload size={16} />}
                disabled={previewMutation.isPending}
              />
              {previewMutation.isPending && (
                <Skeleton height={8} radius="xl" animate />
              )}
              {preview && (
                <Select
                  id="bulk-import-academic-year"
                  label={t('academicYear')}
                  placeholder={t('selectAcademicYear')}
                  value={selectedYear}
                  onChange={setSelectedYear}
                  data={academicYears.map((y) => ({ value: y.id, label: y.name }))}
                  required
                />
              )}
            </Stack>
          </Paper>

          {preview && (
            <Paper p="md" withBorder>
              <Stack gap="md">
                <Group justify="space-between">
                  <div>
                    <Title order={4}>Preview — edit any cell before importing</Title>
                    <Text size="sm" c="dimmed">
                      {showValidation
                        ? `${editableValidCount} valid / ${preview.totalRows} total rows (required: Username, First name, Last name, Gender)`
                        : `Not validated yet — press Validate to check ${preview.totalRows} row(s).`}
                    </Text>
                  </div>
                  <Group gap="sm">
                    <Button
                      id="bulk-import-cancel"
                      color="red"
                      variant="light"
                      onClick={handleCancelImport}
                      disabled={
                        previewMutation.isPending ||
                        importMutation.isPending ||
                        validateMutation.isPending
                      }
                    >
                      {t('bulkCancelImport')}
                    </Button>
                    <Button
                      id="bulk-import-validate"
                      variant="light"
                      onClick={handleValidate}
                      disabled={
                        !preview ||
                        previewMutation.isPending ||
                        importMutation.isPending ||
                        validateMutation.isPending
                      }
                      loading={validateMutation.isPending}
                      leftSection={<IconCheck size={16} />}
                    >
                      Validate
                    </Button>
                    <Button
                      id="bulk-import-submit"
                      onClick={handleImport}
                      disabled={
                        editableValidCount === 0 ||
                        !selectedYear ||
                        importMutation.isPending ||
                        !isValidated
                      }
                      loading={importMutation.isPending}
                      leftSection={<IconUpload size={16} />}
                    >
                      Import {editableValidCount} Students
                    </Button>
                  </Group>
                </Group>

                <div style={{ overflowX: 'auto' }}>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Row</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th>Username</Table.Th>
                        <Table.Th>First Name</Table.Th>
                        <Table.Th>Last Name</Table.Th>
                        <Table.Th>Gender</Table.Th>
                        <Table.Th>Invite type</Table.Th>
                        <Table.Th>Invite email</Table.Th>
                        <Table.Th>DOB</Table.Th>
                        <Table.Th>Class</Table.Th>
                        <Table.Th>Section</Table.Th>
                        <Table.Th>Subject Template</Table.Th>
                        <Table.Th>
                          <Group gap={6} wrap="nowrap">
                            <Text size="sm" fw={600}>
                              Errors
                            </Text>
                            {hasSubjectTemplateValidationIssues && (
                              <Tooltip label="Show subject templates linked to classes">
                                <ActionIcon
                                  id="bulk-import-subject-template-help"
                                  variant="light"
                                  radius="xl"
                                  size="sm"
                                  onClick={() => setHelpOpen(true)}
                                >
                                  <IconQuestionMark size={14} />
                                </ActionIcon>
                              </Tooltip>
                            )}
                          </Group>
                        </Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {preview.rows.map((row, rowIndex) => {
                        const hasRequired =
                          row.data.first_name?.trim() &&
                          row.data.last_name?.trim() &&
                          row.data.username?.trim() &&
                          row.data.gender?.trim();
                        const isValidating = validateMutation.isPending;
                        const isRowValid = showValidation ? (hasRequired && row.isValid) : false;
                        const errorRowBg =
                          showValidation &&
                          !isValidating &&
                          !isRowValid &&
                          (computedColorScheme === 'dark'
                            ? alpha(theme.colors.red[8], 0.25)
                            : theme.colors.red[0]);

                        return (
                          <Table.Tr
                            key={row.rowNumber}
                            bg={errorRowBg || undefined}
                          >
                            <Table.Td>{row.rowNumber}</Table.Td>
                            <Table.Td>
                              {showValidation && isValidating ? (
                                <Group gap={6} wrap="nowrap">
                                  <Loader size="xs" />
                                  <Text size="xs">Validating…</Text>
                                </Group>
                              ) : (
                                <Badge
                                  color={
                                    !showValidation
                                      ? 'gray'
                                      : isRowValid
                                        ? 'green'
                                        : 'red'
                                  }
                                  size="sm"
                                >
                                  {!showValidation ? 'Not validated' : isRowValid ? 'Valid' : 'Error'}
                                </Badge>
                              )}
                            </Table.Td>
                            <Table.Td>
                              <TextInput
                                id={`bulk-import-row-${rowIndex}-username`}
                                size="xs"
                                value={row.data.username ?? ''}
                                onChange={(e) =>
                                  updatePreviewRow(rowIndex, 'username', e.target.value)
                                }
                                placeholder="Username"
                              />
                            </Table.Td>
                            <Table.Td>
                              <TextInput
                                id={`bulk-import-row-${rowIndex}-first-name`}
                                size="xs"
                                value={row.data.first_name ?? ''}
                                onChange={(e) =>
                                  updatePreviewRow(rowIndex, 'first_name', e.target.value)
                                }
                                placeholder="First name"
                              />
                            </Table.Td>
                            <Table.Td>
                              <TextInput
                                id={`bulk-import-row-${rowIndex}-last-name`}
                                size="xs"
                                value={row.data.last_name ?? ''}
                                onChange={(e) =>
                                  updatePreviewRow(rowIndex, 'last_name', e.target.value)
                                }
                                placeholder="Last name"
                              />
                            </Table.Td>
                            <Table.Td>
                              <Select
                                id={`bulk-import-row-${rowIndex}-gender`}
                                size="xs"
                                value={row.data.gender ?? ''}
                                onChange={(v) =>
                                  updatePreviewRow(rowIndex, 'gender', v ?? undefined)
                                }
                                data={[
                                  { value: 'male', label: 'Male' },
                                  { value: 'female', label: 'Female' },
                                ]}
                                placeholder="Gender"
                              />
                            </Table.Td>
                            <Table.Td>
                              <Select
                                id={`bulk-import-row-${rowIndex}-invitation-type`}
                                size="xs"
                                value={row.data.invitation_type ?? 'student'}
                                onChange={(v) =>
                                  updatePreviewRow(rowIndex, 'invitation_type', v ?? 'student')
                                }
                                data={[
                                  { value: 'student', label: 'Student' },
                                  { value: 'parent', label: 'Parent' },
                                ]}
                              />
                            </Table.Td>
                            <Table.Td>
                              <TextInput
                                id={`bulk-import-row-${rowIndex}-invitation-email`}
                                size="xs"
                                value={row.data.invitation_recipient_email ?? ''}
                                onChange={(e) =>
                                  updatePreviewRow(
                                    rowIndex,
                                    'invitation_recipient_email',
                                    e.target.value
                                  )
                                }
                                placeholder="Required if invite type is Parent"
                              />
                            </Table.Td>
                            <Table.Td>
                              <TextInput
                                id={`bulk-import-row-${rowIndex}-dob`}
                                size="xs"
                                value={row.data.date_of_birth ?? ''}
                                onChange={(e) =>
                                  updatePreviewRow(rowIndex, 'date_of_birth', e.target.value)
                                }
                                placeholder="YYYY-MM-DD"
                              />
                            </Table.Td>
                            <Table.Td>
                              <TextInput
                                id={`bulk-import-row-${rowIndex}-class`}
                                size="xs"
                                value={row.data.class_name_or_id ?? ''}
                                onChange={(e) =>
                                  updatePreviewRow(rowIndex, 'class_name_or_id', e.target.value)
                                }
                                placeholder="Class"
                              />
                            </Table.Td>
                            <Table.Td>
                              <TextInput
                                id={`bulk-import-row-${rowIndex}-section`}
                                size="xs"
                                value={row.data.section_name_or_id ?? ''}
                                onChange={(e) =>
                                  updatePreviewRow(rowIndex, 'section_name_or_id', e.target.value)
                                }
                                placeholder="Section"
                              />
                            </Table.Td>
                            <Table.Td>
                              <TextInput
                                id={`bulk-import-row-${rowIndex}-subject-template`}
                                size="xs"
                                value={row.data.subject_template_name_or_id ?? ''}
                                onChange={(e) =>
                                  updatePreviewRow(
                                    rowIndex,
                                    'subject_template_name_or_id',
                                    e.target.value
                                  )
                                }
                                placeholder="Subject template"
                              />
                            </Table.Td>
                            <Table.Td>
                              {showValidation && !isValidating && row.errors.length > 0 && (
                                <Text
                                  size="xs"
                                  c={computedColorScheme === 'dark' ? 'red.3' : 'red.8'}
                                  fw={500}
                                >
                                  {row.errors.join(', ')}
                                </Text>
                              )}
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </div>
              </Stack>
            </Paper>
          )}
        </Stack>
      </div>

      <Modal
        opened={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="Subject template help"
        centered
        size="lg"
      >
        <Stack gap="sm">
          <Alert icon={<IconAlertCircle size={16} />} color="blue" title="How validation works">
            If a class has subject templates configured in Settings, then <strong>Subject Template is mandatory</strong>{' '}
            for students in that class. Choose one of the templates linked to that class.
          </Alert>

          <Text fw={600}>Available subject templates and linked classes</Text>
          {(subjectTemplateHelpQuery.data?.meta?.branchId ||
            subjectTemplateHelpQuery.isLoading ||
            subjectTemplateHelpQuery.error) && (
            <Text size="xs" c="dimmed">
              Branch context:{' '}
              {subjectTemplateHelpQuery.data?.meta?.tenantName
                ? `${subjectTemplateHelpQuery.data?.meta?.tenantName} / `
                : ''}
              {subjectTemplateHelpQuery.data?.meta?.branchName
                ? `${subjectTemplateHelpQuery.data?.meta?.branchName} `
                : ''}
              {subjectTemplateHelpQuery.data?.meta?.branchId
                ? `(${subjectTemplateHelpQuery.data?.meta?.branchId})`
                : ''}
            </Text>
          )}

          {subjectTemplateHelpQuery.isLoading ? (
            <Group gap="sm">
              <Loader size="sm" />
              <Text size="sm">Loading templates…</Text>
            </Group>
          ) : subjectTemplateHelpQuery.error ? (
            <Alert color="red" title="Failed to load" icon={<IconX size={16} />}>
              {(subjectTemplateHelpQuery.error as Error).message}
            </Alert>
          ) : (helpTemplates.length ?? 0) === 0 ? (
            <Alert color="yellow" title="No subject templates found" icon={<IconAlertCircle size={16} />}>
              This branch has no subject templates configured yet.
            </Alert>
          ) : (
            <Paper withBorder p="sm">
              <ScrollArea.Autosize mah={420} type="auto">
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Subject template</Table.Th>
                      <Table.Th>Linked classes</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {helpTemplates.map((tpl) => (
                      <Table.Tr key={tpl.id}>
                        <Table.Td>
                          <Text fw={600} size="sm">
                            {tpl.name}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          {tpl.classes.length === 0 ? (
                            <Text size="sm" c="dimmed">
                              Not linked
                            </Text>
                          ) : (
                            <List size="sm" withPadding listStyleType="disc" spacing={2}>
                              {tpl.classes.map((c) => (
                                <List.Item key={c.id}>
                                  {c.displayName ?? c.name}
                                </List.Item>
                              ))}
                            </List>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea.Autosize>
            </Paper>
          )}
        </Stack>
      </Modal>

      <Modal
        opened={statusModalOpen && lastImportResult != null}
        onClose={() => setStatusModalOpen(false)}
        title={t('bulkImportStatusTitle')}
        size="lg"
        centered
      >
        {lastImportResult && (
          <Stack gap="md">
            <Text size="sm">
              {t('bulkStatusAdded', { count: lastImportResult.createdCount ?? 0 })}
            </Text>
            <Text size="sm">
              {t('bulkStatusUpdated', { count: lastImportResult.updatedCount ?? 0 })}
            </Text>
            <Text size="sm">
              {t('bulkStatusUnchanged', { count: lastImportResult.unchangedCount ?? 0 })}
            </Text>
            {(lastImportResult.skippedCount ?? 0) > 0 && (
              <Text size="sm" c="dimmed">
                {t('bulkStatusSkipped', { count: lastImportResult.skippedCount ?? 0 })}
              </Text>
            )}

            <Divider />

            <div>
              <Text size="sm" fw={600} c="red">
                {t('bulkStatusFailedUpdate', {
                  count: lastImportResult.failedUpdateCount ?? 0,
                })}
              </Text>
              {(lastImportResult.rowOutcomes ?? [])
                .filter((o) => o.status === 'failed_update')
                .map((o) => (
                  <Text key={`fu-${o.row}`} size="xs" mt={4}>
                    {t('rowWithMessage', {
                      row: o.row,
                      message: `${o.username || o.studentName}: ${o.reason ?? ''}`,
                    })}
                  </Text>
                ))}
            </div>

            <div>
              <Text size="sm" fw={600} c="red">
                {t('bulkStatusFailedInsert', {
                  count: lastImportResult.failedInsertCount ?? 0,
                })}
              </Text>
              {(lastImportResult.rowOutcomes ?? [])
                .filter((o) => o.status === 'failed_insert' && o.row > 0)
                .map((o) => (
                  <Text key={`fi-${o.row}`} size="xs" mt={4}>
                    {t('rowWithMessage', {
                      row: o.row,
                      message: `${o.username || o.studentName}: ${o.reason ?? ''}`,
                    })}
                  </Text>
                ))}
            </div>

            {lastImportResult.resultsFile && (
              <Alert color="orange" title={t('bulkResultsSheetAvailable')}>
                <Stack gap="sm">
                  <Text size="sm">{t('bulkResultsSheetHint')}</Text>
                  <Button
                    leftSection={<IconDownload size={16} />}
                    onClick={handleDownloadResultsFile}
                  >
                    {t('bulkDownloadResultsSheet')}
                  </Button>
                </Stack>
              </Alert>
            )}

            <Group justify="flex-end">
              <Button onClick={() => setStatusModalOpen(false)}>{t('bulkCloseStatus')}</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
}

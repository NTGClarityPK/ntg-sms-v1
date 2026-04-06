'use client';

import { useState, useCallback } from 'react';
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
  useComputedColorScheme,
  useMantineTheme,
} from '@mantine/core';
import { IconUpload, IconCheck, IconX, IconAlertCircle, IconDownload } from '@tabler/icons-react';
import { useBulkImportPreview, useBulkImport, useBulkImportTemplate } from '@/hooks/useBulkImport';
import { useAcademicYearsList } from '@/hooks/useAcademicYears';
import { notifications } from '@mantine/notifications';
import * as XLSX from 'xlsx';
import type { BulkImportPreview, BulkImportResult, BulkStudentRowDto } from '@/hooks/useBulkImport';
import { modals } from '@mantine/modals';

export default function BulkImportStudentsPage() {
  const t = useTranslations('students');
  const theme = useMantineTheme();
  const computedColorScheme = useComputedColorScheme();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BulkImportPreview | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [lastImportResult, setLastImportResult] = useState<BulkImportResult | null>(null);

  const previewMutation = useBulkImportPreview();
  const importMutation = useBulkImport();
  const { data: templateData } = useBulkImportTemplate();
  const { data: academicYearsResponse } = useAcademicYearsList({ page: 1, limit: 50 });
  const academicYears = academicYearsResponse?.data ?? [];

  const handleFileUpload = async (uploadedFile: File | null) => {
    if (!uploadedFile) {
      setFile(null);
      setPreview(null);
      setSelectedYear(null);
      setLastImportResult(null);
      return;
    }
    setFile(uploadedFile);
    setPreview(null);
    setSelectedYear(null);
    setLastImportResult(null);
    try {
      const result = await previewMutation.mutateAsync(uploadedFile);
      setPreview(result);
      if (result.invalidRows > 0) {
        notifications.show({
          title: t('bulkValidationIssues'),
          message: t('bulkValidationIssuesMessage', { invalid: result.invalidRows, total: result.totalRows }),
          color: 'yellow',
          icon: <IconAlertCircle size={16} />,
        });
      } else {
        notifications.show({
          title: t('bulkReadyToImport'),
          message: t('bulkReadyToImportMessage', { count: result.validRows }),
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      }
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
    const validRows = preview.rows
      .filter(
        (r) =>
          r.data.first_name?.trim() &&
          r.data.last_name?.trim() &&
          r.data.username?.trim() &&
          r.data.gender?.trim()
      )
      .map((r) => ({ ...r.data, row_number: r.rowNumber }));
    if (validRows.length === 0) {
      notifications.show({
        title: t('bulkNoValidRows'),
        message: t('bulkNoValidRowsMessage'),
        color: 'red',
      });
      return;
    }
    try {
      const result = await importMutation.mutateAsync({
        rows: validRows,
        academicYearId: selectedYear,
      });
      setLastImportResult(result);
      notifications.show({
        title: t('bulkImportComplete'),
        message: result.errors.length > 0
          ? t('bulkImportCompletePartial', { successCount: result.successCount, failureCount: result.failureCount })
          : t('bulkImportCompleteSuccess', { successCount: result.successCount }),
        color: result.failureCount === 0 ? 'green' : 'yellow',
        icon: <IconCheck size={16} />,
      });

      if ((result.created?.length ?? 0) > 0) {
        modals.open({
          title: 'Invitations sent',
          size: 'xl',
          centered: true,
          children: (
            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
              <Stack gap="sm">
                {result.created!.map((c) => (
                  <Paper key={`${c.row}-${c.username}`} withBorder p="md">
                    <Group justify="space-between" align="flex-start">
                      <div>
                        <Text fw={600}>
                          Row {c.row} — {c.studentName} ({c.username})
                        </Text>
                        {c.loginEmail && (
                          <Text size="sm" c="dimmed">
                            Login: {c.loginEmail}
                          </Text>
                        )}
                      </div>
                      <Badge color={c.invitationType === 'parent' ? 'blue' : 'green'}>
                        {c.invitationType}
                      </Badge>
                    </Group>
                    <Divider my="sm" />
                    <Text size="sm">
                      <strong>Recipient email:</strong> {c.recipientEmail}
                    </Text>
                    <Text size="sm">
                      <strong>Expires at:</strong> {new Date(c.expiresAt).toLocaleString()}
                    </Text>

                    {c.parentRecipientEmail && (
                      <>
                        <Divider my="sm" />
                        <Text size="sm">
                          <strong>Parent setup recipient:</strong> {c.parentRecipientEmail}
                        </Text>
                        {c.parentExpiresAt && (
                          <Text size="sm">
                            <strong>Parent invite expires at:</strong>{' '}
                            {new Date(c.parentExpiresAt).toLocaleString()}
                          </Text>
                        )}
                      </>
                    )}
                  </Paper>
                ))}
              </Stack>
            </div>
          ),
        });
      }

      setFile(null);
      setPreview(null);
      setSelectedYear(null);
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
      { key: 'date_of_birth', label: 'Date of Birth (optional)', example: '2010-05-15' },
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

  const updatePreviewRow = useCallback(
    (rowIndex: number, field: keyof BulkStudentRowDto, value: string | undefined) => {
      setPreview((prev) => {
        if (!prev) return prev;
        const patch: Partial<BulkStudentRowDto> =
          field === 'invitation_type'
            ? { invitation_type: (value === 'parent' ? 'parent' : 'student') }
            : { [field]: value ?? '' } as Partial<BulkStudentRowDto>;
        return {
          ...prev,
          rows: prev.rows.map((r, i) =>
            i === rowIndex ? { ...r, data: { ...r.data, ...patch } } : r
          ),
        };
      });
    },
    []
  );

  const editableValidCount =
    preview?.rows.filter(
      (r) =>
        r.data.first_name?.trim() &&
        r.data.last_name?.trim() &&
        r.data.username?.trim() &&
        r.data.gender?.trim()
    ).length ?? 0;

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>{t('bulkImportTitle')}</Title>
          <Button
            id="bulk-import-download-template"
            leftSection={<IconDownload size={16} />}
            variant="light"
            onClick={handleDownloadTemplate}
          >
            {t('downloadTemplate')}
          </Button>
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
                <Title order={5}>{t('lastImportResult')}</Title>
                <Text size="sm">
                  {t('bulkStudentsImportedSuccess', { count: lastImportResult.successCount })}
                  {lastImportResult.failureCount > 0 && (
                    <> {t('bulkRowsFailed', { count: lastImportResult.failureCount })}</>
                  )}
                </Text>
                {lastImportResult.successCount > 0 && (
                  <Text size="xs" c="dimmed">
                    {t('importedStudentsHint')}
                  </Text>
                )}
                {lastImportResult.errors.length > 0 && (
                  <>
                    <Alert color="red" title={t('errorsByRow')}>
                      <Stack gap={4}>
                        {lastImportResult.errors
                          .filter((e) => !e.message.startsWith('Student imported but:'))
                          .map((e, idx) => (
                            <Text key={idx} size="sm">
                              {t('rowWithMessage', { row: e.row, message: e.message })}
                            </Text>
                          ))}
                      </Stack>
                    </Alert>
                    {lastImportResult.errors.some((e) =>
                      e.message.startsWith('Student imported but:')
                    ) && (
                      <Alert color="yellow" title={t('warningsImportedWithIssues')}>
                        <Stack gap={4}>
                          {lastImportResult.errors
                            .filter((e) => e.message.startsWith('Student imported but:'))
                            .map((e, idx) => (
                              <Text key={idx} size="sm">
                                {t('rowWithMessage', { row: e.row, message: e.message })}
                              </Text>
                            ))}
                        </Stack>
                      </Alert>
                    )}
                  </>
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
                      {editableValidCount} valid / {preview.totalRows} total rows (required: Username, First
                      name, Last name, Gender)
                    </Text>
                  </div>
                  <Button
                    id="bulk-import-submit"
                    onClick={handleImport}
                    disabled={
                      editableValidCount === 0 ||
                      !selectedYear ||
                      importMutation.isPending
                    }
                    loading={importMutation.isPending}
                    leftSection={<IconCheck size={16} />}
                  >
                    Import {editableValidCount} Students
                  </Button>
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
                        <Table.Th>Errors</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {preview.rows.map((row, rowIndex) => {
                        const hasRequired =
                          row.data.first_name?.trim() &&
                          row.data.last_name?.trim() &&
                          row.data.username?.trim() &&
                          row.data.gender?.trim();
                        const errorRowBg =
                          !hasRequired &&
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
                              <Badge
                                color={hasRequired ? 'green' : 'red'}
                                size="sm"
                              >
                                {hasRequired ? 'Valid' : 'Error'}
                              </Badge>
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
                              {row.errors.length > 0 && (
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
    </>
  );
}

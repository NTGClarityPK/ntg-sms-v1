'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
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
  Skeleton,
  TextInput,
  MultiSelect,
  Divider,
  Loader,
  useComputedColorScheme,
  useMantineTheme,
} from '@mantine/core';
import { IconUpload, IconCheck, IconX, IconAlertCircle, IconDownload } from '@tabler/icons-react';
import {
  useBulkUsersImportPreview,
  useBulkUsersImport,
  useBulkUsersImportTemplate,
  useBulkUsersImportValidate,
} from '@/hooks/useBulkImport';
import { useRoles } from '@/hooks/useRoles';
import { notifications } from '@mantine/notifications';
import * as XLSX from 'xlsx';
import type { BulkUserImportPreview, BulkUserImportResult, BulkUserRowDto } from '@/hooks/useBulkImport';
import type { Role } from '@/types/permissions';
import { modals } from '@mantine/modals';

function roleMatchKey(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function roleCompactKey(value: string): string {
  return roleMatchKey(value).replace(/\s+/g, '');
}

/** Map free-text / UUID role cell values onto known role IDs for the MultiSelect. */
function resolveRoleIdsFromCell(rolesStr: string, roles: Role[]): string[] {
  const tokens = String(rolesStr ?? '')
    .split(/[,;|]/)
    .map((t) => t.trim())
    .filter(Boolean);
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    const byId = roles.find((r) => r.id === token);
    if (byId) {
      if (!seen.has(byId.id)) {
        seen.add(byId.id);
        ids.push(byId.id);
      }
      continue;
    }
    const key = roleMatchKey(token);
    const compact = roleCompactKey(token);
    const match = roles.find((r) => {
      const nameKey = roleMatchKey(r.name);
      const displayKey = roleMatchKey(r.displayName);
      return (
        nameKey === key ||
        displayKey === key ||
        roleCompactKey(r.name) === compact ||
        roleCompactKey(r.displayName) === compact
      );
    });
    if (match && !seen.has(match.id)) {
      seen.add(match.id);
      ids.push(match.id);
    }
  }

  return ids;
}

export default function BulkImportUsersPage() {
  const t = useTranslations('user');
  const tCommon = useTranslations('common');
  const theme = useMantineTheme();
  const computedColorScheme = useComputedColorScheme();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BulkUserImportPreview | null>(null);
  const [lastImportResult, setLastImportResult] = useState<BulkUserImportResult | null>(null);
  const [isValidated, setIsValidated] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const previewMutation = useBulkUsersImportPreview();
  const importMutation = useBulkUsersImport();
  const validateMutation = useBulkUsersImportValidate();
  const { data: templateData } = useBulkUsersImportTemplate();
  const { data: rolesResponse } = useRoles();

  const importableRoles = useMemo(() => {
    const roles = rolesResponse?.data ?? [];
    return roles.filter((r) => (r.name || '').trim().toLowerCase() !== 'student');
  }, [rolesResponse?.data]);

  const roleOptions = useMemo(
    () =>
      importableRoles.map((r) => ({
        value: r.id,
        label: tCommon(`roleName.${r.name}` as 'roleName.subject_teacher') || r.displayName,
      })),
    [importableRoles, tCommon],
  );

  // If roles load after the file preview, map spreadsheet role text onto MultiSelect IDs.
  useEffect(() => {
    if (!preview || importableRoles.length === 0) return;
    setPreview((prev) => {
      if (!prev) return prev;
      let changed = false;
      const rows = prev.rows.map((row) => {
        const resolvedIds = resolveRoleIdsFromCell(row.data.roles ?? '', importableRoles);
        const nextRoles = resolvedIds.length > 0 ? resolvedIds.join(',') : row.data.roles;
        if (nextRoles === row.data.roles) return row;
        changed = true;
        return { ...row, data: { ...row.data, roles: nextRoles } };
      });
      return changed ? { ...prev, rows } : prev;
    });
  }, [importableRoles, preview?.totalRows]);

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
      const normalisedRows = result.rows.map((row) => {
        const resolvedIds = resolveRoleIdsFromCell(row.data.roles ?? '', importableRoles);
        if (resolvedIds.length === 0) return row;
        return {
          ...row,
          data: { ...row.data, roles: resolvedIds.join(',') },
        };
      });
      setPreview({
        ...result,
        rows: normalisedRows,
      });
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

  const handleImport = async () => {
    if (!preview) return;
    const validRows = preview.rows
      .filter((r) => r.isValid && r.data.full_name?.trim() && r.data.roles?.trim())
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
      const result = await importMutation.mutateAsync(validRows);
      setLastImportResult(result);
      notifications.show({
        title: t('bulkImportComplete'),
        message:
          result.errors.length > 0
            ? t('bulkImportCompletePartial', {
                successCount: result.successCount,
                failureCount: result.failureCount,
              })
            : t('bulkImportCompleteSuccess', { successCount: result.successCount }),
        color: result.failureCount === 0 ? 'green' : 'yellow',
        icon: <IconCheck size={16} />,
      });

      if ((result.created?.length ?? 0) > 0) {
        modals.open({
          title: t('bulkInvitationsSent'),
          size: 'xl',
          centered: true,
          children: (
            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
              <Stack gap="sm">
                {result.created!.map((c) => (
                  <Paper key={`${c.row}-${c.loginEmail}`} withBorder p="md">
                    <Group justify="space-between" align="flex-start">
                      <div>
                        <Text fw={600}>
                          {t('bulkCreatedRowLabel', { row: c.row, name: c.fullName })}
                        </Text>
                        {c.loginEmail && (
                          <Text size="sm" c="dimmed">
                            {t('bulkLoginLabel', { email: c.loginEmail })}
                          </Text>
                        )}
                        <Text size="sm" c="dimmed">
                          {t('bulkRolesLabel', { roles: c.roles })}
                        </Text>
                      </div>
                      <Badge color={c.userType === 'parent' ? 'blue' : 'green'}>
                        {c.userType === 'parent' ? t('bulkUserTypeParent') : t('bulkUserTypeStaff')}
                      </Badge>
                    </Group>
                    <Divider my="sm" />
                    <Text size="sm">
                      <strong>{t('bulkRecipientEmail')}:</strong> {c.recipientEmail}
                    </Text>
                  </Paper>
                ))}
              </Stack>
            </div>
          ),
        });
      }

      setFile(null);
      setPreview(null);
      setIsValidated(false);
      setShowValidation(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('bulkFailedToImportUsers');
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
      { key: 'full_name', label: 'Full Name', example: 'Sara Ahmed' },
      { key: 'roles', label: 'Roles', example: 'Subject Teacher' },
      { key: 'username', label: 'Username (staff)', example: 'sara.ahmed' },
      {
        key: 'invitation_email',
        label: 'Invitation Email (staff, optional)',
        example: 'sara.personal@example.com',
      },
      { key: 'email', label: 'Email (parent)', example: 'parent@example.com' },
      { key: 'phone', label: 'Phone (optional)', example: '+9647701234567' },
      { key: 'gender', label: 'Gender (optional)', example: 'female' },
      { key: 'date_of_birth', label: 'Date of Birth (optional)', example: '1990-05-15' },
      { key: 'address', label: 'Address (optional)', example: 'Baghdad' },
    ];
    const sampleRow: Record<string, string> = {};
    columns.forEach((col) => {
      sampleRow[col.label] = col.example;
    });
    const sampleRole =
      roleOptions.find((r) => r.label.toLowerCase().includes('subject'))?.label ??
      roleOptions[0]?.label;
    if (sampleRole && sampleRow.Roles !== undefined) {
      sampleRow.Roles = sampleRole;
    }
    const ws = XLSX.utils.json_to_sheet([sampleRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    const roleSheetRows = importableRoles.map((r) => ({
      'Role name (use in Roles column)':
        tCommon(`roleName.${r.name}` as 'roleName.subject_teacher') || r.displayName,
      'System name': r.name,
    }));
    if (roleSheetRows.length > 0) {
      const rolesWs = XLSX.utils.json_to_sheet(roleSheetRows);
      XLSX.utils.book_append_sheet(wb, rolesWs, 'Allowed Roles');
    }
    XLSX.writeFile(wb, 'users-import-template.xlsx');
    notifications.show({
      title: t('bulkTemplateDownloaded'),
      message: t('bulkTemplateDownloadedMessage'),
      color: 'green',
      icon: <IconCheck size={16} />,
    });
  };

  const recomputePreviewCounts = (rows: BulkUserImportPreview['rows']) => {
    const validRows = rows.filter((r) => r.isValid).length;
    return {
      validRows,
      invalidRows: rows.length - validRows,
    };
  };

  const updatePreviewRow = useCallback(
    (rowIndex: number, field: keyof BulkUserRowDto, value: string | undefined) => {
      setPreview((prev) => {
        if (!prev) return prev;
        const nextRows = prev.rows.map((r, i) => {
          if (i !== rowIndex) return r;
          const nextData = { ...r.data, [field]: value ?? '' };
          return {
            ...r,
            data: nextData,
            isValid: r.errors.length === 0,
          };
        });
        const counts = recomputePreviewCounts(nextRows);
        return { ...prev, ...counts, rows: nextRows };
      });
      setIsValidated(false);
      setShowValidation(false);
    },
    [],
  );

  const updatePreviewRowRoles = useCallback((rowIndex: number, roleIds: string[]) => {
    setPreview((prev) => {
      if (!prev) return prev;
      const nextRows = prev.rows.map((r, i) => {
        if (i !== rowIndex) return r;
        const nextErrors = (r.errors ?? []).filter((e) => {
          const s = String(e).toLowerCase();
          return !(
            s.includes('role ') ||
            s.includes('roles') ||
            s.includes('parent roles cannot') ||
            s.includes('at least one role')
          );
        });
        return {
          ...r,
          data: { ...r.data, roles: roleIds.join(',') },
          errors: nextErrors,
          isValid: nextErrors.length === 0 && roleIds.length > 0,
        };
      });
      const counts = recomputePreviewCounts(nextRows);
      return { ...prev, ...counts, rows: nextRows };
    });
    setIsValidated(false);
    setShowValidation(false);
  }, []);

  const editableValidCount = preview?.rows.filter((r) => r.isValid).length ?? 0;

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
        const normalisedRows = result.rows.map((row) => {
          const resolvedIds = resolveRoleIdsFromCell(row.data.roles ?? '', importableRoles);
          if (resolvedIds.length === 0) return row;
          return {
            ...row,
            data: { ...row.data, roles: resolvedIds.join(',') },
          };
        });
        setPreview({
          ...result,
          rows: normalisedRows,
        });

        if (result.invalidRows === 0) {
          setIsValidated(true);
          notifications.show({
            title: t('bulkValidated'),
            message: t('bulkValidatedMessage', { count: result.totalRows }),
            color: 'green',
            icon: <IconCheck size={16} />,
          });
          return;
        }

        const firstInvalid = result.rows.find((r) => !r.isValid);
        const firstMsg = firstInvalid?.errors?.[0] ?? t('bulkRowHasErrors');
        notifications.show({
          title: t('bulkValidationFailed'),
          message: t('bulkValidationFailedMessage', {
            count: result.invalidRows,
            row: firstInvalid?.rowNumber ?? '',
            message: firstMsg,
          }),
          color: 'red',
          icon: <IconX size={16} />,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t('bulkFailedToValidate');
        notifications.show({
          title: t('bulkValidationFailed'),
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
          <Button
            id="users-bulk-import-download-template"
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
                  {t('bulkUsersImportedSuccess', { count: lastImportResult.successCount })}
                  {lastImportResult.failureCount > 0 && (
                    <> {t('bulkRowsFailed', { count: lastImportResult.failureCount })}</>
                  )}
                </Text>
                {lastImportResult.successCount > 0 && (
                  <Text size="xs" c="dimmed">
                    {t('importedUsersHint')}
                  </Text>
                )}
                {lastImportResult.errors.length > 0 && (
                  <Alert color="red" title={t('errorsByRow')}>
                    <Stack gap={4}>
                      {lastImportResult.errors.map((e, idx) => (
                        <Text key={idx} size="sm">
                          {t('rowWithMessage', { row: e.row, message: e.message })}
                        </Text>
                      ))}
                    </Stack>
                  </Alert>
                )}
              </Stack>
            </Paper>
          )}

          <Paper p="md" withBorder>
            <Stack gap="md">
              <FileInput
                id="users-bulk-import-file"
                label={t('uploadFileLabel')}
                placeholder={t('uploadFilePlaceholder')}
                accept=".xlsx,.xls,.csv"
                value={file}
                onChange={handleFileUpload}
                leftSection={<IconUpload size={16} />}
                disabled={previewMutation.isPending}
              />
              {previewMutation.isPending && <Skeleton height={8} radius="xl" animate />}
            </Stack>
          </Paper>

          {preview && (
            <Paper p="md" withBorder>
              <Stack gap="md">
                <Group justify="space-between">
                  <div>
                    <Title order={4}>{t('bulkPreviewTitle')}</Title>
                    <Text size="sm" c="dimmed">
                      {showValidation
                        ? t('bulkPreviewValidatedSummary', {
                            valid: editableValidCount,
                            total: preview.totalRows,
                          })
                        : t('bulkPreviewNotValidated', { total: preview.totalRows })}
                    </Text>
                  </div>
                  <Group gap="sm">
                    <Button
                      id="users-bulk-import-validate"
                      variant="light"
                      onClick={handleValidate}
                      disabled={
                        !preview ||
                        previewMutation.isPending ||
                        importMutation.isPending ||
                        validateMutation.isPending
                      }
                      loading={!previewMutation.isPending && validateMutation.isPending}
                      leftSection={<IconCheck size={16} />}
                    >
                      {t('validate')}
                    </Button>
                    <Button
                      id="users-bulk-import-submit"
                      onClick={handleImport}
                      disabled={
                        editableValidCount === 0 ||
                        importMutation.isPending ||
                        !isValidated
                      }
                      loading={!validateMutation.isPending && importMutation.isPending}
                      leftSection={<IconUpload size={16} />}
                    >
                      {t('importUsersCount', { count: editableValidCount })}
                    </Button>
                  </Group>
                </Group>

                <div style={{ overflowX: 'auto' }}>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>{t('bulkColRow')}</Table.Th>
                        <Table.Th>{t('bulkColStatus')}</Table.Th>
                        <Table.Th>{t('fullName')}</Table.Th>
                        <Table.Th style={{ minWidth: 220 }}>{t('roles')}</Table.Th>
                        <Table.Th>{t('bulkColUsername')}</Table.Th>
                        <Table.Th>{t('bulkColInvitationEmail')}</Table.Th>
                        <Table.Th>{t('bulkColParentEmail')}</Table.Th>
                        <Table.Th>{t('phone')}</Table.Th>
                        <Table.Th>{t('gender')}</Table.Th>
                        <Table.Th>{t('bulkColErrors')}</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {preview.rows.map((row, rowIndex) => {
                        const isValidating = validateMutation.isPending;
                        const isRowValid = showValidation ? row.isValid : false;
                        const errorRowBg =
                          showValidation &&
                          !isValidating &&
                          !isRowValid &&
                          (computedColorScheme === 'dark'
                            ? alpha(theme.colors.red[8], 0.25)
                            : theme.colors.red[0]);
                        const selectedRoleIds = resolveRoleIdsFromCell(
                          row.data.roles ?? '',
                          importableRoles,
                        );

                        return (
                          <Table.Tr key={row.rowNumber} bg={errorRowBg || undefined}>
                            <Table.Td>{row.rowNumber}</Table.Td>
                            <Table.Td>
                              {showValidation && isValidating ? (
                                <Group gap={6} wrap="nowrap">
                                  <Loader size="xs" />
                                  <Text size="xs">{t('bulkValidating')}</Text>
                                </Group>
                              ) : (
                                <Badge
                                  color={!showValidation ? 'gray' : isRowValid ? 'green' : 'red'}
                                  size="sm"
                                >
                                  {!showValidation
                                    ? t('bulkNotValidated')
                                    : isRowValid
                                      ? t('bulkValid')
                                      : t('bulkError')}
                                </Badge>
                              )}
                            </Table.Td>
                            <Table.Td>
                              <TextInput
                                id={`users-bulk-import-row-${rowIndex}-full-name`}
                                size="xs"
                                value={row.data.full_name ?? ''}
                                onChange={(e) =>
                                  updatePreviewRow(rowIndex, 'full_name', e.target.value)
                                }
                              />
                            </Table.Td>
                            <Table.Td style={{ minWidth: 220 }}>
                              <MultiSelect
                                id={`users-bulk-import-row-${rowIndex}-roles`}
                                size="xs"
                                data={roleOptions}
                                value={selectedRoleIds}
                                onChange={(value) => updatePreviewRowRoles(rowIndex, value)}
                                searchable
                                clearable
                                hidePickedOptions
                                placeholder={t('bulkRolesPlaceholder')}
                                comboboxProps={{ withinPortal: true }}
                              />
                            </Table.Td>
                            <Table.Td>
                              <TextInput
                                id={`users-bulk-import-row-${rowIndex}-username`}
                                size="xs"
                                value={row.data.username ?? ''}
                                onChange={(e) =>
                                  updatePreviewRow(rowIndex, 'username', e.target.value)
                                }
                              />
                            </Table.Td>
                            <Table.Td>
                              <TextInput
                                id={`users-bulk-import-row-${rowIndex}-invitation-email`}
                                size="xs"
                                value={row.data.invitation_email ?? ''}
                                onChange={(e) =>
                                  updatePreviewRow(rowIndex, 'invitation_email', e.target.value)
                                }
                              />
                            </Table.Td>
                            <Table.Td>
                              <TextInput
                                id={`users-bulk-import-row-${rowIndex}-email`}
                                size="xs"
                                value={row.data.email ?? ''}
                                onChange={(e) =>
                                  updatePreviewRow(rowIndex, 'email', e.target.value)
                                }
                              />
                            </Table.Td>
                            <Table.Td>
                              <TextInput
                                id={`users-bulk-import-row-${rowIndex}-phone`}
                                size="xs"
                                value={row.data.phone ?? ''}
                                onChange={(e) =>
                                  updatePreviewRow(rowIndex, 'phone', e.target.value)
                                }
                              />
                            </Table.Td>
                            <Table.Td>
                              <TextInput
                                id={`users-bulk-import-row-${rowIndex}-gender`}
                                size="xs"
                                value={row.data.gender ?? ''}
                                onChange={(e) =>
                                  updatePreviewRow(rowIndex, 'gender', e.target.value)
                                }
                              />
                            </Table.Td>
                            <Table.Td>
                              {showValidation && row.errors.length > 0 ? (
                                <Stack gap={2}>
                                  {row.errors.map((err, i) => (
                                    <Text key={i} size="xs" c="red">
                                      {err}
                                    </Text>
                                  ))}
                                </Stack>
                              ) : (
                                <Text size="xs" c="dimmed">
                                  —
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

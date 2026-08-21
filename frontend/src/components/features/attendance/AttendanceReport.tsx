'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  Paper,
  Stack,
  Text,
  Skeleton,
  Table,
  Badge,
  Group,
  Button,
  Box,
  SimpleGrid,
  useMantineTheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconDownload } from '@tabler/icons-react';
import type { Attendance } from '@/types/attendance';
import { displayStudentId } from '@/lib/utils/student-display';

interface AttendanceReportProps {
  attendance: Attendance[];
  isLoading: boolean;
  startDate?: string;
  endDate?: string;
}

function parseLocalIsoDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function englishOrdinal(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

/** e.g. weekday "Friday" + rest "21st August 2026" (locale-aware month/weekday). */
function formatPeriodDateParts(
  isoDate: string,
  locale: string,
): { weekday: string; rest: string } {
  const date = parseLocalIsoDate(isoDate);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date);
  const month = new Intl.DateTimeFormat(locale, { month: 'long' }).format(date);
  const year = date.getFullYear();
  const day = date.getDate();
  const rest = locale.startsWith('ar')
    ? `${day} ${month} ${year}`
    : `${englishOrdinal(day)} ${month} ${year}`;
  return { weekday, rest };
}

function PeriodDateText({ isoDate, locale }: { isoDate: string; locale: string }) {
  const { weekday, rest } = formatPeriodDateParts(isoDate, locale);
  return (
    <Text span size="sm" c="dimmed">
      <Text span fw={700} c="inherit">
        {weekday}
      </Text>{' '}
      {rest}
    </Text>
  );
}

export function AttendanceReport({
  attendance,
  isLoading,
  startDate,
  endDate,
}: AttendanceReportProps) {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const t = useTranslations('attendance');
  const locale = useLocale();
  if (isLoading) {
    return (
      <Paper withBorder p="xl">
        <Stack gap="md">
          <Skeleton height={40} width="30%" />
          <Skeleton height={200} />
          <Skeleton height={300} />
        </Stack>
      </Paper>
    );
  }

  const presentCount = attendance.filter((a) => a.status === 'present').length;
  const absentCount = attendance.filter((a) => a.status === 'absent').length;
  const lateCount = attendance.filter((a) => a.status === 'late').length;
  const excusedCount = attendance.filter((a) => a.status === 'excused').length;
  const total = attendance.length;
  const presentPercentage =
    total > 0
      ? Math.round(((presentCount + lateCount) / total) * 100)
      : 0;

  const handleExport = () => {
    // Future: Export to CSV/Excel
    const csv = [
      ['Date', 'Student Name', 'Student ID', 'Class', 'Section', 'Status', 'Marked By', 'Entry Time', 'Exit Time', 'Notes'].join(','),
      ...attendance.map((a) =>
        [
          a.date,
          a.studentName,
          displayStudentId(a.studentIdNumber, a.studentId),
          a.className,
          a.sectionName,
          a.status,
          a.markedByName || '',
          a.entryTime || '',
          a.exitTime || '',
          (a.notes || '').replace(/,/g, ';'),
        ].join(','),
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-report-${startDate || 'all'}-${endDate || 'all'}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const sameDay = !!startDate && !!endDate && startDate === endDate;

  return (
    <Paper withBorder p="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={500} size="lg">
            {t('attendanceReport')}
          </Text>
          {attendance.length > 0 && (
            <Button
              leftSection={<IconDownload size={18} />}
              variant="light"
              onClick={handleExport}
            >
              {t('exportCsv')}
            </Button>
          )}
        </Group>

        {startDate || endDate ? (
          <Text size="sm" c="dimmed" component="div">
            {sameDay && startDate ? (
              <PeriodDateText isoDate={startDate} locale={locale} />
            ) : (
              <>
                {startDate ? (
                  <PeriodDateText isoDate={startDate} locale={locale} />
                ) : (
                  t('all')
                )}
                {' – '}
                {endDate ? (
                  <PeriodDateText isoDate={endDate} locale={locale} />
                ) : (
                  t('all')
                )}
              </>
            )}
          </Text>
        ) : null}

        {isMobile ? (
          <SimpleGrid cols={2} spacing="sm">
            <Paper withBorder p="sm">
              <Stack gap="xs" align="center">
                <Text size="sm" c="dimmed">
                  {t('totalRecords')}
                </Text>
                <Text fw={700} size="xl">
                  {total}
                </Text>
              </Stack>
            </Paper>
            <Paper withBorder p="sm">
              <Stack gap="xs" align="center">
                <Text size="sm" c="dimmed">
                  {t('attendanceRate')}
                </Text>
                <Text fw={700} size="xl">
                  {presentPercentage}%
                </Text>
              </Stack>
            </Paper>
            <Paper withBorder p="sm">
              <Stack gap="xs" align="center">
                <Text size="sm" c="dimmed">
                  {t('present')}
                </Text>
                <Badge variant="filled" color="green" size="lg">
                  {String(presentCount)}
                </Badge>
              </Stack>
            </Paper>
            <Paper withBorder p="sm">
              <Stack gap="xs" align="center">
                <Text size="sm" c="dimmed">
                  {t('absent')}
                </Text>
                <Badge variant="filled" color="red" size="lg">
                  {String(absentCount)}
                </Badge>
              </Stack>
            </Paper>
            <Paper withBorder p="sm">
              <Stack gap="xs" align="center">
                <Text size="sm" c="dimmed">
                  {t('late')}
                </Text>
                <Badge variant="filled" color="yellow" size="lg">
                  {String(lateCount)}
                </Badge>
              </Stack>
            </Paper>
            <Paper withBorder p="sm">
              <Stack gap="xs" align="center">
                <Text size="sm" c="dimmed">
                  {t('excused')}
                </Text>
                <Badge variant="filled" color="blue" size="lg">
                  {String(excusedCount)}
                </Badge>
              </Stack>
            </Paper>
          </SimpleGrid>
        ) : (
          <Group grow wrap="wrap" gap="sm">
            <Paper withBorder p="sm">
              <Stack gap="xs" align="center">
                <Text size="sm" c="dimmed">
                  {t('totalRecords')}
                </Text>
                <Text fw={600} size="xl">
                  {total}
                </Text>
              </Stack>
            </Paper>
            <Paper withBorder p="sm">
              <Stack gap="xs" align="center">
                <Text size="sm" c="dimmed">
                  {t('present')}
                </Text>
                <Badge variant="filled" color="green" size="lg">
                  {String(presentCount)}
                </Badge>
              </Stack>
            </Paper>
            <Paper withBorder p="sm">
              <Stack gap="xs" align="center">
                <Text size="sm" c="dimmed">
                  {t('absent')}
                </Text>
                <Badge variant="filled" color="red" size="lg">
                  {String(absentCount)}
                </Badge>
              </Stack>
            </Paper>
            <Paper withBorder p="sm">
              <Stack gap="xs" align="center">
                <Text size="sm" c="dimmed">
                  {t('late')}
                </Text>
                <Badge variant="filled" color="yellow" size="lg">
                  {String(lateCount)}
                </Badge>
              </Stack>
            </Paper>
            <Paper withBorder p="sm">
              <Stack gap="xs" align="center">
                <Text size="sm" c="dimmed">
                  {t('attendanceRate')}
                </Text>
                <Text fw={600} size="xl">
                  {presentPercentage}%
                </Text>
              </Stack>
            </Paper>
          </Group>
        )}

        {attendance.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            {t('noAttendanceForFilters')}
          </Text>
        ) : (
          <Box
            style={{
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              margin: -4,
              padding: 4,
            }}
          >
            <Table striped highlightOnHover style={{ minWidth: 600 }}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('dateColumn')}</Table.Th>
                    <Table.Th>{t('studentName')}</Table.Th>
                    <Table.Th>{t('studentId')}</Table.Th>
                    <Table.Th>{t('class')}</Table.Th>
                    <Table.Th>{t('section')}</Table.Th>
                    <Table.Th>{t('statusColumn')}</Table.Th>
                  <Table.Th>{t('markedByColumn')}</Table.Th>
                    <Table.Th>{t('entryTime')}</Table.Th>
                    <Table.Th>{t('exitTime')}</Table.Th>
                    <Table.Th>{t('notes')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {attendance.map((record) => (
                    <Table.Tr key={`${record.id}-${record.date}-${record.studentId}`}>
                      <Table.Td>{new Date(record.date).toLocaleDateString()}</Table.Td>
                      <Table.Td>{record.studentName}</Table.Td>
                      <Table.Td>{displayStudentId(record.studentIdNumber, record.studentId)}</Table.Td>
                      <Table.Td>{record.className}</Table.Td>
                      <Table.Td>{record.sectionName}</Table.Td>
                      <Table.Td>
                        <Badge
                          variant="filled"
                          color={
                            record.status === 'present'
                              ? 'green'
                              : record.status === 'absent'
                                ? 'red'
                                : record.status === 'late'
                                  ? 'yellow'
                                  : 'blue'
                          }
                        >
                          {record.status.toUpperCase()}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{record.markedByName || '-'}</Table.Td>
                      <Table.Td>{record.entryTime || '-'}</Table.Td>
                      <Table.Td>{record.exitTime || '-'}</Table.Td>
                      <Table.Td>{record.notes || '-'}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}




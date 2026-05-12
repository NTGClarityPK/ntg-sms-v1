'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Table,
  Badge,
  Group,
  ActionIcon,
  Tooltip,
  Pagination,
  Text,
  Modal,
  Stack,
  TextInput,
  Radio,
  Button,
  ScrollArea,
  useMantineTheme,
  Alert,
  Divider,
  Paper,
} from '@mantine/core';
import { IconEdit, IconChevronUp, IconChevronDown, IconMailForward, IconUsers, IconPhone, IconUser, IconMail } from '@tabler/icons-react';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import type { Student } from '@/types/students';
import { StudentForm } from './StudentForm';
import { useResendInvitationForUser } from '@/hooks/useInvitationsAdmin';
import { useReinviteStudentAfterExpiry } from '@/hooks/useStudents';
import { useStudentGuardians } from '@/hooks/useParentAssociations';
import { useTenantMe } from '@/hooks/useTenant';
import { isValidSchoolUsernameLocalPart } from '@/lib/validation/school-username';

/** Local-part of school login email for invitation / reinvite username fields. */
function loginUsernameFromEmail(email: string | undefined): string {
  const trimmed = (email ?? '').trim();
  if (!trimmed) return '';
  const at = trimmed.indexOf('@');
  return at > 0 ? trimmed.slice(0, at) : trimmed;
}

/** Prefill invitation recipient / send-to — matches submit fallback order. */
function defaultInvitationRecipient(student: Student): string {
  return (student.invitationRecipientEmail || student.email || '').trim();
}

/**
 * Best-effort school login address for re-invite. After an expired link the auth user may be
 * removed, so `student.email` is sometimes empty; if the last invitation went to `user@tenant`,
 * reuse that as the login hint.
 */
function defaultSchoolLoginEmail(student: Student, tenantDomain: string): string {
  const fromProfile = (student.email || '').trim();
  if (fromProfile) return fromProfile;
  const inv = (student.invitationRecipientEmail || '').trim();
  if (!inv || !tenantDomain) return '';
  const dom = tenantDomain.toLowerCase();
  const lower = inv.toLowerCase();
  const suffix = `@${dom}`;
  return lower.endsWith(suffix) ? inv : '';
}

/** Last two digits of roll number (numeric suffix of student ID). */
function lastTwoDigitsFromStudentId(studentId: string): string {
  const digits = (studentId || '').replace(/\D/g, '');
  if (digits.length === 0) return '00';
  if (digits.length === 1) return `0${digits}`;
  return digits.slice(-2);
}

/**
 * Re-invite suggestion: first letter of first name + '.' + last name (letters/digits only) + last two digits of student ID.
 * Example: John, Smith, ID STU-1042 → j.smith42
 */
function suggestedReinviteUsernameFromNameAndId(student: Student): string {
  const firstRaw = (student.firstName || '').trim();
  const lastRaw = (student.lastName || '').trim();
  const firstLetterMatch = firstRaw.match(/[A-Za-z]/);
  const firstLetter = firstLetterMatch ? firstLetterMatch[0].toLowerCase() : '';
  const lastPart = lastRaw.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!firstLetter || !lastPart) return '';
  return `${firstLetter}.${lastPart}${lastTwoDigitsFromStudentId(student.studentId || '')}`;
}

/** Prefill username for re-invite modal: name pattern when applicable, else login / invitation email local part. */
function defaultReinviteUsername(
  student: Student,
  tenantDomain: string,
  useNameAndIdPattern: boolean,
): string {
  if (useNameAndIdPattern) {
    const suggested = suggestedReinviteUsernameFromNameAndId(student);
    if (suggested && isValidSchoolUsernameLocalPart(suggested)) return suggested;
  }
  const fromLoginEmail = loginUsernameFromEmail((student.email || '').trim());
  if (fromLoginEmail) return fromLoginEmail;
  return loginUsernameFromEmail(defaultSchoolLoginEmail(student, tenantDomain));
}

interface StudentTableProps {
  students: Student[];
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  onPageChange?: (page: number) => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (field: string) => void;
  canEdit?: boolean;
}

export function StudentTable({ students, meta, onPageChange, sortBy, sortOrder, onSort, canEdit = true }: StudentTableProps) {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const t = useTranslations('students');
  const tCommon = useTranslations('common');
  const tenantMe = useTenantMe();
  const tenantDomain = tenantMe.data?.data?.domain?.trim() || '';
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [contactsOpened, contactsModal] = useDisclosure(false);
  const [contactsStudent, setContactsStudent] = useState<Student | null>(null);
  const [resendOpened, resendModal] = useDisclosure(false);
  const [resendStudent, setResendStudent] = useState<Student | null>(null);
  const [recipientEmail, setRecipientEmail] = useState('');
  /** Local part only (required for re-invite after school login was removed). */
  const [reinviteUsername, setReinviteUsername] = useState('');
  const [invitationRecipientEmail, setInvitationRecipientEmail] = useState('');
  const [invitationType, setInvitationType] = useState<'student' | 'parent'>('student');
  const resend = useResendInvitationForUser();
  const reinvite = useReinviteStudentAfterExpiry();
  const guardiansQuery = useStudentGuardians(contactsOpened ? contactsStudent?.id : null);
  const guardians = guardiansQuery.data?.data || [];

  const needsReinviteFlow = (s: Student | null) =>
    Boolean(s && (s.accountStatus === 'link_expired' || !s.userId));

  const handleEdit = (student: Student) => {
    setSelectedStudent(student);
    open();
  };

  const handleOpenContacts = (student: Student) => {
    setContactsStudent(student);
    contactsModal.open();
  };

  const closeResendModal = () => {
    resendModal.close();
    setResendStudent(null);
    setRecipientEmail('');
    setReinviteUsername('');
    setInvitationRecipientEmail('');
    setInvitationType('student');
  };

  const handleResend = (student: Student) => {
    setResendStudent(student);
    const recipient = defaultInvitationRecipient(student);
    setRecipientEmail(recipient);
    setReinviteUsername(
      defaultReinviteUsername(student, tenantDomain, needsReinviteFlow(student)),
    );
    setInvitationRecipientEmail(recipient);
    setInvitationType('student');
    resendModal.open();
  };

  const statusBadge = (student: Student) => {
    if (student.accountStatus === 'link_expired') {
      return (
        <Badge color="red" variant="light">
          {t('linkExpired')}
        </Badge>
      );
    }
    if (student.accountStatus === 'pending_verification') {
      return (
        <Badge color="yellow" variant="light">
          {t('pendingVerification')}
        </Badge>
      );
    }
    return (
      <Badge color={student.isActive ? 'green' : 'red'} variant="light">
        {student.isActive ? t('active') : t('inactive')}
      </Badge>
    );
  };

  const SortableHeader = ({ field, children }: { field: string; children: React.ReactNode }) => {
    const isSorted = sortBy === field;
    const isAsc = isSorted && sortOrder === 'asc';
    
    return (
      <Table.Th
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => onSort?.(field)}
      >
        <Group gap="xs" wrap="nowrap">
          <Text fw={500}>{children}</Text>
          {isSorted && (
            isAsc ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
          )}
        </Group>
      </Table.Th>
    );
  };

  return (
    <>
      <ScrollArea type="auto" scrollbars="x" w="100%">
        <Table striped highlightOnHover style={{ minWidth: 960 }}>
          <Table.Thead>
            <Table.Tr>
              <SortableHeader field="studentId">{t('studentId')}</SortableHeader>
              <SortableHeader field="firstName">{t('firstName')}</SortableHeader>
              <SortableHeader field="lastName">{t('lastName')}</SortableHeader>
              <Table.Th>{t('email')}</Table.Th>
              <SortableHeader field="className">{t('class')}</SortableHeader>
              <SortableHeader field="sectionName">{t('section')}</SortableHeader>
              <Table.Th>{t('subjectTemplate')}</Table.Th>
              <SortableHeader field="isActive">{t('status')}</SortableHeader>
              <Table.Th>{t('actions')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {students.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={9}>
                  <Text c="dimmed" ta="center" py="md">
                    {t('noStudentsFound')}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              students.map((student) => (
                <Table.Tr key={student.id}>
                  <Table.Td>
                    <Text fw={500} size={isMobile ? 'sm' : 'md'}>
                      {student.studentId}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size={isMobile ? 'sm' : 'md'}>{student.firstName ?? '—'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size={isMobile ? 'sm' : 'md'}>{student.lastName ?? '—'}</Text>
                  </Table.Td>
                  <Table.Td>
                    {student.email?.trim() ? (
                      <Text size="sm">{student.email}</Text>
                    ) : student.accountStatus === 'link_expired' ? (
                      <Badge
                        id={`students-email-login-removed-${student.id}`}
                        color="gray"
                        variant="light"
                        size="sm"
                        aria-label={t('loginAccountRemoved')}
                      >
                        {t('loginAccountRemoved')}
                      </Badge>
                    ) : (
                      <Text size="sm">—</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{student.className || 'N/A'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{student.sectionName || 'N/A'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{student.subjectTemplateName || 'N/A'}</Text>
                  </Table.Td>
                  <Table.Td>{statusBadge(student)}</Table.Td>
                  <Table.Td>
                    {canEdit && (
                      <Group gap={6} wrap="nowrap">
                        <Tooltip label={t('emergencyContacts')} withArrow>
                          <ActionIcon
                            id={`students-emergency-contacts-${student.id}`}
                            variant="light"
                            size={isMobile ? 'sm' : 'md'}
                            onClick={() => handleOpenContacts(student)}
                            aria-label={t('emergencyContacts')}
                          >
                            <IconUsers size={isMobile ? 14 : 16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label={tCommon('edit')} withArrow>
                          <ActionIcon
                            id={`students-edit-${student.id}`}
                            variant="light"
                            size={isMobile ? 'sm' : 'md'}
                            onClick={() => handleEdit(student)}
                            aria-label={tCommon('edit')}
                          >
                            <IconEdit size={isMobile ? 14 : 16} />
                          </ActionIcon>
                        </Tooltip>
                        {student.accountStatus !== 'active' && !student.isActive ? (
                          <Tooltip label={t('resendInvitationTitle')} withArrow>
                            <ActionIcon
                              id={`students-resend-invite-${student.id}`}
                              variant="light"
                              size={isMobile ? 'sm' : 'md'}
                              onClick={() => handleResend(student)}
                              aria-label={t('resendInvitationTitle')}
                            >
                              <IconMailForward size={isMobile ? 14 : 16} />
                            </ActionIcon>
                          </Tooltip>
                        ) : null}
                      </Group>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>

      {meta && meta.totalPages > 1 && (
        <ScrollArea type="auto" scrollbars="x" w="100%" mt="md">
          <Group justify="center" wrap="nowrap" gap={4} style={{ minWidth: 'min-content' }}>
            <Pagination
              total={meta.totalPages}
              value={meta.page}
              onChange={onPageChange}
              size={isMobile ? 'sm' : 'md'}
              withEdges={!isMobile}
            />
          </Group>
        </ScrollArea>
      )}

      <StudentForm
        opened={opened}
        onClose={() => {
          close();
          setSelectedStudent(null);
        }}
        student={selectedStudent}
      />

      <Modal
        opened={contactsOpened}
        onClose={() => {
          contactsModal.close();
          setContactsStudent(null);
        }}
        title={t('emergencyContacts')}
        size="md"
        centered
      >
        <Stack gap="sm">
          <Group gap="xs">
            <IconUsers size={18} />
            <Text fw={600}>
              {contactsStudent
                ? `${`${contactsStudent.firstName ?? ''} ${contactsStudent.lastName ?? ''}`.trim() || contactsStudent.studentId || '—'}`
                : '—'}
            </Text>
          </Group>

          <Divider />

          {guardiansQuery.isLoading || guardiansQuery.isFetching ? (
            <Text size="sm" c="dimmed">
              {tCommon('loading')}
            </Text>
          ) : guardiansQuery.error ? (
            <Alert color="red" title={t('failedToLoad')}>
              <Text size="sm">{t('pleaseTryAgain')}</Text>
            </Alert>
          ) : guardians.length === 0 ? (
            <Alert color="yellow" title={t('noGuardiansAssigned')}>
              <Text size="sm">{t('noGuardiansAssigned')}</Text>
            </Alert>
          ) : (
            <Paper withBorder p="md" radius="md">
              <Stack gap="xs">
                {guardians.map((guardian) => (
                  <Group
                    key={guardian.id}
                    justify="space-between"
                    p="xs"
                    style={{
                      border: '1px solid var(--mantine-color-gray-3)',
                      borderRadius: '4px',
                    }}
                  >
                    <Group gap="xs">
                      <Badge
                        size="sm"
                        color={guardian.priority === 1 ? 'green' : 'blue'}
                        variant="light"
                      >
                        {guardian.priority === 1 ? t('primary') : t('secondary')}
                      </Badge>
                      <Stack gap={2}>
                        <Group gap={6} wrap="nowrap">
                          <IconUser size={16} />
                          <Text size="sm" fw={500}>
                            {guardian.parentName || 'N/A'}
                          </Text>
                          <Text size="xs" c="dimmed">
                            ({guardian.relationship})
                          </Text>
                        </Group>
                        {guardian.parentEmail ? (
                          <Group gap={6} wrap="nowrap">
                            <IconMail size={14} />
                            <Text size="xs" c="dimmed">
                              {guardian.parentEmail}
                            </Text>
                          </Group>
                        ) : null}
                      </Stack>
                    </Group>

                    {guardian.parentPhone ? (
                      <Group gap={6}>
                        <IconPhone size={14} />
                        <Text size="sm">{guardian.parentPhone}</Text>
                      </Group>
                    ) : null}
                  </Group>
                ))}
              </Stack>
            </Paper>
          )}

          <Group justify="flex-end">
            <Button
              id="students-emergency-contacts-close"
              variant="light"
              onClick={contactsModal.close}
            >
              {tCommon('close')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={resendOpened}
        onClose={closeResendModal}
        title={t('resendInvitationTitle')}
      >
        <Stack gap="md">
          {needsReinviteFlow(resendStudent) && resendStudent ? (
            <Stack gap={4}>
              <Text size="sm" c="dimmed">
                {t('reinviteAfterExpiryIntro')}
              </Text>
              {resendStudent.invitationSentAt ? (
                <Text size="sm" c="dimmed">
                  {t('lastInvitationSentAt', {
                    date: new Date(resendStudent.invitationSentAt).toLocaleString(),
                  })}
                </Text>
              ) : null}
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">
              {t('resendInvitationIntro', {
                name:
                  `${resendStudent?.firstName ?? ''} ${resendStudent?.lastName ?? ''}`.trim() ||
                  resendStudent?.studentId ||
                  '—',
              })}
            </Text>
          )}

          {needsReinviteFlow(resendStudent) ? (
            <>
              <Group grow align="flex-end">
                <TextInput
                  id="students-reinvite-username"
                  label={t('username')}
                  placeholder={t('usernamePlaceholder')}
                  value={reinviteUsername}
                  onChange={(e) => setReinviteUsername(e.currentTarget.value)}
                  required
                />
                <TextInput
                  id="students-reinvite-domain"
                  label={t('domain')}
                  value={tenantDomain ? `@${tenantDomain}` : '—'}
                  readOnly
                  styles={{ input: { backgroundColor: 'var(--mantine-color-default-hover)' } }}
                />
              </Group>
              <Text size="xs" c="dimmed">
                {t('reinviteLoginEmailWillBe', {
                  email: tenantDomain
                    ? `${(reinviteUsername.trim() || 'username')}@${tenantDomain}`
                    : `${reinviteUsername.trim() || 'username'}@domain`,
                })}
              </Text>
              <TextInput
                id="students-reinvite-invitation-email"
                label={t('invitationRecipientEmail')}
                description={t('reinviteInvitationEmailDescription')}
                placeholder={t('emailPlaceholder')}
                value={invitationRecipientEmail}
                onChange={(e) => setInvitationRecipientEmail(e.currentTarget.value)}
                required
              />
            </>
          ) : null}

          <Radio.Group
            value={invitationType}
            onChange={(v) => setInvitationType(v as 'student' | 'parent')}
            label={t('invitationTemplateLabel')}
          >
            <Stack gap="xs" mt="xs">
              <Radio value="student" label={t('invitationTemplateStudent')} />
              <Radio value="parent" label={t('invitationTemplateParent')} />
            </Stack>
          </Radio.Group>

          {!needsReinviteFlow(resendStudent) ? (
            <TextInput
              id="students-resend-recipient-email"
              label={t('sendToOptional')}
              placeholder="recipient@example.com"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.currentTarget.value)}
            />
          ) : null}

          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeResendModal}>
              {t('cancel')}
            </Button>
            <Button
              id="students-resend-submit"
              loading={resend.isPending || reinvite.isPending}
              disabled={
                !resendStudent ||
                (needsReinviteFlow(resendStudent) &&
                  (!invitationRecipientEmail.trim() ||
                    !isValidSchoolUsernameLocalPart(reinviteUsername)))
              }
              onClick={async () => {
                if (!resendStudent) return;
                if (needsReinviteFlow(resendStudent)) {
                  await reinvite.mutateAsync({
                    studentId: resendStudent.id,
                    input: {
                      username: reinviteUsername.trim(),
                      invitationRecipientEmail: invitationRecipientEmail.trim(),
                      invitationType,
                    },
                  });
                } else {
                  if (!resendStudent.userId) return;
                  await resend.mutateAsync({
                    userId: resendStudent.userId,
                    invitationType,
                    recipientEmail: recipientEmail.trim() || undefined,
                  });
                }
              }}
            >
              {needsReinviteFlow(resendStudent) ? t('sendNewInvitation') : t('resend')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}


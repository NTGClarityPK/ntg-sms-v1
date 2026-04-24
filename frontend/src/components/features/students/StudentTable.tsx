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
  CopyButton,
  Alert,
  Divider,
  Paper,
} from '@mantine/core';
import { IconEdit, IconChevronUp, IconChevronDown, IconMailForward, IconUsers, IconPhone, IconUser, IconMail } from '@tabler/icons-react';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import type { Student } from '@/types/students';
import { StudentForm } from './StudentForm';
import { useResendInvitationForUser } from '@/hooks/useInvitationsAdmin';
import { useReinviteStudentAfterExpiry } from '@/hooks/useStudents';
import { useStudentGuardians } from '@/hooks/useParentAssociations';

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
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [contactsOpened, contactsModal] = useDisclosure(false);
  const [contactsStudent, setContactsStudent] = useState<Student | null>(null);
  const [resendOpened, resendModal] = useDisclosure(false);
  const [resendStudent, setResendStudent] = useState<Student | null>(null);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [studentUsername, setStudentUsername] = useState('');
  const [invitationRecipientEmail, setInvitationRecipientEmail] = useState('');
  const [invitationType, setInvitationType] = useState<'student' | 'parent'>('student');
  const [sentInfo, setSentInfo] = useState<{
    recipientEmail: string;
    sentAt?: string;
    expiresAt?: string;
  } | null>(null);
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

  const openInvitationSentModal = (input: { recipientEmail: string; expiresAt?: string }) => {
    const recipient = input.recipientEmail?.trim();
    if (!recipient) return;

    modals.open({
      title: t('invitationDetailsTitle'),
      size: 'lg',
      centered: true,
      children: (
        <Stack gap="sm">
          <Table withTableBorder withColumnBorders>
            <Table.Tbody>
              <Table.Tr>
                <Table.Th w={180}>{t('invitationRecipientEmail')}</Table.Th>
                <Table.Td>
                  <Group justify="space-between" wrap="nowrap">
                    <Text size="sm">{recipient}</Text>
                    <CopyButton value={recipient}>
                      {({ copy }) => (
                        <Button size="xs" variant="light" onClick={copy}>
                          {tCommon('copy')}
                        </Button>
                      )}
                    </CopyButton>
                  </Group>
                </Table.Td>
              </Table.Tr>
              {input.expiresAt && (
                <Table.Tr>
                  <Table.Th>Expires at</Table.Th>
                  <Table.Td>
                    <Text size="sm">{new Date(input.expiresAt).toLocaleString()}</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Stack>
      ),
    });
  };

  const handleResend = (student: Student) => {
    setResendStudent(student);
    setRecipientEmail('');
    setStudentUsername('');
    setInvitationRecipientEmail('');
    setInvitationType('student');
    // Show the most recently used invite destination (if we have it) inside the resend modal.
    setSentInfo(
      student.invitationRecipientEmail
        ? { recipientEmail: student.invitationRecipientEmail, sentAt: student.invitationSentAt }
        : null,
    );
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
                    <Text size="sm">{student.email || '—'}</Text>
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
        onClose={() => {
          resendModal.close();
          setResendStudent(null);
          setSentInfo(null);
        }}
        title={t('resendInvitationTitle')}
      >
        <Stack gap="md">
          {sentInfo?.recipientEmail && (
            <Alert
              variant="light"
              title={t('invitationDetailsTitle')}
              styles={{
                root: {
                  borderColor: 'var(--theme-primary)',
                  backgroundColor: 'var(--theme-surface-variant)',
                },
                title: { color: 'var(--theme-text)' },
              }}
            >
              <Stack gap={6}>
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm">{sentInfo.recipientEmail}</Text>
                  <CopyButton value={sentInfo.recipientEmail}>
                    {({ copy }) => (
                      <Button size="xs" variant="light" onClick={copy}>
                        {tCommon('copy')}
                      </Button>
                    )}
                  </CopyButton>
                </Group>
                {sentInfo.sentAt && (
                  <Text size="sm" c="dimmed">
                    {t('invitationSentAt', {
                      date: new Date(sentInfo.sentAt).toLocaleString(),
                    })}
                  </Text>
                )}
                {sentInfo.expiresAt && (
                  <Text size="sm" c="dimmed">
                    Expires at: {new Date(sentInfo.expiresAt).toLocaleString()}
                  </Text>
                )}
              </Stack>
            </Alert>
          )}
          <Text size="sm" c="dimmed">
            {needsReinviteFlow(resendStudent)
              ? t('reinviteAfterExpiryIntro')
              : t('resendInvitationIntro', {
                  name:
                    `${resendStudent?.firstName ?? ''} ${resendStudent?.lastName ?? ''}`.trim() ||
                    resendStudent?.studentId ||
                    '—',
                })}
          </Text>

          {needsReinviteFlow(resendStudent) ? (
            <>
              <TextInput
                id="students-reinvite-login-email"
                label={t('studentLoginEmail')}
                placeholder={t('usernamePlaceholder')}
                value={studentUsername}
                onChange={(e) => setStudentUsername(e.currentTarget.value)}
                required
              />
              <TextInput
                id="students-reinvite-invitation-email"
                label={t('invitationRecipientEmail')}
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
            <Button
              variant="subtle"
              onClick={() => {
                resendModal.close();
                setResendStudent(null);
              }}
            >
              {t('cancel')}
            </Button>
            <Button
              id="students-resend-submit"
              loading={resend.isPending || reinvite.isPending}
              disabled={
                !resendStudent ||
                (needsReinviteFlow(resendStudent) &&
                  (!studentUsername.trim() || !invitationRecipientEmail.trim()))
              }
              onClick={async () => {
                if (!resendStudent) return;
                if (needsReinviteFlow(resendStudent)) {
                  const result = await reinvite.mutateAsync({
                    studentId: resendStudent.id,
                    input: {
                      username: studentUsername.trim(),
                      invitationRecipientEmail: invitationRecipientEmail.trim(),
                      invitationType,
                    },
                  });
                  setSentInfo({
                    recipientEmail: result.studentInvitation.recipientEmail,
                    expiresAt: result.studentInvitation.expiresAt,
                  });
                } else {
                  if (!resendStudent.userId) return;
                  const result = await resend.mutateAsync({
                    userId: resendStudent.userId,
                    invitationType,
                    recipientEmail: recipientEmail.trim() || undefined,
                  });
                  const usedEmail =
                    recipientEmail.trim() ||
                    resendStudent.invitationRecipientEmail ||
                    resendStudent.email ||
                    '';
                  setSentInfo({ recipientEmail: usedEmail, expiresAt: result.expiresAt });
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


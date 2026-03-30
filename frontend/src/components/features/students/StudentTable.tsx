'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Table, Badge, Group, ActionIcon, Pagination, Text, Modal, Stack, TextInput, Radio, Button } from '@mantine/core';
import { IconEdit, IconChevronUp, IconChevronDown, IconMailForward } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import type { Student } from '@/types/students';
import { StudentForm } from './StudentForm';
import { useResendInvitationForUser } from '@/hooks/useInvitationsAdmin';
import { useReinviteStudentAfterExpiry } from '@/hooks/useStudents';

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
  const t = useTranslations('students');
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [resendOpened, resendModal] = useDisclosure(false);
  const [resendStudent, setResendStudent] = useState<Student | null>(null);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [studentUsername, setStudentUsername] = useState('');
  const [invitationRecipientEmail, setInvitationRecipientEmail] = useState('');
  const [invitationType, setInvitationType] = useState<'student' | 'parent'>('student');
  const resend = useResendInvitationForUser();
  const reinvite = useReinviteStudentAfterExpiry();

  const needsReinviteFlow = (s: Student | null) =>
    Boolean(s && (s.accountStatus === 'link_expired' || !s.userId));

  const handleEdit = (student: Student) => {
    setSelectedStudent(student);
    open();
  };

  const handleResend = (student: Student) => {
    setResendStudent(student);
    setRecipientEmail('');
    setStudentUsername('');
    setInvitationRecipientEmail('');
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
      <Table striped highlightOnHover>
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
                  <Text fw={500}>{student.studentId}</Text>
                </Table.Td>
                <Table.Td>
                  <Text>{student.firstName ?? '—'}</Text>
                </Table.Td>
                <Table.Td>
                  <Text>{student.lastName ?? '—'}</Text>
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
                    <Group gap={6}>
                      <ActionIcon variant="light" onClick={() => handleEdit(student)} aria-label="Edit student">
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon variant="light" onClick={() => handleResend(student)} aria-label="Resend invitation">
                        <IconMailForward size={16} />
                      </ActionIcon>
                    </Group>
                  )}
                </Table.Td>
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>

      {meta && meta.totalPages > 1 && (
        <Group justify="center" mt="md">
          <Pagination total={meta.totalPages} value={meta.page} onChange={onPageChange} />
        </Group>
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
        opened={resendOpened}
        onClose={() => {
          resendModal.close();
          setResendStudent(null);
        }}
        title={t('resendInvitationTitle')}
      >
        <Stack gap="md">
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
                  await reinvite.mutateAsync({
                    studentId: resendStudent.id,
                    input: {
                      username: studentUsername.trim(),
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
                resendModal.close();
                setResendStudent(null);
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


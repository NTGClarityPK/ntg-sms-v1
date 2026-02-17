'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Title,
  Group,
  Stack,
  Paper,
  Text,
  Badge,
  Button,
  Skeleton,
  ScrollArea,
  TextInput,
  Textarea,
  Select,
  Divider,
  Modal,
  SimpleGrid,
  useMantineTheme,
} from '@mantine/core';
import { useSearchParams } from 'next/navigation';
import { IconMessage, IconPlus } from '@tabler/icons-react';
import { useConversations, useConversation, useConversationMessages, useSendMessage, useMarkMessageRead, useCreateConversation } from '@/hooks/api/useMessages';
import { useClassSections } from '@/hooks/useClassSections';
import { useUsers } from '@/hooks/useUsers';
import { useSystemSetting } from '@/hooks/useSystemSettings';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import type { MessageType, ConversationListItem, Message } from '@/types/messages';

const MESSAGE_TYPES: { value: MessageType; label: string }[] = [
  { value: 'event', label: 'Event' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'grade', label: 'Grade' },
  { value: 'other', label: 'Other' },
];

function getMessageTypeColor(type: MessageType, colors: ReturnType<typeof useThemeColors>) {
  switch (type) {
    case 'event':
      return colors.primary;
    case 'meeting':
      return colors.info;
    case 'grade':
      return colors.success;
    case 'other':
    default:
      return colors.primary;
  }
}

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const theme = useMantineTheme();
  const colors = useThemeColors();
  const { user } = useAuth();
  const conversationIdFromUrl = searchParams.get('conversation');
  const [selectedId, setSelectedId] = useState<string | null>(conversationIdFromUrl);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [messageType, setMessageType] = useState<MessageType>('other');
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [newType, setNewType] = useState<'one_to_one' | 'broadcast'>('one_to_one');
  const [newRecipientUserId, setNewRecipientUserId] = useState<string | null>(null);
  const [newClassSectionId, setNewClassSectionId] = useState<string | null>(null);

  useEffect(() => {
    if (conversationIdFromUrl) setSelectedId(conversationIdFromUrl);
  }, [conversationIdFromUrl]);

  const { data: conversationsResponse, isLoading: loadingList } = useConversations({ limit: 50 });
  const conversations: ConversationListItem[] = conversationsResponse?.data ?? [];
  const meta = (conversationsResponse as { meta?: { total: number } })?.meta;

  const { data: conversation, isLoading: loadingConv } = useConversation(selectedId);
  const { data: messagesResponse, isLoading: loadingMessages } = useConversationMessages(
    selectedId,
    { page: 1, limit: 50 },
  );
  const messages: Message[] = messagesResponse?.data ?? [];
  const sendMessage = useSendMessage(selectedId);
  const markRead = useMarkMessageRead();
  const createConversation = useCreateConversation();

  const { data: commSetting } = useSystemSetting<{ teacher_student?: string; teacher_parent?: string }>('communication_direction');
  const teacherStudentBoth = (commSetting?.data?.value?.teacher_student ?? 'both') === 'both';
  const teacherParentBoth = (commSetting?.data?.value?.teacher_parent ?? 'both') === 'both';
  const isTeacher = user?.roles?.some(
    (r) => ['class_teacher', 'subject_teacher', 'principal', 'school_admin', 'academic_coordinator', 'guidance_counselor', 'admin_assistant', 'super_admin'].includes(r.roleName ?? ''),
  );
  const isStudent = user?.roles?.some((r) => (r.roleName ?? '').toLowerCase() === 'student');
  const isParent = user?.roles?.some((r) => (r.roleName ?? '').toLowerCase() === 'parent');
  const canReply =
    isTeacher ||
    (isStudent && teacherStudentBoth) ||
    (isParent && teacherParentBoth);

  const { data: classSectionsResponse } = useClassSections({ limit: 200, minimal: true });
  const classSectionsList = (classSectionsResponse as { data?: Array<{ id: string; className?: string; sectionName?: string }> })?.data ?? [];
  const { data: usersResponse } = useUsers({ limit: 200 });
  const usersList = (usersResponse as { data?: Array<{ id: string; email?: string; fullName?: string }> })?.data ?? [];

  const handleSend = useCallback(() => {
    if (!selectedId || !subject.trim()) return;
    sendMessage.mutate(
      { messageType, subject: subject.trim(), body: body.trim() || undefined },
      {
        onSuccess: () => {
          setSubject('');
          setBody('');
        },
      },
    );
  }, [selectedId, subject, body, messageType, sendMessage]);

  const handleMarkAllRead = useCallback(() => {
    messages.filter((m) => !m.isRead).forEach((m) => markRead.mutate(m.id));
  }, [messages, markRead]);

  const handleCreateConversation = useCallback(() => {
    if (newType === 'one_to_one' && newRecipientUserId) {
      createConversation.mutate(
        { type: 'one_to_one', recipientUserId: newRecipientUserId },
        {
          onSuccess: (data) => {
            if (data?.id) {
              setNewConversationOpen(false);
              setNewRecipientUserId(null);
              setSelectedId(data.id);
              window.history.replaceState(null, '', `/messages?conversation=${data.id}`);
            }
          },
        },
      );
    } else if (newType === 'broadcast' && newClassSectionId) {
      createConversation.mutate(
        { type: 'broadcast', classSectionId: newClassSectionId },
        {
          onSuccess: (data) => {
            if (data?.id) {
              setNewConversationOpen(false);
              setNewClassSectionId(null);
              setSelectedId(data.id);
              window.history.replaceState(null, '', `/messages?conversation=${data.id}`);
            }
          },
        },
      );
    }
  }, [newType, newRecipientUserId, newClassSectionId, createConversation]);

  const conversationTitle = conversation
    ? conversation.type === 'broadcast' && (conversation.className || conversation.sectionName)
      ? `${conversation.className ?? ''} ${conversation.sectionName ?? ''}`.trim()
      : conversation.participants?.map((p) => p.fullName).filter(Boolean).join(', ') || 'Conversation'
    : '';

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Messages</Title>
          <Button
            leftSection={<IconPlus size={18} />}
            onClick={() => setNewConversationOpen(true)}
          >
            New conversation
          </Button>
        </Group>
      </div>

      <div
        style={{
          marginTop: '60px',
          padding: 'var(--mantine-spacing-md)',
        }}
      >
        <Paper withBorder p={0}>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing={0} style={{ minHeight: 480 }}>
            <Box style={{ borderRight: '1px solid var(--mantine-color-default-border)' }}>
              <ScrollArea h={480} type="auto">
                {loadingList ? (
                  <Stack p="md" gap="sm">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} height={56} radius="sm" />
                    ))}
                  </Stack>
                ) : conversations.length === 0 ? (
                  <Stack align="center" justify="center" p="xl" h={400}>
                    <IconMessage size={48} style={{ opacity: 0.3 }} />
                    <Text c="dimmed">No conversations yet</Text>
                    <Button variant="light" onClick={() => setNewConversationOpen(true)}>
                      Start a conversation
                    </Button>
                  </Stack>
                ) : (
                  <Stack gap={0}>
                    {conversations.map((c) => (
                      <Box
                        key={c.id}
                        p="sm"
                        style={{
                          cursor: 'pointer',
                          backgroundColor: selectedId === c.id ? theme.colors.blue[0] : undefined,
                        }}
                        onClick={() => {
                          setSelectedId(c.id);
                          window.history.replaceState(null, '', `/messages?conversation=${c.id}`);
                        }}
                      >
                        <Group justify="space-between" wrap="nowrap">
                          <Text fw={selectedId === c.id ? 600 : 400} size="sm" lineClamp={1}>
                            {c.type === 'broadcast'
                              ? `${c.className ?? ''} ${c.sectionName ?? ''}`.trim() || 'Broadcast'
                              : c.participantNames?.join(', ') || 'Conversation'}
                          </Text>
                          {c.unreadCount > 0 && (
                            <Badge size="sm" color="blue" variant="filled">
                              {c.unreadCount}
                            </Badge>
                          )}
                        </Group>
                        {c.lastMessagePreview && (
                          <Text size="xs" c="dimmed" lineClamp={1} mt={4}>
                            {c.lastMessagePreview}
                          </Text>
                        )}
                      </Box>
                    ))}
                  </Stack>
                )}
              </ScrollArea>
            </Box>

            <Box>
              {!selectedId ? (
                <Stack align="center" justify="center" h={480} p="xl">
                  <IconMessage size={64} style={{ opacity: 0.2 }} />
                  <Text c="dimmed">Select a conversation or start a new one</Text>
                </Stack>
              ) : (
                <Stack gap={0} h={480} style={{ flex: 1 }}>
                  <Box p="md" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
                    {loadingConv ? (
                      <Skeleton height={24} width="60%" />
                    ) : (
                      <Group justify="space-between">
                        <Text fw={600}>{conversationTitle}</Text>
                        {messages.some((m) => !m.isRead) && (
                          <Button variant="subtle" size="xs" onClick={handleMarkAllRead}>
                            Mark all read
                          </Button>
                        )}
                      </Group>
                    )}
                  </Box>
                  <ScrollArea flex={1} type="auto" viewportProps={{ style: { maxHeight: 280 } }}>
                    <Stack p="md" gap="md">
                      {loadingMessages ? (
                        <Skeleton height={120} />
                      ) : messages.length === 0 ? (
                        <Text size="sm" c="dimmed">
                          No messages yet. Send the first message.
                        </Text>
                      ) : (
                        [...messages].reverse().map((m) => (
                          <Paper key={m.id} p="sm" withBorder shadow="xs" radius="md">
                            <Group justify="space-between" mb={4}>
                              <Group gap="xs">
                                <Badge
                                  size="sm"
                                  variant="light"
                                  color={getMessageTypeColor(m.messageType, colors)}
                                >
                                  {m.messageType}
                                </Badge>
                                <Text size="sm" fw={500}>
                                  {m.senderName ?? 'Unknown'}
                                </Text>
                              </Group>
                              <Group gap="xs">
                                <Text size="xs" c="dimmed">
                                  {new Date(m.createdAt).toLocaleString()}
                                </Text>
                                {!m.isRead && (
                                  <Badge size="xs" variant="dot">
                                    Unread
                                  </Badge>
                                )}
                              </Group>
                            </Group>
                            {m.subject && (
                              <Text size="sm" fw={500} mb={4}>
                                {m.subject}
                              </Text>
                            )}
                            <Text size="sm" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
                              {m.body || '-'}
                            </Text>
                            {!m.isRead && m.senderId !== user?.id && (
                              <Button
                                size="xs"
                                variant="subtle"
                                mt="xs"
                                onClick={() => markRead.mutate(m.id)}
                              >
                                Mark as read
                              </Button>
                            )}
                          </Paper>
                        ))
                      )}
                    </Stack>
                  </ScrollArea>
                  {canReply && (
                    <>
                      <Divider />
                      <Box p="md">
                        <Stack gap="sm">
                          <Select
                            label="Type"
                            data={MESSAGE_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                            value={messageType}
                            onChange={(v) => v && setMessageType(v as MessageType)}
                          />
                          <TextInput
                            label="Subject"
                            placeholder="Subject"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                          />
                          <Textarea
                            label="Message"
                            placeholder="Write your message..."
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            minRows={2}
                          />
                          <Button
                            onClick={handleSend}
                            loading={sendMessage.isPending}
                            disabled={!subject.trim()}
                          >
                            Send
                          </Button>
                        </Stack>
                      </Box>
                    </>
                  )}
                </Stack>
              )}
            </Box>
          </SimpleGrid>
        </Paper>
      </div>

      <Modal
        opened={newConversationOpen}
        onClose={() => {
          setNewConversationOpen(false);
          setNewRecipientUserId(null);
          setNewClassSectionId(null);
        }}
        title="New conversation"
      >
        <Stack gap="md">
          <Select
            label="Conversation type"
            data={[
              { value: 'one_to_one', label: 'One-to-one' },
              { value: 'broadcast', label: 'Broadcast to class' },
            ]}
            value={newType}
            onChange={(v) => v && setNewType(v as 'one_to_one' | 'broadcast')}
          />
          {newType === 'one_to_one' && (
            <Select
              label="Select user"
              placeholder="Choose a user"
              searchable
              data={usersList.map((u) => ({
                value: u.id,
                label: u.fullName ?? u.email ?? u.id,
              }))}
              value={newRecipientUserId}
              onChange={setNewRecipientUserId}
            />
          )}
          {newType === 'broadcast' && (
            <Select
              label="Class section"
              placeholder="Choose a class"
              searchable
              data={classSectionsList.map((cs) => ({
                value: cs.id,
                label: `${(cs as { className?: string }).className ?? ''} ${(cs as { sectionName?: string }).sectionName ?? ''}`.trim() || cs.id,
              }))}
              value={newClassSectionId}
              onChange={setNewClassSectionId}
            />
          )}
          <Group justify="flex-end" mt="md">
            <Button
              variant="default"
              onClick={() => setNewConversationOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateConversation}
              loading={createConversation.isPending}
              disabled={
                (newType === 'one_to_one' && !newRecipientUserId) ||
                (newType === 'broadcast' && !newClassSectionId)
              }
            >
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

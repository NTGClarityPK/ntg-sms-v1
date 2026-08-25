'use client';

import { ActionIcon, Anchor, Badge, Box, Group, Paper, ScrollArea, Stack, Text, Tooltip, useComputedColorScheme } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import type { SupportConversation, SupportMessage } from '@/types/support';
import { useDeleteSupportMessage } from '@/hooks/api/useSupport';
import { isMediaExpired } from './supportMedia';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

type Props = {
  conversation: SupportConversation | null;
  messages: SupportMessage[];
  /** Show LIVE badge for open conversations (matches Resto thread header). */
  isLive?: boolean;
};

function MessageBubble({
  message,
  conversationId,
}: {
  message: SupportMessage;
  conversationId: string;
}) {
  const t = useTranslations('support');
  const { primary, error: errorColor } = useThemeColors();
  const colorScheme = useComputedColorScheme('light');
  const isDark = colorScheme === 'dark';
  const deleteMutation = useDeleteSupportMessage();
  const isCustomer = message.senderType === 'customer';
  const expired = isMediaExpired(message.expiresAt);
  const onPrimary = isCustomer;
  const agentBg = isDark ? 'var(--mantine-color-dark-5)' : 'var(--mantine-color-gray-2)';
  const agentFg = isDark ? 'var(--mantine-color-gray-0)' : 'var(--mantine-color-dark-7)';
  const agentMuted = isDark ? 'var(--mantine-color-dark-1)' : 'var(--mantine-color-gray-6)';

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({
        messageId: message.id,
        conversationId,
      });
    } catch (e) {
      notifications.show({
        title: t('errorTitle'),
        message: e instanceof Error ? e.message : t('deleteFailed'),
        color: errorColor,
      });
    }
  };

  return (
    <Box
      style={{
        alignSelf: isCustomer ? 'flex-end' : 'flex-start',
        maxWidth: '75%',
      }}
    >
      {!isCustomer && (
        <Text size="xs" c="dimmed" mb={4}>
          {message.senderDisplayName || t('agentLabel')}
        </Text>
      )}
      <Paper
        p="sm"
        radius="md"
        style={{
          backgroundColor: isCustomer ? primary : agentBg,
          color: onPrimary ? 'var(--mantine-color-white)' : agentFg,
        }}
      >
        {message.messageType === 'text' && (
          <Text
            size="sm"
            style={{ whiteSpace: 'pre-wrap', color: onPrimary ? 'var(--mantine-color-white)' : agentFg }}
          >
            {message.content}
          </Text>
        )}
        {message.messageType === 'image' &&
          (expired || !message.fileUrl ? (
            <Text size="sm" style={{ color: onPrimary ? 'var(--mantine-color-white)' : agentMuted, opacity: onPrimary ? 0.85 : 1 }}>
              {t('mediaExpired')}
            </Text>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={message.fileUrl}
              alt={message.content || t('imageAlt')}
              style={{ maxWidth: '100%', borderRadius: 8 }}
            />
          ))}
        {message.messageType === 'voice' &&
          (expired || !message.fileUrl ? (
            <Text size="sm" style={{ color: onPrimary ? 'var(--mantine-color-white)' : agentMuted, opacity: onPrimary ? 0.85 : 1 }}>
              {t('mediaExpired')}
            </Text>
          ) : (
            <audio controls src={message.fileUrl} style={{ maxWidth: '100%' }}>
              <track kind="captions" />
            </audio>
          ))}
        {message.messageType === 'video' &&
          (expired || !message.fileUrl ? (
            <Text size="sm" style={{ color: onPrimary ? 'var(--mantine-color-white)' : agentMuted, opacity: onPrimary ? 0.85 : 1 }}>
              {t('mediaExpired')}
            </Text>
          ) : (
            <video controls src={message.fileUrl} style={{ maxWidth: '100%', borderRadius: 8 }} />
          ))}
        {message.messageType === 'file' &&
          (expired || !message.fileUrl ? (
            <Text size="sm" style={{ color: onPrimary ? 'var(--mantine-color-white)' : agentMuted, opacity: onPrimary ? 0.85 : 1 }}>
              {t('mediaExpired')}
            </Text>
          ) : (
            <Anchor
              href={message.fileUrl}
              target="_blank"
              rel="noreferrer"
              size="sm"
              underline="always"
              style={{ color: onPrimary ? 'var(--mantine-color-white)' : agentFg }}
            >
              {message.content || t('downloadFile')}
            </Anchor>
          ))}
        <Group justify="space-between" align="center" gap="xs" mt={6} wrap="nowrap">
          <Text
            size="xs"
            style={{
              color: onPrimary ? 'var(--mantine-color-white)' : agentMuted,
              opacity: onPrimary ? 0.85 : 1,
            }}
          >
            {new Intl.DateTimeFormat(undefined, {
              year: 'numeric',
              month: 'numeric',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }).format(new Date(message.createdAt))}
          </Text>
          {isCustomer && (
            <Tooltip label={t('deleteMessage')}>
              <ActionIcon
                id={`support-delete-message-${message.id}`}
                size="sm"
                variant="transparent"
                c="white"
                loading={deleteMutation.isPending}
                onClick={() => void handleDelete()}
                aria-label={t('deleteMessageAria')}
              >
                <IconTrash size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Paper>
    </Box>
  );
}

export function SupportThread({ conversation, messages, isLive = false }: Props) {
  const t = useTranslations('support');

  if (!conversation) {
    return (
      <Paper
        withBorder
        h="100%"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Text c="dimmed">{t('selectOrStart')}</Text>
      </Paper>
    );
  }

  return (
    <Paper withBorder h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
      <Group
        p="sm"
        gap="sm"
        style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
      >
        <Text fw={600} style={{ flex: 1 }} lineClamp={1}>
          {conversation.title || t('untitledChat')}
        </Text>
        {conversation.supportCategory && (
          <Badge variant="light" color="gray" size="sm">
            {conversation.supportCategory.toUpperCase()}
          </Badge>
        )}
        <Badge
          variant="outline"
          color={conversation.status === 'open' ? 'green' : 'gray'}
          size="sm"
          leftSection={
            <Box
              component="span"
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                backgroundColor:
                  conversation.status === 'open'
                    ? 'var(--mantine-color-green-6)'
                    : 'var(--mantine-color-gray-5)',
                display: 'inline-block',
              }}
            />
          }
        >
          {conversation.status === 'open' ? t('open') : t('closed')}
        </Badge>
        {isLive && (
          <Badge id="support-live-badge" variant="light" color="green" size="sm">
            {t('live')}
          </Badge>
        )}
      </Group>
      <ScrollArea style={{ flex: 1 }} p="md" type="auto">
        {messages.length === 0 ? (
          <Text c="dimmed" ta="center" mt="xl">
            {t('noMessagesYet')}
          </Text>
        ) : (
          <Stack gap="sm">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} conversationId={conversation.id} />
            ))}
          </Stack>
        )}
      </ScrollArea>
    </Paper>
  );
}

'use client';

import { ActionIcon, Box, Group, Paper, ScrollArea, Stack, Text, Badge } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import type { SupportConversation } from '@/types/support';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

type Props = {
  conversations: SupportConversation[];
  selectedId: string | null;
  unreadIds: Set<string>;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  creating: boolean;
};

export function SupportConversationList({
  conversations,
  selectedId,
  unreadIds,
  onSelect,
  onNewChat,
  creating,
}: Props) {
  const t = useTranslations('support');
  const { primary, error } = useThemeColors();

  return (
    <Paper withBorder h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
      <Group justify="space-between" p="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
        <Text fw={600}>{t('chats')}</Text>
        <ActionIcon
          id="support-new-chat-list"
          color="primary"
          variant="filled"
          radius="md"
          size="md"
          aria-label={t('newChat')}
          loading={creating}
          onClick={onNewChat}
          style={{ boxShadow: 'var(--mantine-shadow-sm)' }}
        >
          <IconPlus size={18} />
        </ActionIcon>
      </Group>
      <ScrollArea style={{ flex: 1 }} type="auto">
        {conversations.length === 0 ? (
          <Text c="dimmed" size="sm" p="md">
            {t('noChatsYet')}
          </Text>
        ) : (
          <Stack gap={0}>
            {conversations.map((c) => {
              const selected = c.id === selectedId;
              const closed = c.status === 'closed';
              const unread = unreadIds.has(c.id);
              return (
                <Box
                  key={c.id}
                  id={`support-chat-row-${c.id}`}
                  p="sm"
                  onClick={() => onSelect(c.id)}
                  style={{
                    cursor: 'pointer',
                    opacity: closed ? 0.65 : 1,
                    backgroundColor: selected ? `${primary}18` : undefined,
                    borderLeft: selected ? `3px solid ${primary}` : '3px solid transparent',
                    borderBottom: '1px solid var(--mantine-color-default-border)',
                  }}
                >
                  <Group justify="space-between" wrap="nowrap" gap="xs">
                    <Box style={{ minWidth: 0, flex: 1 }}>
                      <Text size="sm" fw={selected ? 600 : 500} lineClamp={1}>
                        {c.title || t('untitledChat')}
                      </Text>
                      <Group gap={6} mt={4}>
                        {c.supportCategory && (
                          <Badge size="xs" variant="light" color="gray">
                            {c.supportCategory}
                          </Badge>
                        )}
                        {closed && (
                          <Badge size="xs" variant="outline" color="gray">
                            {t('closed')}
                          </Badge>
                        )}
                      </Group>
                    </Box>
                    {unread && (
                      <Box
                        aria-label={t('unread')}
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          backgroundColor: error,
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </Group>
                </Box>
              );
            })}
          </Stack>
        )}
      </ScrollArea>
    </Paper>
  );
}

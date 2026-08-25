'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Paper,
  Skeleton,
  Stack,
  Text,
  Title,
  useMantineTheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconArrowLeft, IconHeadset } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  formatNewSupportChatTitle,
  getSupportMonthKeys,
  useCreateSupportConversation,
  useMarkSupportConversationRead,
  useNoteSupportAgentActivity,
  useSupportConversations,
  useSupportCoverage,
  useSupportMessages,
  useSupportMinutesSummary,
  useSupportUnreadSummary,
} from '@/hooks/api/useSupport';
import { useAuth } from '@/hooks/useAuth';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { SupportConversationList } from '@/components/features/support/SupportConversationList';
import { SupportThread } from '@/components/features/support/SupportThread';
import { SupportComposer } from '@/components/features/support/SupportComposer';
import { SupportCoverageBanner } from '@/components/features/support/SupportCoverageBanner';
import { SupportMinutesHeader } from '@/components/features/support/SupportMinutesHeader';
import { useSupportThreadRealtime } from '@/components/features/support/useSupportThreadRealtime';
import type { SupportMessage } from '@/types/support';

export default function SupportPage() {
  const t = useTranslations('support');
  const theme = useMantineTheme();
  const { error: errorColor } = useThemeColors();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const isOnline = useOnlineStatus();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileShowThread, setMobileShowThread] = useState(false);

  const monthKeys = useMemo(() => getSupportMonthKeys(), []);
  const { data: coverage } = useSupportCoverage();
  const { data: thisMonth } = useSupportMinutesSummary(monthKeys.thisMonth);
  const { data: lastMonth } = useSupportMinutesSummary(monthKeys.lastMonth);
  const { data: unread } = useSupportUnreadSummary(!!branchId && isOnline);
  const { data: conversations = [], isLoading: loadingList } = useSupportConversations();
  const createConversation = useCreateSupportConversation();
  const markRead = useMarkSupportConversationRead();
  const noteAgent = useNoteSupportAgentActivity();

  const unreadIds = useMemo(
    () => new Set(unread?.conversationIds ?? []),
    [unread?.conversationIds],
  );

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const onRealtimeMessage = useCallback((_message: SupportMessage) => {
    // Cache invalidation happens inside the realtime hook.
  }, []);

  const { usePollFallback } = useSupportThreadRealtime(selectedId, onRealtimeMessage);

  const { data: messages = [], isLoading: loadingMessages } = useSupportMessages(selectedId, {
    refetchIntervalMs: selectedId && usePollFallback ? 5_000 : false,
  });

  const notedAgentIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    notedAgentIdsRef.current = new Set();
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || !usePollFallback || messages.length === 0) return;
    const latestAgent = [...messages].reverse().find((m) => m.senderType === 'agent');
    if (!latestAgent || notedAgentIdsRef.current.has(latestAgent.id)) return;
    notedAgentIdsRef.current.add(latestAgent.id);
    void noteAgent.mutateAsync({
      conversationId: selectedId,
      at: latestAgent.createdAt,
    });
  }, [messages, noteAgent, selectedId, usePollFallback]);

  const openConversation = (id: string) => {
    setSelectedId(id);
    setMobileShowThread(true);
    void markRead.mutateAsync(id).catch(() => {
      // Unread badge may lag; chat still opens.
    });
  };

  const handleNewChat = async () => {
    try {
      const created = await createConversation.mutateAsync(formatNewSupportChatTitle());
      openConversation(created.id);
    } catch (e) {
      notifications.show({
        title: t('errorTitle'),
        message: e instanceof Error ? e.message : t('createFailed'),
        color: errorColor,
      });
    }
  };

  if (!isOnline) {
    return (
      <>
        <div className="page-title-bar">
          <Title order={1}>{t('title')}</Title>
        </div>
        <Box mt={60} px="md" py="xl">
          <Paper withBorder p="xl" ta="center">
            <IconHeadset size={40} style={{ opacity: 0.5 }} />
            <Text mt="md" fw={600}>
              {t('offlineTitle')}
            </Text>
            <Text c="dimmed" size="sm" mt="xs">
              {t('offlineBody')}
            </Text>
          </Paper>
        </Box>
      </>
    );
  }

  if (!branchId) {
    return (
      <>
        <div className="page-title-bar">
          <Title order={1}>{t('title')}</Title>
        </div>
        <Box mt={60} px="md" py="xl">
          <Text c="dimmed">{t('needBranch')}</Text>
        </Box>
      </>
    );
  }

  const listPane = (
    <SupportConversationList
      conversations={conversations}
      selectedId={selectedId}
      unreadIds={unreadIds}
      onSelect={openConversation}
      onNewChat={() => void handleNewChat()}
      creating={createConversation.isPending}
    />
  );

  const threadPane = (
    <Stack gap="sm" h="100%" style={{ minHeight: 0 }}>
      {isMobile && mobileShowThread && (
        <Group>
          <ActionIcon
            id="support-back-to-list"
            variant="subtle"
            onClick={() => setMobileShowThread(false)}
            aria-label={t('backToList')}
          >
            <IconArrowLeft size={18} />
          </ActionIcon>
          <Text size="sm" fw={500}>
            {t('chats')}
          </Text>
        </Group>
      )}
      <Box style={{ flex: 1, minHeight: 0 }}>
        {loadingMessages && selectedId ? (
          <Paper withBorder h="100%" p="md">
            <Stack gap="md">
              <Skeleton height={18} width="40%" radius="sm" />
              <Group justify="flex-start">
                <Skeleton height={56} width="55%" radius="md" />
              </Group>
              <Group justify="flex-end">
                <Skeleton height={44} width="45%" radius="md" />
              </Group>
              <Group justify="flex-start">
                <Skeleton height={64} width="60%" radius="md" />
              </Group>
              <Group justify="flex-end">
                <Skeleton height={40} width="35%" radius="md" />
              </Group>
            </Stack>
          </Paper>
        ) : (
          <SupportThread
            conversation={selected}
            messages={messages}
            isLive={!!selected && selected.status === 'open'}
          />
        )}
      </Box>
      <SupportComposer
        conversationId={selectedId}
        disabled={!selected || selected.status === 'closed'}
      />
    </Stack>
  );

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%" wrap="wrap" gap="sm">
          <Title order={1}>{t('title')}</Title>
          <SupportMinutesHeader thisMonth={thisMonth} lastMonth={lastMonth} />
        </Group>
      </div>
      <Box
        style={{
          marginTop: 60,
          paddingLeft: 'var(--mantine-spacing-md)',
          paddingRight: 'var(--mantine-spacing-md)',
          paddingTop: 'var(--mantine-spacing-sm)',
          paddingBottom: 'var(--mantine-spacing-xl)',
          height: 'calc(100vh - 120px)',
          minHeight: 420,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <SupportCoverageBanner coverage={coverage} />
        {loadingList && conversations.length === 0 ? (
          isMobile ? (
            <Paper withBorder p="md" style={{ flex: 1 }}>
              <Stack gap="sm">
                <Group justify="space-between">
                  <Skeleton height={20} width={80} radius="sm" />
                  <Skeleton height={28} width={28} circle />
                </Group>
                {[0, 1, 2, 3, 4].map((i) => (
                  <Box key={i} py="xs">
                    <Skeleton height={16} width="70%" radius="sm" mb={8} />
                    <Skeleton height={12} width="40%" radius="sm" />
                  </Box>
                ))}
              </Stack>
            </Paper>
          ) : (
            <Group
              align="stretch"
              gap="md"
              wrap="nowrap"
              style={{ flex: 1, minHeight: 0 }}
            >
              <Paper withBorder p="md" style={{ width: '36%', minWidth: 260 }}>
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Skeleton height={20} width={80} radius="sm" />
                    <Skeleton height={28} width={28} circle />
                  </Group>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Box key={i} py="xs">
                      <Skeleton height={16} width="70%" radius="sm" mb={8} />
                      <Skeleton height={12} width="40%" radius="sm" />
                    </Box>
                  ))}
                </Stack>
              </Paper>
              <Paper withBorder p="md" style={{ flex: 1 }}>
                <Stack gap="md">
                  <Skeleton height={18} width="40%" radius="sm" />
                  <Group justify="flex-start">
                    <Skeleton height={56} width="55%" radius="md" />
                  </Group>
                  <Group justify="flex-end">
                    <Skeleton height={44} width="45%" radius="md" />
                  </Group>
                  <Group justify="flex-start">
                    <Skeleton height={64} width="60%" radius="md" />
                  </Group>
                </Stack>
              </Paper>
            </Group>
          )
        ) : conversations.length === 0 && !selectedId ? (
          <Paper withBorder p="xl" ta="center" style={{ flex: 1 }}>
            <IconHeadset size={40} style={{ opacity: 0.5 }} />
            <Text mt="md" fw={600}>
              {t('emptyTitle')}
            </Text>
            <Text c="dimmed" size="sm" mt="xs" mb="md">
              {t('emptyBody')}
            </Text>
            <Button
              id="support-new-chat-empty"
              color="primary"
              loading={createConversation.isPending}
              onClick={() => void handleNewChat()}
            >
              {t('newChat')}
            </Button>
          </Paper>
        ) : isMobile ? (
          <Box style={{ flex: 1, minHeight: 0 }}>
            {mobileShowThread && selectedId ? threadPane : listPane}
          </Box>
        ) : (
          <Group
            align="stretch"
            gap="md"
            wrap="nowrap"
            style={{ flex: 1, minHeight: 0 }}
          >
            <Box style={{ width: '36%', minWidth: 260, minHeight: 0 }}>{listPane}</Box>
            <Box style={{ flex: 1, minHeight: 0 }}>{threadPane}</Box>
          </Group>
        )}
      </Box>
    </>
  );
}

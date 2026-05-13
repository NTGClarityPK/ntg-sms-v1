'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
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
  Textarea,
  Select,
  Modal,
  SimpleGrid,
  useMantineTheme,
  ActionIcon,
  Checkbox,
  SegmentedControl,
  Menu,
  alpha,
  useComputedColorScheme,
  rem,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from '@mantine/hooks';
import { useSearchParams } from 'next/navigation';
import {
  IconMessage,
  IconPlus,
  IconSend,
  IconArrowLeft,
  IconTrash,
  IconEraser,
  IconChevronDown,
} from '@tabler/icons-react';
import { useConversations, useConversation, useConversationMessages, useSendMessage, useMarkConversationRead, useCreateConversation, useDeleteConversation, useClearConversationMessages, useDeleteMessage } from '@/hooks/api/useMessages';
import { useClassSections } from '@/hooks/useClassSections';
import { useTenantBranches } from '@/hooks/useBranches';
import { useUsers } from '@/hooks/useUsers';
import { useSystemSetting } from '@/hooks/useSystemSettings';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { supabase } from '@/lib/supabase/client';
import type { MessageType, ConversationListItem, Message } from '@/types/messages';
import type { ThemeConfig } from '@/lib/theme/themeConfig';
import { ADMIN_BROADCAST_ROLE_NAMES } from '@/constants/admin-broadcast-roles';

type NewConversationMode = 'one_to_one' | 'broadcast_class' | 'broadcast_school';

export default function MessagesPage() {
  const t = useTranslations('messages');
  const tCommon = useTranslations('common');
  const searchParams = useSearchParams();
  const theme = useMantineTheme();
  const colors = useThemeColors();
  const themeConfig = (theme.other as any) as ThemeConfig | undefined;
  /** Must match MantineProvider — `useTheme()` state can desync per-component and break bubble colours */
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const isDarkUi = computedColorScheme === 'dark';
  const { user } = useAuth();
  const conversationIdFromUrl = searchParams?.get('conversation') ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(conversationIdFromUrl);
  const [body, setBody] = useState('');
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [newConvMode, setNewConvMode] = useState<NewConversationMode>('one_to_one');
  const [newRecipientUserId, setNewRecipientUserId] = useState<string | null>(null);
  const [newClassSectionId, setNewClassSectionId] = useState<string | null>(null);
  const [adminBroadcastScope, setAdminBroadcastScope] = useState<'tenant' | 'branch'>('tenant');
  const [adminBroadcastBranchId, setAdminBroadcastBranchId] = useState<string | null>(null);
  const [adminBroadcastRoles, setAdminBroadcastRoles] = useState<string[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [hoveredConversationId, setHoveredConversationId] = useState<string | null>(null);
  /** Own-message bubble hover / open menu — keeps chevron visible while dropdown is open (portal) */
  const [hoveredOwnBubbleId, setHoveredOwnBubbleId] = useState<string | null>(null);
  const [ownMessageMenuOpenId, setOwnMessageMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (conversationIdFromUrl) setSelectedId(conversationIdFromUrl);
  }, [conversationIdFromUrl]);

  const queryClient = useQueryClient();
  // Use useMemo to ensure stable reference for query key
  const messagesParams = useMemo(() => ({ page: 1, limit: 50 }), []);

  const { data: conversationsResponse, isLoading: loadingList } = useConversations({ limit: 50 });
  const conversations: ConversationListItem[] = conversationsResponse?.data ?? [];
  const meta = (conversationsResponse as { meta?: { total?: number; allConversationIds?: string[] } })?.meta;

  const { data: conversation, isLoading: loadingConv } = useConversation(selectedId);
  const { data: messagesResponse, isLoading: loadingMessages } = useConversationMessages(
    selectedId,
    messagesParams,
  );
  const messages: Message[] = messagesResponse?.data ?? [];
  const sendMessage = useSendMessage(selectedId);
  const markConversationRead = useMarkConversationRead(selectedId);
  const createConversation = useCreateConversation();
  const deleteConversation = useDeleteConversation();
  const clearMessages = useClearConversationMessages(selectedId);
  const deleteOwnMessage = useDeleteMessage(selectedId);

  // Auto-mark conversation as read when user is viewing it
  useEffect(() => {
    if (!selectedId || !user?.id) return;
    markConversationRead.mutate();
  }, [selectedId, user?.id]);

  // Realtime: new messages and read-status updates
  useEffect(() => {
    if (!selectedId || !user?.id) return;

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let testChannel: ReturnType<typeof supabase.channel> | null = null;
    let authListener: ReturnType<typeof supabase.auth.onAuthStateChange> | null = null;

    const setupSubscription = async () => {
      // Ensure we have a session and set auth for Realtime
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        console.error('[Realtime] ❌ No session available:', sessionError);
        return;
      }

      console.log('[Realtime] Session found, user:', session.user?.id);

      // CRITICAL: Set auth for Realtime BEFORE creating channels
      // This ensures RLS policies are evaluated with the correct user context
      try {
        await supabase.realtime.setAuth(session.access_token);
        console.log('[Realtime] ✅ Auth set for Realtime');
      } catch (authError) {
        console.error('[Realtime] ❌ Failed to set auth:', authError);
        return;
      }
      
      if (cancelled) return;

      console.log('[Realtime] Setting up subscription for conversation:', selectedId);

      // Listen for auth state changes and update Realtime auth
      authListener = supabase.auth.onAuthStateChange(async (event, newSession) => {
        if (newSession?.access_token) {
          console.log('[Realtime] Auth state changed, updating Realtime auth:', event);
          await supabase.realtime.setAuth(newSession.access_token);
        }
      });

      const channelName = `messages-${selectedId}`;

      // Test channel: dev only – subscribe to ALL messages to verify events (do not run in production)
      if (process.env.NODE_ENV !== 'production') {
        testChannel = supabase
          .channel(`test-all-${Date.now()}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
            },
            (payload) => {
              console.log('[Realtime] 🔍 TEST: Received ANY message INSERT:', payload);
              console.log('[Realtime] 🔍 TEST: Conversation ID:', payload.new?.conversation_id);
              console.log('[Realtime] 🔍 TEST: Full payload:', JSON.stringify(payload, null, 2));
            },
          )
          .subscribe((status, err) => {
            console.log('[Realtime] 🔍 TEST channel status:', status, err ? `Error: ${err.message}` : '');
          });
      }

      // Actual filtered subscription
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${selectedId}`,
          },
          (payload) => {
            console.log('[Realtime] ✅ postgres_changes INSERT event received:', payload);
            console.log('[Realtime] ✅ Full payload:', JSON.stringify(payload, null, 2));

            const row = payload.new as Record<string, unknown>;
            const conversationId = row.conversation_id as string;
            const newMessage: Message = {
              id: row.id as string,
              conversationId,
              senderId: row.sender_id as string,
              messageType: (row.message_type as MessageType) ?? 'other',
              subject: (row.subject as string) ?? '',
              body: (row.body as string) ?? '',
              createdAt: (row.created_at as string) ?? new Date().toISOString(),
              isDeleted: Boolean(row.deleted_at),
              isRead: false,
              senderName: undefined,
            };

            console.log('[Realtime] ✅ Processing new message:', newMessage.body);

            // Update all conversation-messages queries for this conversationId
            queryClient.setQueriesData(
              {
                predicate: (query) => {
                  const key = query.queryKey;
                  return (
                    Array.isArray(key) &&
                    key.length >= 2 &&
                    key[0] === 'conversation-messages' &&
                    key[1] === conversationId
                  );
                },
              },
              (prev: { data?: Message[]; meta?: unknown } | null | undefined) => {
                if (!prev) {
                  return { data: [newMessage], meta: undefined };
                }
                const list = prev.data ?? [];
                if (list.some((m) => m.id === newMessage.id)) return prev;

                // Remove matching optimistic message (temp-*) if present
                const now = Date.now();
                const withoutTemp = list.filter(
                  (m) =>
                    !(
                      m.id.startsWith('temp-') &&
                      m.senderId === newMessage.senderId &&
                      m.body === newMessage.body &&
                      Math.abs(now - new Date(m.createdAt).getTime()) < 5000
                    ),
                );
                // API returns newest first; prepend so new message appears at bottom after .reverse()
                const next = { ...prev, data: [newMessage, ...withoutTemp] };

                // Resolve sender name from users cache to avoid "User" / refetch
                const usersEntries = queryClient.getQueriesData<{ data?: Array<{ id: string; fullName?: string }> }>({
                  predicate: (q) => q.queryKey[0] === 'users',
                });
                let senderName: string | undefined;
                for (const [, res] of usersEntries) {
                  const list = res?.data ?? [];
                  const u = list.find((x) => x.id === newMessage.senderId);
                  if (u?.fullName) {
                    senderName = u.fullName;
                    break;
                  }
                }
                if (senderName) {
                  return {
                    ...next,
                    data: next.data!.map((m) =>
                      m.id === newMessage.id ? { ...m, senderName } : m,
                    ),
                  };
                }
                return next;
              },
            );
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${selectedId}`,
          },
          (payload) => {
            const row = payload.new as Record<string, unknown>;
            if (!row.deleted_at) return;
            const messageId = row.id as string;
            queryClient.setQueriesData(
              {
                predicate: (query) => {
                  const key = query.queryKey;
                  return (
                    Array.isArray(key) &&
                    key.length >= 2 &&
                    key[0] === 'conversation-messages' &&
                    key[1] === selectedId
                  );
                },
              },
              (prev: { data?: Message[]; meta?: unknown } | null | undefined) => {
                if (!prev?.data) return prev;
                return {
                  ...prev,
                  data: prev.data.map((msg) =>
                    msg.id === messageId
                      ? { ...msg, isDeleted: true, body: '', subject: '' }
                      : msg,
                  ),
                };
              },
            );
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'message_reads',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('[Realtime] message_reads UPDATE event received:', payload);
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
          },
        )
        .subscribe((status, err) => {
          console.log('[Realtime] Subscription status:', status, err ? `Error: ${err?.message}` : '');
          if (status === 'SUBSCRIBED') {
            console.log('[Realtime] ✅ Successfully subscribed to conversation:', selectedId);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            console.error('[Realtime] ❌ Subscription failed:', status, err);
          }
        });
    };

    setupSubscription();

    return () => {
      cancelled = true;
      if (authListener) {
        authListener.data.subscription.unsubscribe();
      }
      if (channel) {
        console.log('[Realtime] Cleaning up subscription for conversation:', selectedId);
        supabase.removeChannel(channel);
      }
      if (testChannel) {
        console.log('[Realtime] Cleaning up test channel');
        supabase.removeChannel(testChannel);
      }
    };
  }, [selectedId, user?.id, queryClient]);

  // Realtime: when a new message arrives in any of my conversations (including hidden), refetch list so it appears
  const allConversationIds = useMemo(() => new Set(meta?.allConversationIds ?? []), [meta?.allConversationIds]);
  useEffect(() => {
    if (!user?.id || allConversationIds.size === 0) return;

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupSubscription = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) return;
      try {
        await supabase.realtime.setAuth(session.access_token);
      } catch {
        return;
      }
      if (cancelled) return;

      channel = supabase
        .channel('messages-list-invalidate')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          (payload) => {
            const convId = (payload.new as { conversation_id?: string })?.conversation_id;
            if (convId && allConversationIds.has(convId)) {
              queryClient.invalidateQueries({ queryKey: ['conversations'] });
            }
          },
        )
        .subscribe();
    };

    setupSubscription();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient, allConversationIds]);

  const { data: commSetting } = useSystemSetting<{ teacher_student?: string; teacher_parent?: string }>('communication_direction');
  const { data: branchBroadcastSetting } = useSystemSetting<{
    allow_admin_assistant?: boolean;
    allow_principal?: boolean;
  }>('communication_branch_broadcast');
  const teacherStudentBoth = (commSetting?.data?.value?.teacher_student ?? 'both') === 'both';
  const teacherParentBoth = (commSetting?.data?.value?.teacher_parent ?? 'both') === 'both';

  const currentBranchId = user?.currentBranch?.id;

  const messagingStaffRoleNames = useMemo(
    () =>
      new Set([
        'class_teacher',
        'subject_teacher',
        'principal',
        'school_admin',
        'academic_coordinator',
        'guidance_counselor',
        'admin_assistant',
        'super_admin',
      ]),
    [],
  );

  const hasStaffMessagingRoleOnBranch = useMemo(() => {
    if (!currentBranchId || !user?.roles?.length) return false;
    return user.roles.some(
      (r) =>
        r.branchId === currentBranchId &&
        messagingStaffRoleNames.has((r.roleName ?? '').toLowerCase()),
    );
  }, [user?.roles, currentBranchId, messagingStaffRoleNames]);

  const isSuperAdminUser = useMemo(
    () => user?.roles?.some((r) => (r.roleName ?? '').toLowerCase() === 'super_admin') ?? false,
    [user?.roles],
  );

  const hasMessagingPrivilegedStaff = hasStaffMessagingRoleOnBranch || isSuperAdminUser;

  const isStudentOnBranch = useMemo(() => {
    if (!currentBranchId || !user?.roles?.length) return false;
    return user.roles.some(
      (r) => r.branchId === currentBranchId && (r.roleName ?? '').toLowerCase() === 'student',
    );
  }, [user?.roles, currentBranchId]);

  const isParentOnBranch = useMemo(() => {
    if (!currentBranchId || !user?.roles?.length) return false;
    return user.roles.some(
      (r) => r.branchId === currentBranchId && (r.roleName ?? '').toLowerCase() === 'parent',
    );
  }, [user?.roles, currentBranchId]);

  const canInitiateOrReplyMessaging =
    hasMessagingPrivilegedStaff ||
    (isStudentOnBranch && teacherStudentBoth) ||
    (isParentOnBranch && teacherParentBoth);

  const canReply = canInitiateOrReplyMessaging;

  const { data: classSectionsResponse } = useClassSections({ limit: 200, minimal: true });
  const classSectionsList = (classSectionsResponse as { data?: Array<{ id: string; className?: string; sectionName?: string }> })?.data ?? [];
  const { data: usersResponse } = useUsers({ limit: 200 });
  const usersList = (usersResponse as { data?: Array<{ id: string; email?: string; fullName?: string }> })?.data ?? [];
  const { data: tenantBranchesPayload } = useTenantBranches();
  const tenantBranches = tenantBranchesPayload?.data ?? [];
  const canTenantWideBroadcast = useMemo(() => {
    if (!currentBranchId || !user?.roles?.length) return false;
    return user.roles.some(
      (r) =>
        r.branchId === currentBranchId && (r.roleName ?? '').toLowerCase() === 'school_admin',
    );
  }, [user?.roles, currentBranchId]);

  const hasPrincipalOnBranch = useMemo(() => {
    if (!currentBranchId || !user?.roles?.length) return false;
    return user.roles.some(
      (r) => r.branchId === currentBranchId && (r.roleName ?? '').toLowerCase() === 'principal',
    );
  }, [user?.roles, currentBranchId]);

  const hasAdminAssistantOnBranch = useMemo(() => {
    if (!currentBranchId || !user?.roles?.length) return false;
    return user.roles.some(
      (r) => r.branchId === currentBranchId && (r.roleName ?? '').toLowerCase() === 'admin_assistant',
    );
  }, [user?.roles, currentBranchId]);

  const allowDelegatedPrincipal = Boolean(branchBroadcastSetting?.data?.value?.allow_principal);
  const allowDelegatedAdminAssistant = Boolean(branchBroadcastSetting?.data?.value?.allow_admin_assistant);

  const canDelegatedBranchBroadcast = useMemo(
    () =>
      (hasPrincipalOnBranch && allowDelegatedPrincipal) ||
      (hasAdminAssistantOnBranch && allowDelegatedAdminAssistant),
    [hasPrincipalOnBranch, allowDelegatedPrincipal, hasAdminAssistantOnBranch, allowDelegatedAdminAssistant],
  );

  const canSchoolBroadcast = canTenantWideBroadcast || canDelegatedBranchBroadcast;

  const newConversationTypeOptions = useMemo(() => {
    const opts: { value: NewConversationMode; label: string }[] = [];
    if (canInitiateOrReplyMessaging) {
      opts.push({ value: 'one_to_one', label: t('oneToOne') });
    }
    if (hasMessagingPrivilegedStaff) {
      opts.push({ value: 'broadcast_class', label: t('broadcastToClass') });
    }
    if (canSchoolBroadcast) {
      opts.push({ value: 'broadcast_school', label: t('broadcastWholeSchool') });
    }
    return opts;
  }, [t, canInitiateOrReplyMessaging, hasMessagingPrivilegedStaff, canSchoolBroadcast]);

  const canOpenNewConversationModal = newConversationTypeOptions.length > 0;

  useEffect(() => {
    if (!newConversationOpen || newConversationTypeOptions.length === 0) return;
    const allowed = new Set(newConversationTypeOptions.map((o) => o.value));
    if (!allowed.has(newConvMode)) {
      const first = newConversationTypeOptions[0]?.value;
      if (first) setNewConvMode(first);
    }
  }, [newConversationOpen, newConversationTypeOptions, newConvMode]);

  useEffect(() => {
    if (newConvMode !== 'broadcast_school') return;
    if (!canTenantWideBroadcast && currentBranchId) {
      setAdminBroadcastScope('branch');
      setAdminBroadcastBranchId(currentBranchId);
    }
  }, [newConvMode, canTenantWideBroadcast, currentBranchId]);

  const adminBroadcastRoleCheckboxData = useMemo(() => {
    const labelFor = (role: (typeof ADMIN_BROADCAST_ROLE_NAMES)[number]) => {
      switch (role) {
        case 'student':
          return tCommon('roleName.student');
        case 'parent':
          return tCommon('roleName.parent');
        case 'class_teacher':
          return tCommon('roleName.class_teacher');
        case 'subject_teacher':
          return tCommon('roleName.subject_teacher');
        case 'academic_coordinator':
          return tCommon('roleName.academic_coordinator');
        case 'guidance_counselor':
          return tCommon('roleName.guidance_counselor');
        case 'principal':
          return tCommon('roleName.principal');
        case 'school_admin':
          return tCommon('roleName.school_admin');
        case 'admin_assistant':
          return tCommon('roleName.admin_assistant');
        case 'super_admin':
          return tCommon('roleName.super_admin');
        default:
          return role;
      }
    };
    return ADMIN_BROADCAST_ROLE_NAMES.map((role) => ({
      value: role,
      label: labelFor(role),
    }));
  }, [tCommon]);

  const handleSend = useCallback(() => {
    const trimmed = body.trim();
    if (!selectedId || !trimmed) return;
    
    // Clear input immediately for instant feedback
    setBody('');
    
    sendMessage.mutate(
      { body: trimmed },
      {
        onError: () => {
          // Restore input on error
          setBody(trimmed);
        },
      },
    );
  }, [selectedId, body, sendMessage]);

  const handleCreateConversation = useCallback(() => {
    if (newConvMode === 'one_to_one' && newRecipientUserId) {
      createConversation.mutate(
        { type: 'one_to_one', recipientUserId: newRecipientUserId },
        {
          onSuccess: (data) => {
            if (data?.id) {
              setNewConversationOpen(false);
              setNewRecipientUserId(null);
              setNewConvMode('one_to_one');
              setSelectedId(data.id);
              window.history.replaceState(null, '', `/messages?conversation=${data.id}`);
            }
          },
        },
      );
    } else if (newConvMode === 'broadcast_class' && newClassSectionId) {
      createConversation.mutate(
        { type: 'broadcast', classSectionId: newClassSectionId },
        {
          onSuccess: (data) => {
            if (data?.id) {
              setNewConversationOpen(false);
              setNewClassSectionId(null);
              setNewConvMode('one_to_one');
              setSelectedId(data.id);
              window.history.replaceState(null, '', `/messages?conversation=${data.id}`);
            }
          },
        },
      );
    } else if (newConvMode === 'broadcast_school') {
      const scope = canTenantWideBroadcast ? adminBroadcastScope : 'branch';
      const branchIdForPayload =
        scope === 'branch'
          ? (canTenantWideBroadcast ? adminBroadcastBranchId : currentBranchId) ?? undefined
          : undefined;
      createConversation.mutate(
        {
          type: 'broadcast',
          adminBroadcastScope: scope,
          adminBroadcastBranchId: branchIdForPayload,
          adminBroadcastRoleNames: adminBroadcastRoles,
        },
        {
          onSuccess: (data) => {
            if (data?.id) {
              setNewConversationOpen(false);
              setNewClassSectionId(null);
              setNewConvMode('one_to_one');
              setAdminBroadcastScope('tenant');
              setAdminBroadcastBranchId(null);
              setAdminBroadcastRoles([]);
              setSelectedId(data.id);
              window.history.replaceState(null, '', `/messages?conversation=${data.id}`);
              const linked = data.linkedBroadcastConversationIds?.length ?? 0;
              if (linked > 0) {
                notifications.show({
                  title: t('broadcastCreatedTitle'),
                  message: t('broadcastCreatedOtherBranches', { count: linked }),
                  color: colors.primary,
                });
              }
            }
          },
        },
      );
    }
  }, [
    newConvMode,
    newRecipientUserId,
    newClassSectionId,
    createConversation,
    adminBroadcastScope,
    adminBroadcastBranchId,
    adminBroadcastRoles,
    canTenantWideBroadcast,
    currentBranchId,
    t,
    colors.primary,
  ]);

  const conversationTitle = conversation
    ? conversation.type === 'broadcast' && !conversation.classSectionId
      ? t('broadcastWholeSchool')
      : conversation.type === 'broadcast' && (conversation.className || conversation.sectionName)
        ? `${conversation.className ?? ''} ${conversation.sectionName ?? ''}`.trim()
        : conversation.participants?.map((p) => p.fullName).filter(Boolean).join(', ') || t('conversation')
    : '';

  const isOwnMessage = (m: Message) => m.senderId === user?.id;

  const isMobile = useMediaQuery('(max-width: 767px)');
  const handleBackToList = useCallback(() => {
    setSelectedId(null);
    window.history.replaceState(null, '', '/messages');
  }, []);

  // Scroll to bottom when messages change (including new Realtime messages)
  useEffect(() => {
    if (messages.length > 0) {
      // Small delay to ensure DOM has updated
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages.length, messages.map((m) => m.id).join(',')]);

  const chatHeight = isMobile ? 'calc(100vh - 120px)' : 480;
  const listHeight = isMobile ? 'calc(100vh - 120px)' : 480;

  const conversationRowStyles = useMemo(() => {
    const selectedBg =
      themeConfig?.components?.navbar?.activeBackground ??
      (isDarkUi ? theme.colors.dark[6] : theme.colors.blue[0]);
    const hoverBg =
      themeConfig?.components?.navbar?.hoverBackground ??
      (isDarkUi ? theme.colors.dark[5] : theme.colors.gray[0]);
    const selectedText =
      themeConfig?.components?.navbar?.activeTextColor ??
      (isDarkUi ? theme.white : theme.black);
    const hoverText =
      themeConfig?.components?.navbar?.hoverTextColor ?? theme.white;

    return { selectedBg, hoverBg, selectedText, hoverText };
  }, [
    themeConfig,
    isDarkUi,
    theme.colors.dark,
    theme.colors.blue,
    theme.colors.gray,
    theme.black,
    theme.white,
  ]);

  /** Outgoing bubbles: theme greens — black body copy reads clearly on pale green (primaryDark looked dull in light UI) */
  const ownBubblePalette = useMemo(() => {
    const cfg = themeConfig?.colors;
    const ink = cfg?.pureBlack ?? theme.black;
    if (cfg) {
      return {
        background: isDarkUi ? cfg.primaryLight : cfg.primaryLightest,
        foreground: ink,
        foregroundMuted: alpha(ink, isDarkUi ? 0.72 : 0.58),
      };
    }
    return {
      background: isDarkUi ? theme.colors.primary[5] : theme.colors.primary[1],
      foreground: theme.black,
      foregroundMuted: alpha(theme.black, isDarkUi ? 0.72 : 0.58),
    };
  }, [themeConfig?.colors, isDarkUi, theme.colors.primary, theme.black]);

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          {isMobile && selectedId ? (
            <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
              <ActionIcon
                variant="subtle"
                size="lg"
                aria-label={t('backToConversations')}
                onClick={handleBackToList}
              >
                <IconArrowLeft size={20} />
              </ActionIcon>
              <Title order={1} lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
                {conversationTitle || t('chat')}
              </Title>
              <ActionIcon
                variant="subtle"
                color="red"
                size="lg"
                aria-label={t('clearChatAria')}
                onClick={() => setClearConfirmOpen(true)}
              >
                <IconEraser size={18} />
              </ActionIcon>
            </Group>
          ) : (
            <>
              <Title order={1}>{t('title')}</Title>
              {canOpenNewConversationModal ? (
                <Button
                  leftSection={<IconPlus size={18} />}
                  onClick={() => setNewConversationOpen(true)}
                >
                  {t('newConversation')}
                </Button>
              ) : null}
            </>
          )}
        </Group>
      </div>

      <div
        style={{
          marginTop: isMobile ? '60px' : '60px',
          padding: isMobile ? 'var(--mantine-spacing-xs)' : 'var(--mantine-spacing-md)',
        }}
      >
        <Paper withBorder p={0}>
          <SimpleGrid
            cols={isMobile ? 1 : 2}
            spacing={0}
            style={{
              minHeight: isMobile ? undefined : 480,
              display: isMobile && selectedId ? 'block' : undefined,
            }}
          >
            {/* Conversation list - hidden on mobile when a conversation is open */}
            <Box
              style={{
                borderRight: isMobile ? 'none' : '1px solid var(--mantine-color-default-border)',
                display: isMobile && selectedId ? 'none' : undefined,
              }}
            >
              <ScrollArea h={isMobile && !selectedId ? listHeight : 480} type="auto">
                {loadingList ? (
                  <Stack p="md" gap="sm">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} height={56} radius="sm" />
                    ))}
                  </Stack>
                ) : conversations.length === 0 ? (
                  <Stack align="center" justify="center" p="xl" h={400}>
                    <IconMessage size={48} style={{ opacity: 0.3 }} />
                    <Text c="dimmed">{t('noConversationsYet')}</Text>
                    {canOpenNewConversationModal ? (
                      <Button variant="light" onClick={() => setNewConversationOpen(true)}>
                        {t('startConversation')}
                      </Button>
                    ) : null}
                  </Stack>
                ) : (
                  <Stack gap={0}>
                    {conversations.map((c) => {
                      const isRowSelected = selectedId === c.id;
                      const isRowHovered = hoveredConversationId === c.id && !isRowSelected;
                      const cfgColors = themeConfig?.colors;
                      const selectedLightInk = cfgColors?.pureBlack ?? cfgColors?.text ?? theme.black;
                      const rowTitleColor = isRowSelected
                        ? isDarkUi
                          ? conversationRowStyles.selectedText
                          : selectedLightInk
                        : isRowHovered
                          ? conversationRowStyles.hoverText
                          : (cfgColors?.text ?? theme.black);
                      const rowPreviewColor = isRowSelected
                        ? isDarkUi
                          ? (cfgColors?.textMuted ?? theme.colors.gray[6])
                          : alpha(selectedLightInk, 0.82)
                        : isRowHovered
                          ? alpha(conversationRowStyles.hoverText, 0.88)
                          : (cfgColors?.textMuted ?? theme.colors.gray[6]);
                      return (
                      <Box
                        key={c.id}
                        p="sm"
                        style={{
                          cursor: 'pointer',
                          backgroundColor: isRowSelected
                            ? conversationRowStyles.selectedBg
                            : isRowHovered
                              ? conversationRowStyles.hoverBg
                              : undefined,
                        }}
                        onClick={() => {
                          setSelectedId(c.id);
                          window.history.replaceState(null, '', `/messages?conversation=${c.id}`);
                        }}
                        onMouseEnter={() => setHoveredConversationId(c.id)}
                        onMouseLeave={() => setHoveredConversationId(null)}
                      >
                        <Group justify="space-between" wrap="nowrap" gap="xs">
                          {/* Box not Text — DynamicThemeProvider sets .mantine-Text-root { color: … !important } */}
                          <Box
                            component="span"
                            fz="sm"
                            fw={isRowSelected ? 600 : 400}
                            style={{
                              flex: 1,
                              minWidth: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              color: rowTitleColor,
                            }}
                          >
                            {c.type === 'broadcast'
                              ? !c.classSectionId
                                ? t('broadcastWholeSchool')
                                : `${c.className ?? ''} ${c.sectionName ?? ''}`.trim() || t('broadcast')
                              : c.participantNames?.join(', ') || t('conversation')}
                          </Box>
                          <Group gap={4} wrap="nowrap" onClick={(e) => e.stopPropagation()}>
                            {c.unreadCount > 0 && (
                              <Badge size="sm" color="primary" variant="filled">
                                {c.unreadCount}
                              </Badge>
                            )}
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              size="sm"
                              aria-label={t('deleteConversationAria')}
                              onClick={() => setDeleteConfirmId(c.id)}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Group>
                        </Group>
                        {(c.lastMessagePreview || c.lastMessageDeleted) && (
                          <Box
                            fz="xs"
                            mt={4}
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              color: rowPreviewColor,
                              fontStyle: c.lastMessageDeleted ? 'italic' : undefined,
                            }}
                          >
                            {c.lastMessageDeleted ? t('messageDeleted') : c.lastMessagePreview}
                          </Box>
                        )}
                      </Box>
                      );
                    })}
                  </Stack>
                )}
              </ScrollArea>
            </Box>

            {/* Chat pane - on mobile hidden when no conversation selected */}
            <Box style={{ display: isMobile && !selectedId ? 'none' : undefined }}>
              {!selectedId ? (
                <Stack align="center" justify="center" h={480} p="xl">
                  <IconMessage size={64} style={{ opacity: 0.2 }} />
                  <Text c="dimmed">{t('selectOrStart')}</Text>
                </Stack>
              ) : (
                <Stack gap={0} h={isMobile ? chatHeight : 480} style={{ flex: 1, minHeight: 0 }}>
                  {/* Conversation title - hidden on mobile (shown in title bar with back button) */}
                  {!isMobile && (
                    <Box p="md" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
                      <Group justify="space-between" wrap="nowrap">
                        {loadingConv ? (
                          <Skeleton height={24} width="60%" />
                        ) : (
                          <Text fw={600}>{conversationTitle}</Text>
                        )}
                        <Button
                          variant="subtle"
                          color="red"
                          size="xs"
                          leftSection={<IconEraser size={14} />}
                          onClick={() => setClearConfirmOpen(true)}
                        >
                          {t('clearChat')}
                        </Button>
                      </Group>
                    </Box>
                  )}
                  <ScrollArea flex={1} type="auto" style={isMobile ? { flex: 1, minHeight: 0 } : undefined} viewportProps={{ style: { maxHeight: isMobile ? undefined : 320, minHeight: isMobile ? 200 : undefined } }}>
                    <Stack p="md" gap="xs">
                      {loadingMessages ? (
                        <Skeleton height={120} />
                      ) : messages.length === 0 ? (
                        <Text size="sm" c="dimmed" ta="center" py="xl">
                          {t('noMessagesYet')}
                        </Text>
                      ) : (
                        [...messages].reverse().map((m) => {
                          const own = isOwnMessage(m);
                          return (
                            <Box
                              key={m.id}
                              style={{
                                display: 'flex',
                                justifyContent: own ? 'flex-end' : 'flex-start',
                                alignSelf: own ? 'flex-end' : 'flex-start',
                                maxWidth: '85%',
                              }}
                              onMouseEnter={() => {
                                if (own && !m.isDeleted) setHoveredOwnBubbleId(m.id);
                              }}
                              onMouseLeave={() => setHoveredOwnBubbleId(null)}
                            >
                              <Paper
                                p="xs"
                                px="sm"
                                radius="lg"
                                withBorder={!own || Boolean(m.isDeleted)}
                                style={{
                                  position: 'relative',
                                  backgroundColor: m.isDeleted
                                    ? isDarkUi
                                      ? theme.colors.dark[6]
                                      : theme.colors.gray[1]
                                    : own
                                      ? ownBubblePalette.background
                                      : undefined,
                                  color:
                                    m.isDeleted || !own ? undefined : ownBubblePalette.foreground,
                                  borderBottomRightRadius: own ? 4 : theme.radius.lg,
                                  borderBottomLeftRadius: own ? theme.radius.lg : 4,
                                  ...(own && !m.isDeleted
                                    ? {
                                        display: 'grid',
                                        gridTemplateColumns: 'minmax(0, 1fr) auto',
                                        alignItems: 'start',
                                        /** Tight gutter: enough for descenders, not a second margin like sm */
                                        columnGap: rem(4),
                                      }
                                    : {}),
                                }}
                              >
                                {!m.isDeleted && !own && (
                                  <Text size="xs" fw={500} c="dimmed" mb={2}>
                                    {m.senderName ?? t('userFallback')}
                                  </Text>
                                )}
                                {m.isDeleted ? (
                                  <>
                                    <Box
                                      component="p"
                                      fz="sm"
                                      m={0}
                                      style={{
                                        fontStyle: 'italic',
                                        color: theme.colors.gray[isDarkUi ? 5 : 6],
                                      }}
                                    >
                                      {t('messageDeleted')}
                                    </Box>
                                    <Box
                                      component="p"
                                      fz="xs"
                                      mt={4}
                                      m={0}
                                      style={{ color: theme.colors.gray[isDarkUi ? 6 : 7] }}
                                    >
                                      {new Date(m.createdAt).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </Box>
                                  </>
                                ) : own ? (
                                  <>
                                    <Box style={{ minWidth: 0 }}>
                                      <Box
                                        component="p"
                                        fz="sm"
                                        m={0}
                                        style={{
                                          whiteSpace: 'pre-wrap',
                                          wordBreak: 'break-word',
                                          color: ownBubblePalette.foreground,
                                        }}
                                      >
                                        {m.body || '-'}
                                      </Box>
                                      <Box
                                        component="p"
                                        fz="xs"
                                        mt={4}
                                        m={0}
                                        style={{ color: ownBubblePalette.foregroundMuted }}
                                      >
                                        {new Date(m.createdAt).toLocaleTimeString([], {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </Box>
                                    </Box>
                                    <Box style={{ flexShrink: 0, lineHeight: 1, marginTop: rem(2) }}>
                                      <Menu
                                        shadow="md"
                                        position="bottom-end"
                                        withinPortal
                                        onOpen={() => setOwnMessageMenuOpenId(m.id)}
                                        onClose={() => setOwnMessageMenuOpenId(null)}
                                      >
                                        <Menu.Target>
                                          <ActionIcon
                                            id={`messages-own-msg-menu-trigger-${m.id}`}
                                            variant="subtle"
                                            color="gray"
                                            size="xs"
                                            aria-label={t('messageActionsAria')}
                                            aria-haspopup="menu"
                                            aria-expanded={ownMessageMenuOpenId === m.id}
                                            style={{
                                              opacity:
                                                hoveredOwnBubbleId === m.id ||
                                                ownMessageMenuOpenId === m.id
                                                  ? 1
                                                  : 0,
                                              transition: 'opacity 120ms ease',
                                              pointerEvents:
                                                hoveredOwnBubbleId === m.id ||
                                                ownMessageMenuOpenId === m.id
                                                  ? 'auto'
                                                  : 'none',
                                            }}
                                          >
                                            <IconChevronDown size={14} stroke={2} />
                                          </ActionIcon>
                                        </Menu.Target>
                                        <Menu.Dropdown id={`messages-own-msg-menu-${m.id}`}>
                                          <Menu.Item
                                            id={`messages-own-msg-delete-${m.id}`}
                                            leftSection={<IconTrash size={14} />}
                                            color="red"
                                            onClick={() => setDeleteMessageId(m.id)}
                                          >
                                            {t('deleteOwnMessage')}
                                          </Menu.Item>
                                        </Menu.Dropdown>
                                      </Menu>
                                    </Box>
                                  </>
                                ) : (
                                  <>
                                    <Text
                                      size="sm"
                                      style={{
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                      }}
                                    >
                                      {m.body || '-'}
                                    </Text>
                                    <Text size="xs" c="dimmed" mt={4}>
                                      {new Date(m.createdAt).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </Text>
                                  </>
                                )}
                              </Paper>
                            </Box>
                          );
                        })
                      )}
                      <div ref={messagesEndRef} />
                    </Stack>
                  </ScrollArea>
                  {canReply && (
                    <Box p="sm" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
                      <Group gap="sm" align="flex-end" wrap="nowrap">
                        <Textarea
                          placeholder={t('typeMessagePlaceholder')}
                          value={body}
                          onChange={(e) => setBody(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSend();
                            }
                          }}
                          minRows={1}
                          maxRows={4}
                          autosize
                          style={{ flex: 1 }}
                          styles={{ input: { borderTopRightRadius: 0, borderBottomRightRadius: 0 } }}
                        />
                        <ActionIcon
                          size="lg"
                          variant="filled"
                          color="primary"
                          onClick={handleSend}
                          loading={sendMessage.isPending}
                          disabled={!body.trim()}
                          style={{ height: 36, width: 36 }}
                        >
                          <IconSend size={18} />
                        </ActionIcon>
                      </Group>
                    </Box>
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
          setNewConvMode('one_to_one');
          setAdminBroadcastScope('tenant');
          setAdminBroadcastBranchId(null);
          setAdminBroadcastRoles([]);
        }}
        title={t('newConversation')}
      >
        <Stack gap="md">
          <Select
            label={t('conversationType')}
            data={newConversationTypeOptions}
            value={newConvMode}
            onChange={(v) => {
              if (!v) return;
              const next = v as NewConversationMode;
              setNewConvMode(next);
              if (next !== 'broadcast_school') {
                setAdminBroadcastScope('tenant');
                setAdminBroadcastBranchId(null);
                setAdminBroadcastRoles([]);
              } else if (!canTenantWideBroadcast && currentBranchId) {
                setAdminBroadcastScope('branch');
                setAdminBroadcastBranchId(currentBranchId);
              }
            }}
          />
          {newConvMode === 'one_to_one' && (
            <Select
              label={t('selectUser')}
              placeholder={t('chooseUser')}
              searchable
              data={usersList.map((u) => ({
                value: u.id,
                label: u.fullName ?? u.email ?? u.id,
              }))}
              value={newRecipientUserId}
              onChange={setNewRecipientUserId}
            />
          )}
          {newConvMode === 'broadcast_class' && (
            <Select
              label={t('classSection')}
              placeholder={t('chooseClass')}
              searchable
              data={classSectionsList.map((cs) => ({
                value: cs.id,
                label: `${(cs as { className?: string }).className ?? ''} ${(cs as { sectionName?: string }).sectionName ?? ''}`.trim() || cs.id,
              }))}
              value={newClassSectionId}
              onChange={setNewClassSectionId}
            />
          )}
          {newConvMode === 'broadcast_school' && (
            <Stack gap="sm">
              <Text size="sm" fw={500}>
                {t('broadcastAudienceScope')}
              </Text>
              {canTenantWideBroadcast ? (
                <SegmentedControl
                  id="messages-admin-broadcast-scope"
                  value={adminBroadcastScope}
                  onChange={(v) => {
                    const next = v as 'tenant' | 'branch';
                    setAdminBroadcastScope(next);
                    if (next === 'tenant') setAdminBroadcastBranchId(null);
                  }}
                  data={[
                    { value: 'tenant', label: t('broadcastScopeAllBranches') },
                    { value: 'branch', label: t('broadcastScopeSpecificBranch') },
                  ]}
                />
              ) : (
                <Text size="sm" c="dimmed">
                  {t('branchBroadcastCurrentBranchOnly')}
                </Text>
              )}
              {adminBroadcastScope === 'branch' && canTenantWideBroadcast && (
                <Select
                  id="messages-admin-broadcast-branch"
                  label={t('broadcastSelectBranch')}
                  placeholder={t('broadcastSelectBranch')}
                  searchable
                  data={tenantBranches.map((b) => ({
                    value: b.id,
                    label: b.code ? `${b.name} (${b.code})` : b.name,
                  }))}
                  value={adminBroadcastBranchId}
                  onChange={setAdminBroadcastBranchId}
                />
              )}
              <Text size="sm" fw={500} mt="xs">
                {t('broadcastRecipientRoles')}
              </Text>
              <Checkbox.Group value={adminBroadcastRoles} onChange={setAdminBroadcastRoles}>
                <Stack gap="xs">
                  {adminBroadcastRoleCheckboxData.map((opt) => (
                    <Checkbox
                      key={opt.value}
                      id={`messages-admin-broadcast-role-${opt.value}`}
                      value={opt.value}
                      label={opt.label}
                    />
                  ))}
                </Stack>
              </Checkbox.Group>
            </Stack>
          )}
          <Group justify="flex-end" mt="md">
            <Button
              variant="default"
              onClick={() => {
                setNewConversationOpen(false);
                setNewRecipientUserId(null);
                setNewClassSectionId(null);
                setNewConvMode('one_to_one');
                setAdminBroadcastScope('tenant');
                setAdminBroadcastBranchId(null);
                setAdminBroadcastRoles([]);
              }}
            >
              {t('cancel')}
            </Button>
            <Button
              id="messages-modal-create-conversation"
              onClick={handleCreateConversation}
              loading={createConversation.isPending}
              disabled={
                (newConvMode === 'one_to_one' && !newRecipientUserId) ||
                (newConvMode === 'broadcast_class' && !newClassSectionId) ||
                (newConvMode === 'broadcast_school' &&
                  (adminBroadcastRoles.length === 0 ||
                    (canTenantWideBroadcast &&
                      adminBroadcastScope === 'branch' &&
                      !adminBroadcastBranchId)))
              }
            >
              {t('create')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        title={t('deleteConversationTitle')}
      >
        <Text size="sm" c="dimmed" mb="md">
          {t('deleteConversationMessage')}
        </Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={() => setDeleteConfirmId(null)}>
            {t('cancel')}
          </Button>
          <Button
            color="red"
            loading={deleteConversation.isPending}
            onClick={() => {
              if (deleteConfirmId) {
                deleteConversation.mutate(deleteConfirmId, {
                  onSuccess: () => {
                    setDeleteConfirmId(null);
                    if (selectedId === deleteConfirmId) {
                      setSelectedId(null);
                      window.history.replaceState(null, '', '/messages');
                    }
                  },
                });
              }
            }}
          >
            {t('delete')}
          </Button>
        </Group>
      </Modal>

      <Modal
        opened={deleteMessageId !== null}
        onClose={() => setDeleteMessageId(null)}
        title={t('deleteOwnMessageTitle')}
      >
        <Text size="sm" c="dimmed" mb="md">
          {t('deleteOwnMessageConfirm')}
        </Text>
        <Group justify="flex-end" gap="sm">
          <Button
            id="messages-delete-msg-cancel"
            variant="default"
            onClick={() => setDeleteMessageId(null)}
          >
            {t('cancel')}
          </Button>
          <Button
            id="messages-delete-msg-confirm"
            color="red"
            loading={deleteOwnMessage.isPending}
            onClick={() => {
              if (deleteMessageId) {
                deleteOwnMessage.mutate(deleteMessageId, {
                  onSuccess: () => setDeleteMessageId(null),
                });
              }
            }}
          >
            {t('deleteOwnMessage')}
          </Button>
        </Group>
      </Modal>

      <Modal
        opened={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        title={t('clearChatTitle')}
      >
        <Text size="sm" c="dimmed" mb="md">
          {t('clearChatMessage')}
        </Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={() => setClearConfirmOpen(false)}>
            {t('cancel')}
          </Button>
          <Button
            color="red"
            loading={clearMessages.isPending}
            onClick={() => {
              clearMessages.mutate(undefined, {
                onSuccess: () => setClearConfirmOpen(false),
              });
            }}
          >
            {t('clearAll')}
          </Button>
        </Group>
      </Modal>
    </>
  );
}

'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import type { Notification } from '@/types/notifications';
import { notifications as mantineNotifications } from '@mantine/notifications';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { playNotificationSound } from '@/lib/notifications/sound';

function rowToNotification(row: Record<string, unknown>): Notification {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    type: row.type as Notification['type'],
    title: row.title as string,
    body: row.body as string | undefined,
    data: row.data as Record<string, unknown> | undefined,
    isRead: Boolean(row.is_read),
    isCritical: row.is_critical != null ? Boolean(row.is_critical) : undefined,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
  };
}

/**
 * Subscribes to Supabase Realtime for the current user's notifications.
 * Updates React Query cache on INSERT and UPDATE so the notification dropdown
 * and unread count stay in sync without polling.
 */
export function useNotificationsRealtime(
  userId: string | undefined,
  options?: { alertsEnabled?: boolean },
) {
  const queryClient = useQueryClient();
  const colors = useThemeColors();
  const alertsEnabled = options?.alertsEnabled ?? true;
  const alertsEnabledRef = useRef<boolean>(alertsEnabled);

  alertsEnabledRef.current = alertsEnabled;

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let authListener: ReturnType<typeof supabase.auth.onAuthStateChange> | null = null;

    const setupSubscription = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) return;
      try {
        await supabase.realtime.setAuth(session.access_token);
      } catch {
        return;
      }
      if (cancelled) return;

      authListener = supabase.auth.onAuthStateChange(async (_event, newSession) => {
        if (newSession?.access_token) {
          await supabase.realtime.setAuth(newSession.access_token);
        }
      });

      channel = supabase
        .channel(`notifications-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const row = payload.new as Record<string, unknown>;
            const notification = rowToNotification(row);

            queryClient.setQueriesData(
              { predicate: (query) => query.queryKey[0] === 'notifications' && query.queryKey[1] === userId },
              (prev: { data?: Notification[]; meta?: { total: number } } | null | undefined) => {
                if (!prev) return { data: [notification], meta: { total: 1, page: 1, limit: 20, totalPages: 1 } };
                const list = prev.data ?? [];
                if (list.some((n) => n.id === notification.id)) return prev;
                return {
                  ...prev,
                  data: [notification, ...list],
                  meta: prev.meta ? { ...prev.meta, total: (prev.meta.total ?? 0) + 1 } : prev.meta,
                };
              },
            );

            if (!notification.isRead) {
              queryClient.setQueriesData(
                { queryKey: ['notifications', 'unread-count', userId] },
                (prev: number | undefined) => (typeof prev === 'number' ? prev + 1 : 1),
              );
            }
            queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
            queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count', userId] });

            // Alerts = toast + sound only. Realtime list/unread count updates above always run.
            if (alertsEnabledRef.current && !notification.isRead) {
              // Toast + sound alert (snackbar-style)
              // Note: sound may be blocked until the user interacts with the page at least once.
              mantineNotifications.show({
                title: notification.title,
                message: notification.body || 'You have a new notification.',
                color: notification.isCritical
                  ? colors.warning
                  : notification.type === 'message'
                    ? colors.info
                    : colors.primary,
                autoClose: 5000,
              });
              void playNotificationSound();
            }
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const row = payload.new as Record<string, unknown>;
            const notification = rowToNotification(row);

            queryClient.setQueriesData(
              { predicate: (query) => query.queryKey[0] === 'notifications' && query.queryKey[1] === userId },
              (prev: { data?: Notification[]; meta?: unknown } | null | undefined) => {
                if (!prev?.data) return prev;
                const list = prev.data.map((n) => (n.id === notification.id ? notification : n));
                return { ...prev, data: list };
              },
            );

            queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
            queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count', userId] });
          },
        )
        .subscribe(() => {});
    };

    setupSubscription();

    return () => {
      cancelled = true;
      if (authListener) authListener.data.subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId, queryClient, colors.info, colors.primary, colors.warning]);
}

'use client';

import { useAuth } from '@/hooks/useAuth';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useNotificationsRealtime } from '@/hooks/useNotificationsRealtime';
import { useNotificationAlertSettings } from '@/hooks/useNotificationAlertSettings';

/**
 * Renders nothing. Subscribes to Supabase Realtime for the current user's
 * notifications and updates React Query cache so the notification bell and
 * dropdown stay in sync. Mount inside portal layout when user is logged in.
 * Skipped while offline so reconnect/auth churn cannot tear down the shell.
 */
export function NotificationsRealtimeSubscription() {
  const { user } = useAuth();
  const isOnline = useOnlineStatus();
  const { alertsEnabled } = useNotificationAlertSettings(user?.id);
  useNotificationsRealtime(isOnline ? user?.id : undefined, { alertsEnabled });
  return null;
}

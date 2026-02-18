'use client';

import { useAuth } from '@/hooks/useAuth';
import { useNotificationsRealtime } from '@/hooks/useNotificationsRealtime';
import { useNotificationAlertSettings } from '@/hooks/useNotificationAlertSettings';

/**
 * Renders nothing. Subscribes to Supabase Realtime for the current user's
 * notifications and updates React Query cache so the notification bell and
 * dropdown stay in sync. Mount inside portal layout when user is logged in.
 */
export function NotificationsRealtimeSubscription() {
  const { user } = useAuth();
  const { alertsEnabled } = useNotificationAlertSettings(user?.id);
  useNotificationsRealtime(user?.id, { alertsEnabled });
  return null;
}

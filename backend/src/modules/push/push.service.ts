import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseConfig } from '../../common/config/supabase.config';
import * as webPush from 'web-push';

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
}

@Injectable()
export class PushService {
  private vapidPublicKey: string | undefined;
  private vapidPrivateKey: string | undefined;
  private initialized = false;

  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly configService: ConfigService,
  ) {
    this.vapidPublicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    this.vapidPrivateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    if (this.vapidPublicKey && this.vapidPrivateKey) {
      webPush.setVapidDetails(
        'mailto:support@example.com',
        this.vapidPublicKey,
        this.vapidPrivateKey,
      );
      this.initialized = true;
    }
  }

  /**
   * Register a push subscription for the current user.
   * Ensures one endpoint = one user: if this endpoint was previously registered
   * for another user (e.g. same device, different login), it is reassociated to
   * the current user so the sender never receives their own message push.
   */
  async subscribe(
    userId: string,
    endpoint: string,
    p256dh: string,
    auth: string,
  ): Promise<void> {
    const supabase = this.supabaseConfig.getClient();

    // Reassociate this endpoint with the current user only (prevents same device
    // receiving pushes for a different user, e.g. parent getting "message to admin").
    const { error: deleteError } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
      .neq('user_id', userId);

    if (deleteError) {
      throw new Error(
        deleteError instanceof Error ? deleteError.message : 'Failed to reassociate subscription',
      );
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          endpoint,
          p256dh: p256dh,
          auth,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,endpoint',
        },
      );
    if (error) {
      throw new Error(
        error instanceof Error ? error.message : 'Failed to save subscription',
      );
    }
  }

  async getSubscriptionsForUser(userId: string): Promise<
    Array<{
      endpoint: string;
      keys: { p256dh: string; auth: string };
    }>
  > {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId);
    if (error) {
      return [];
    }
    return (data as PushSubscriptionRow[]).map((row) => ({
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    }));
  }

  /**
   * Remove a push subscription by endpoint (e.g. after 410 Gone / 404 Not Found).
   */
  async removeSubscriptionByEndpoint(endpoint: string): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  }

  /**
   * Unsubscribe current user from push (remove subscription by endpoint for this user).
   */
  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint);
  }

  /**
   * Send Web Push to all subscriptions for a user. Fire-and-forget; errors are logged.
   * Subscriptions that return 410 Gone or 404 Not Found are removed from the database.
   */
  sendPushToUser(userId: string, payload: PushPayload): void {
    if (!this.initialized) return;
    this.getSubscriptionsForUser(userId)
      .then((subs) => {
        const body = JSON.stringify({
          title: payload.title,
          body: payload.body ?? '',
          url: payload.url ?? '/',
          tag: payload.tag ?? 'notification',
        });
        return Promise.allSettled(
          subs.map((sub) =>
            webPush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: sub.keys,
              },
              body,
              {
                TTL: 86400,
              },
            ),
          ),
        ).then((results) => ({ results, subs }));
      })
      .then(({ results, subs }) => {
        const toRemove: string[] = [];
        results.forEach((r, i) => {
          if (r.status === 'rejected') {
            const statusCode = (r.reason as { statusCode?: number } | undefined)?.statusCode;
            if (statusCode === 410 || statusCode === 404) {
              toRemove.push(subs[i].endpoint);
            } else {
              // eslint-disable-next-line no-console
              console.error('Push send failed:', r.reason);
            }
          }
        });
        toRemove.forEach((endpoint) => {
          this.removeSubscriptionByEndpoint(endpoint).catch(() => {});
        });
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Push send error:', err);
      });
  }

  /**
   * Send Web Push to multiple users. Fire-and-forget.
   */
  sendPushToUsers(
    userIds: string[],
    payload: PushPayload,
  ): void {
    userIds.forEach((userId) => this.sendPushToUser(userId, payload));
  }

  getVapidPublicKey(): string | undefined {
    return this.vapidPublicKey;
  }
}

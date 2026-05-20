import axios from 'axios';

export interface SubscriptionApiErrorPayload {
  code?: string;
  message?: string | string[];
  reasons?: string[];
  metric?: string;
  limit?: number;
  used?: number;
  feature?: string;
}

type BillingTranslateFn = (
  key: string,
  values?: Record<string, string | number>,
) => string;

const METRIC_I18N_KEYS: Record<string, string> = {
  branches: 'branches',
  students: 'students',
  staff: 'staff',
  classes: 'classes',
  storageMB: 'storage',
  monthlyReports: 'reports',
  monthlySMS: 'sms',
};

export function parseSubscriptionApiError(
  error: unknown,
): SubscriptionApiErrorPayload | null {
  if (!axios.isAxiosError(error)) return null;
  const data = error.response?.data;
  if (!data || typeof data !== 'object') return null;
  const err = (data as { error?: SubscriptionApiErrorPayload }).error;
  return err ?? null;
}

function formatDowngradeReasonLine(reason: string, t: BillingTranslateFn): string {
  const match = reason.match(/^(\w+): (\d+) exceeds \w+ limit of (\d+)$/);
  if (match) {
    const [, metric, used, limit] = match;
    const metricLabel = t(METRIC_I18N_KEYS[metric] ?? metric);
    return t('downgradeReasonExceeded', { metric: metricLabel, used, limit });
  }
  return reason;
}

/** User-facing message for subscription/billing API failures (checkout, portal, etc.). */
export function getSubscriptionApiErrorMessage(
  error: unknown,
  fallback: string,
  t?: BillingTranslateFn,
): string {
  const payload = parseSubscriptionApiError(error);

  if (payload?.code === 'DOWNGRADE_NOT_ALLOWED' && t) {
    const reasons = (payload.reasons ?? []).map((r) => formatDowngradeReasonLine(r, t));
    if (reasons.length > 0) {
      return `${t('downgradeNotAllowedTitle')}\n${reasons.join('\n')}`;
    }
  }

  if (payload?.message) {
    const text = Array.isArray(payload.message)
      ? payload.message.join(', ')
      : payload.message;
    if (payload.code === 'DOWNGRADE_NOT_ALLOWED' && payload.reasons?.length) {
      return `${text}\n${payload.reasons.join('\n')}`;
    }
    return text;
  }

  if (error instanceof Error && error.message && !isGenericAxiosMessage(error.message)) {
    return error.message;
  }

  return fallback;
}

function isGenericAxiosMessage(message: string): boolean {
  return /^Request failed with status code \d+$/i.test(message);
}

/** Title + optional detail for plan change notifications. */
export function getSubscriptionChangePlanErrorMessage(
  error: unknown,
  t: BillingTranslateFn,
): { title: string; message?: string } {
  const payload = parseSubscriptionApiError(error);
  const fallback = t('changeFailed');

  if (!payload) {
    if (error instanceof Error && error.message && !isGenericAxiosMessage(error.message)) {
      return { title: error.message };
    }
    return { title: fallback };
  }

  const baseMessage = Array.isArray(payload.message)
    ? payload.message.join(', ')
    : payload.message ?? fallback;

  switch (payload.code) {
    case 'DOWNGRADE_NOT_ALLOWED': {
      const lines = (payload.reasons ?? []).map((r) => formatDowngradeReasonLine(r, t));
      return {
        title: t('downgradeNotAllowedTitle'),
        message: lines.length > 0 ? lines.join('\n') : baseMessage,
      };
    }
    case 'SUBSCRIPTION_LIMIT': {
      const metric = payload.metric ?? '';
      const metricLabel = t(METRIC_I18N_KEYS[metric] ?? metric);
      return {
        title: t('subscriptionLimitTitle'),
        message: t('subscriptionLimitDetail', {
          metric: metricLabel,
          used: payload.used ?? 0,
          limit: payload.limit ?? 0,
        }),
      };
    }
    case 'SUBSCRIPTION_FEATURE':
      return {
        title: t('subscriptionFeatureTitle'),
        message: payload.feature
          ? t('subscriptionFeatureDetail', { feature: payload.feature })
          : baseMessage,
      };
    default:
      return { title: baseMessage || fallback };
  }
}

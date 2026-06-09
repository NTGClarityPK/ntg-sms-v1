/** Column names stripped from every exported row (case-insensitive match). */
export const DENYLIST_COLUMN_NAMES = new Set(
  [
    'password',
    'password_hash',
    'hashed_password',
    'pin_hash',
    'pin',
    'token',
    'refresh_token',
    'access_token',
    'api_key',
    'secret',
    'client_secret',
    'stripe_secret_key',
    'stripe_webhook_secret',
    'mfa_secret',
    'otp_secret',
    'invitation_token',
    'reset_token',
    'session_token',
    'private_key',
    'vapid_private_key',
    'vapid_public_key',
    'push_subscription',
    'encrypted_password',
    'public_stats_password',
  ].map((s) => s.toLowerCase()),
);

/** Tables never included in Phase 1 export. */
export const EXCLUDED_TABLES = new Set([
  'push_subscriptions',
  'assessment_draft_files',
  'fee_challan_generation_jobs',
  'id_card_generation_jobs',
  'school_data_export_logs',
  'audit_logs',
  'billing_payment_events',
]);

/** Subscription tables: metadata only with denylisted Stripe fields. */
export const STRIPE_FIELD_DENYLIST = new Set(
  [
    'stripe_customer_id',
    'stripe_subscription_id',
    'stripe_price_id',
    'stripe_checkout_session_id',
    'stripe_payment_intent_id',
    'stripe_invoice_id',
    'hosted_invoice_url',
    'pdf_storage_path',
  ].map((s) => s.toLowerCase()),
);

export const EXPORT_VERSION = '1.0';
export const EXPORT_RATE_LIMIT_HOURS = 24;
export const EXPORT_MAX_FAILURES_PER_HOUR = 10;
export const EXPORT_ROW_PAGE_SIZE = 1000;

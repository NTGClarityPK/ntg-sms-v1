/** Env keys for optional Nest cron jobs (`true` / `false`). */
export const CRON_JOB_ENV_KEYS = {
  invitationsExpireUnused: 'INVITATIONS_EXPIRE_UNUSED_JOB_ENABLED',
  substitutionReminders: 'SUBSTITUTION_REMINDERS_JOB_ENABLED',
  tenantDeletion: 'TENANT_DELETION_JOB_ENABLED',
  lateFeeApplication: 'LATE_FEE_JOB_ENABLED',
  subscriptionEndOfPeriod: 'SUBSCRIPTION_END_OF_PERIOD_JOB_ENABLED',
} as const;

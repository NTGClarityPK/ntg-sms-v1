import { Logger } from '@nestjs/common';

/**
 * Privileged (platform) access — migration notes
 *
 * Step A (this change): ALLOW_EMAIL_DOMAIN_PRIVILEGE_ESCALATION defaults to false.
 *   Assign the `super_admin` role via user_roles for real ops accounts before deploy.
 * Step B (future): remove the env flag and legacy email path entirely once no accounts rely on it.
 *
 * See docs/security/privileged-access-migration.md
 */

export const LEGACY_PRIVILEGE_EMAIL_SUFFIXES = [
  '@ntg.com',
  '@example.com',
  '@ntgclarity.com',
  '@superuser.com',
] as const;

const ENV_FLAG = 'ALLOW_EMAIL_DOMAIN_PRIVILEGE_ESCALATION';

export function isEmailDomainPrivilegeEscalationEnabled(): boolean {
  return process.env[ENV_FLAG] === 'true';
}

export function isSuperAdminRole(roles?: string[]): boolean {
  return (roles ?? []).some((r) => String(r).toLowerCase() === 'super_admin');
}

export function hasLegacyEmailDomainPrivilege(email?: string): boolean {
  if (!email) return false;
  const normalised = email.toLowerCase();
  return LEGACY_PRIVILEGE_EMAIL_SUFFIXES.some((suffix) => normalised.endsWith(suffix));
}

/**
 * Platform privilege: DB `super_admin` role, or (temporary) legacy email when env flag is on.
 * Inactive branch/tenant checks must still apply to privileged users (see BranchGuard).
 */
export function hasPrivilegedAccess(
  params: { email?: string; roles?: string[] },
  logger?: Logger,
): boolean {
  if (isSuperAdminRole(params.roles)) {
    return true;
  }

  if (
    isEmailDomainPrivilegeEscalationEnabled() &&
    hasLegacyEmailDomainPrivilege(params.email)
  ) {
    const log = logger ?? new Logger('PrivilegedAccess');
    log.warn(
      `Legacy email-domain privilege used for ${params.email} (set ${ENV_FLAG}=false and assign super_admin in user_roles)`,
    );
    return true;
  }

  return false;
}

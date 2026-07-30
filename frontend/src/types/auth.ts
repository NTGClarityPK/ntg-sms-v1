export interface Branch {
  id: string;
  tenantId?: string | null;
  name: string;
  code?: string | null;
  tenantDefaultLocale?: string | null;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  /**
   * Personal UI language override.
   * `null` means inherit the current tenant default.
   */
  preferredLocale?: string | null;
  /** Default locale of the user's current branch tenant. */
  tenantDefaultLocale?: string | null;
  /** Effective UI locale: preferredLocale ?? tenantDefaultLocale ?? en-GB. */
  effectiveLocale?: string;
  onboardingSeenToursModal?: boolean;
  roles?: Array<{
    roleId: string;
    roleName: string;
    branchId: string;
  }>;
  branches?: Branch[];
  currentBranch?: Branch | null;
}

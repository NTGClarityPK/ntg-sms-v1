export interface Branch {
  id: string;
  tenantId?: string | null;
  name: string;
  code?: string | null;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  /** Server profile preference; drives NEXT_LOCALE reconciliation after /auth/me. */
  preferredLocale?: string;
  onboardingSeenToursModal?: boolean;
  roles?: Array<{
    roleId: string;
    roleName: string;
    branchId: string;
  }>;
  branches?: Branch[];
  currentBranch?: Branch | null;
}


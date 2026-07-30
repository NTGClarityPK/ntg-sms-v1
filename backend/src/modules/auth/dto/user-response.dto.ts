import { BranchSummaryDto } from './branch-summary.dto';

export interface UserRoleDto {
  roleId: string;
  roleName: string;
  branchId: string;
}

export class UserResponseDto {
  id!: string;
  email!: string;
  fullName!: string;
  avatarUrl?: string;
  /**
   * Personal UI language override.
   * `null` / omitted means inherit the current tenant default.
   */
  preferredLocale?: string | null;
  /** Default locale of the user's current branch tenant. */
  tenantDefaultLocale?: string | null;
  /** Effective UI locale: preferredLocale ?? tenantDefaultLocale ?? en-GB. */
  effectiveLocale?: string;
  onboardingSeenToursModal?: boolean;
  roles?: UserRoleDto[];
  branches?: BranchSummaryDto[];
  currentBranch?: BranchSummaryDto | null;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}

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
  roles?: UserRoleDto[];
  branches?: BranchSummaryDto[];
  currentBranch?: BranchSummaryDto | null;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}


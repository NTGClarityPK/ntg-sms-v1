import { BranchSummaryDto } from './branch-summary.dto';

export class UserResponseDto {
  id!: string;
  email!: string;
  fullName!: string;
  avatarUrl?: string;
  roles?: string[];
  branches?: BranchSummaryDto[];
  currentBranch?: BranchSummaryDto | null;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}


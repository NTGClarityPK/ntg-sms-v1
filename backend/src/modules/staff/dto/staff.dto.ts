export class StaffDto {
  id!: string;
  userId!: string;
  branchId!: string;
  employeeId?: string;
  department?: string;
  joinDate?: string;
  isActive!: boolean;
  deactivatedAt?: string;
  deactivationReason?: string;
  createdAt!: string;
  updatedAt!: string;
  // Joined data
  fullName?: string;
  email?: string;
  roles?: Array<{
    roleId: string;
    roleName: string;
    branchId: string;
  }>;

  constructor(partial: Partial<StaffDto>) {
    Object.assign(this, partial);
  }
}


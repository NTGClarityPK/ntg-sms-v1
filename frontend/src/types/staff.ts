export interface Staff {
  id: string;
  userId: string;
  branchId: string;
  employeeId?: string;
  department?: string;
  joinDate?: string;
  isActive: boolean;
  deactivatedAt?: string;
  deactivationReason?: string;
  createdAt: string;
  updatedAt: string;
  fullName?: string;
  email?: string;
  roles?: Array<{
    roleId: string;
    roleName: string;
    branchId: string;
  }>;
}

export interface CreateStaffInput {
  email: string;
  password: string;
  fullName: string;
  avatarUrl?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female';
  employeeId?: string;
  department?: string;
  joinDate?: string;
  roleIds?: string[];
  isActive?: boolean;
}

export interface UpdateStaffInput {
  fullName?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female';
  employeeId?: string;
  department?: string;
  joinDate?: string;
  isActive?: boolean;
}


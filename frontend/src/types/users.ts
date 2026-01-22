export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female';
  isActive: boolean;
  roles?: Array<{
    roleId: string;
    roleName: string;
    branchId: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  fullName: string;
  avatarUrl?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female';
  roleIds?: string[];
  isActive?: boolean;
}

export interface UpdateUserInput {
  fullName?: string;
  avatarUrl?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female';
  isActive?: boolean;
}

export interface UpdateUserRolesInput {
  roleIds: string[];
}


export type Permission = 'none' | 'view' | 'edit';

export interface Role {
  id: string;
  name: string;
  displayName: string;
  displayNameAr?: string;
  description?: string;
  createdAt: string;
}

export interface Feature {
  id: string;
  code: string;
  name: string;
  createdAt: string;
}

export interface PermissionMatrix {
  roleId: string;
  roleName: string;
  featureId: string;
  featureCode: string;
  permission: Permission;
  branchId: string;
  updatedAt: string;
}

export interface UpdatePermissionsPayload {
  permissions: Array<{
    roleId: string;
    featureId: string;
    permission: Permission;
  }>;
}


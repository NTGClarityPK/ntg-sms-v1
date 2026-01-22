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
  roles?: Array<{
    roleId: string;
    roleName: string;
    branchId: string;
  }>;
  branches?: Branch[];
  currentBranch?: Branch | null;
}


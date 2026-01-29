export interface Tenant {
  id: string;
  name: string;
  code: string;
  domain?: string | null;
  isActive?: boolean;
}



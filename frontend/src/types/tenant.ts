export interface Tenant {
  id: string;
  name: string;
  code: string;
  domain?: string | null;
  email?: string | null;
  phone?: string | null;
  timezone?: string | null;
  fiscalYearStart?: string | null;
  vatNumber?: string | null;
  isActive?: boolean;
  logoUrl?: string | null;
  primaryColor?: string | null;
}









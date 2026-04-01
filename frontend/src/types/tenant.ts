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
  deletionStatus?: 'none' | 'pending' | 'executing' | null;
  deletionRequestedAt?: string | null;
  deletionExecuteAt?: string | null;
  deletionCancelledAt?: string | null;
  deletionRequestedBy?: string | null;
  preDeletionIsActive?: boolean | null;
}









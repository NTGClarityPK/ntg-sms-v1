/** System setting: inventory_sizes – size code and optional dimensions */
export interface InventorySizeEntry {
  size: string;
  dimensions: Record<string, string>;
}

export interface StockEntry {
  id: string;
  uniformItemId: string;
  size: string;
  quantity: number;
  lowStockThreshold: number;
  branchId: string;
  createdAt: string;
  updatedAt: string;
}

export interface UniformItem {
  id: string;
  name: string;
  itemCode?: string;
  category: string;
  gender?: string;
  description?: string;
  imageUrl?: string;
  isActive: boolean;
  branchId: string;
  createdAt: string;
  updatedAt: string;
  stock?: StockEntry[];
}

export type LowStockItem = UniformItem;

export interface CreateUniformItemInput {
  name: string;
  itemCode?: string;
  category: string;
  gender?: string;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
}

export interface UpdateUniformItemInput {
  name?: string;
  itemCode?: string;
  category?: string;
  gender?: string;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
}

export interface AddOrUpdateStockInput {
  size: string;
  quantity: number;
  lowStockThreshold?: number;
}

export interface QueryUniformsParams {
  page?: number;
  limit?: number;
  category?: string;
  gender?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export type UniformRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'issued'
  | 'cancelled';

export interface UniformRequestItem {
  id: string;
  requestId: string;
  uniformItemId: string;
  uniformItemName?: string;
  size: string;
  quantity: number;
  createdAt: string;
}

export interface UniformRequest {
  id: string;
  studentId: string;
  studentName?: string;
  requestedBy: string;
  requesterName?: string;
  status: UniformRequestStatus;
  notes?: string;
  reviewedBy?: string;
  reviewerName?: string;
  reviewedAt?: string;
  issuedBy?: string;
  issuedAt?: string;
  branchId: string;
  createdAt: string;
  updatedAt: string;
  items: UniformRequestItem[];
}

export interface CreateUniformRequestInput {
  studentId: string;
  items: { uniformItemId: string; size: string; quantity: number }[];
  notes?: string;
}

export interface QueryUniformRequestsParams {
  page?: number;
  limit?: number;
  studentId?: string;
  status?: UniformRequestStatus[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface UniformIssuance {
  id: string;
  studentId: string;
  studentName?: string;
  uniformItemId: string;
  uniformItemName?: string;
  size: string;
  quantity: number;
  issuedBy: string;
  issuerName?: string;
  requestId?: string;
  notes?: string;
  branchId: string;
  issuedAt: string;
}

export interface IssuanceReportRow {
  studentId: string;
  studentName?: string;
  uniformItemId: string;
  uniformItemName?: string;
  size: string;
  quantity: number;
  issuedAt: string;
  issuerName?: string;
}

export interface CreateDirectIssuanceInput {
  studentId: string;
  uniformItemId: string;
  size: string;
  quantity: number;
  notes?: string;
}

export interface QueryIssuanceReportParams {
  studentId?: string;
  uniformItemId?: string;
  dateFrom?: string;
  dateTo?: string;
}

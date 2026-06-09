export type DataExportScope = 'tenant' | 'branch';

export interface DataExportStatus {
  canExport: boolean;
  lastExportAt: string | null;
  nextAvailableAt: string | null;
  lastScope: DataExportScope | null;
}

export interface CreateDataExportPayload {
  accountPassword: string;
  backupPassword: string;
  confirmBackupPassword: string;
  scope: DataExportScope;
  acknowledgedWarning: boolean;
}

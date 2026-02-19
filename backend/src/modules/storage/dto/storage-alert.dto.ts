export class StorageAlertDto {
  id!: string;
  branchId!: string;
  alertType!: 'warning' | 'critical' | 'exceeded';
  percentageUsed!: number;
  acknowledged!: boolean;
  acknowledgedBy?: string | null;
  acknowledgedAt?: string | null;
  createdAt!: string;
}

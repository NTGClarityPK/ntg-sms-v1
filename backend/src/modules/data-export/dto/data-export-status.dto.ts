export class DataExportStatusDto {
  canExport!: boolean;
  lastExportAt!: string | null;
  nextAvailableAt!: string | null;
  lastScope!: 'tenant' | 'branch' | null;
}

export class SettingsStatusDto {
  academicYear!: boolean;
  academic!: boolean;
  schedule!: boolean;
  assessment!: boolean;
  communication!: boolean;
  behavior!: boolean;
  permissions!: boolean;
  isInitialized!: boolean;

  constructor(partial: Partial<SettingsStatusDto>) {
    Object.assign(this, partial);
  }
}

export class CopySettingsDto {
  sourceBranchId!: string;
}



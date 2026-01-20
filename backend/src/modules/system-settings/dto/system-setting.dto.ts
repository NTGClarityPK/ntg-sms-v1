export class SystemSettingDto {
  key!: string;
  value!: unknown;
  createdAt!: string;
  updatedAt!: string;

  constructor(partial: Partial<SystemSettingDto>) {
    Object.assign(this, partial);
  }
}



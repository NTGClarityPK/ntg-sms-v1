export class FeatureDto {
  id!: string;
  code!: string;
  name!: string;
  createdAt!: string;

  constructor(partial: Partial<FeatureDto>) {
    Object.assign(this, partial);
  }
}


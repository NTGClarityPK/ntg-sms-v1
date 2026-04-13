export class DeletionBlockerDto {
  type!: string;
  count!: number;

  constructor(partial: Partial<DeletionBlockerDto>) {
    Object.assign(this, partial);
  }
}

export class DeletionStatusDto {
  canDelete!: boolean;
  blockers!: DeletionBlockerDto[];

  constructor(partial: Partial<DeletionStatusDto>) {
    Object.assign(this, partial);
  }
}

export class EntityDeletedDto {
  deleted!: boolean;

  constructor(partial: Partial<EntityDeletedDto>) {
    Object.assign(this, partial);
  }
}


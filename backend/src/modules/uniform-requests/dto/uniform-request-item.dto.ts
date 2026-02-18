export class UniformRequestItemDto {
  id!: string;
  requestId!: string;
  uniformItemId!: string;
  uniformItemName?: string;
  size!: string;
  quantity!: number;
  createdAt!: string;

  constructor(partial: Partial<UniformRequestItemDto>) {
    Object.assign(this, partial);
  }
}

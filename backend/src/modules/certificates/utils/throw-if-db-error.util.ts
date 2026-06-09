import { BadRequestException } from '@nestjs/common';

export function throwIfDbError(error: { message: string } | null): void {
  if (error) throw new BadRequestException(error.message);
}

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentBranchContext {
  branchId: string;
  tenantId: string | null;
}

export const CurrentBranch = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentBranchContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.branch;
  },
);



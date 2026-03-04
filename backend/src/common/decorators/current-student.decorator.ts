import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentStudentPayload {
  id: string;
  branchId: string;
  schoolId?: string;
}

export const CurrentStudent = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentStudentPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.student as CurrentStudentPayload;
  },
);


import { ForbiddenException } from '@nestjs/common';
import { ParentsService } from './parents.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { SupabaseConfig } from '../../common/config/supabase.config';

type QueryResult = {
  data: unknown;
  error: null;
};

function createSupabaseMock(handlers: {
  student?: QueryResult;
  parentStudents?: QueryResult;
}) {
  const calls: { table: string; usedMaybeSingle: boolean }[] = [];

  const from = (table: string) => {
    const state = { table, usedMaybeSingle: false };
    calls.push(state);

    const chain: Record<string, unknown> = {};
    const self = () => chain;

    chain.select = jest.fn(self);
    chain.eq = jest.fn(self);
    chain.order = jest.fn(self);
    chain.in = jest.fn(self);
    chain.maybeSingle = jest.fn(async () => {
      state.usedMaybeSingle = true;
      if (table === 'students') {
        return handlers.student ?? { data: null, error: null };
      }
      return { data: null, error: null };
    });
    chain.then = (
      resolve: (value: QueryResult) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => {
      const result: QueryResult =
        table === 'parent_students'
          ? (handlers.parentStudents ?? { data: [], error: null })
          : { data: [], error: null };
      return Promise.resolve(result).then(resolve, reject);
    };

    return chain;
  };

  return {
    client: { from: jest.fn(from) },
    calls,
  };
}

describe('ParentsService getGuardiansForStudent branch assert', () => {
  const branchA = 'branch-a-id';
  const branchB = 'branch-b-id';
  const studentId = 'student-1';
  const userA = 'user-a-id';

  let auditLog: { log: jest.Mock };
  let mock: ReturnType<typeof createSupabaseMock>;

  function buildService(handlers: Parameters<typeof createSupabaseMock>[0]) {
    mock = createSupabaseMock(handlers);
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };
    return new ParentsService(
      { getClient: jest.fn(() => mock.client) } as unknown as SupabaseConfig,
      auditLog as unknown as AuditLogService,
    );
  }

  const accessA = {
    branchId: branchA,
    userId: userA,
    email: 'admin_a@test.com',
    roles: ['school_admin'],
  };

  it('throws 403 and audits when student is in another branch', async () => {
    const service = buildService({
      student: { data: { id: studentId, branch_id: branchB }, error: null },
    });

    await expect(service.getGuardiansForStudent(studentId, accessA)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(auditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: 'students',
        recordId: studentId,
        action: 'UPDATE',
        newValues: expect.objectContaining({
          accessDenied: true,
          attempted: 'get-guardians',
          callerUserId: userA,
          callerBranchId: branchA,
          studentBranchId: branchB,
        }),
      }),
    );

    const parentCalls = mock.calls.filter((c) => c.table === 'parent_students');
    expect(parentCalls).toHaveLength(0);
  });

  it('allows when student branch matches CurrentBranch', async () => {
    const service = buildService({
      student: { data: { id: studentId, branch_id: branchA }, error: null },
      parentStudents: { data: [], error: null },
    });

    const result = await service.getGuardiansForStudent(studentId, accessA);

    expect(result).toEqual([]);
    expect(auditLog.log).not.toHaveBeenCalled();
    expect(mock.calls.some((c) => c.table === 'parent_students')).toBe(true);
  });

  it('allows super_admin for student in another branch', async () => {
    const service = buildService({
      student: { data: { id: studentId, branch_id: branchB }, error: null },
      parentStudents: { data: [], error: null },
    });

    const result = await service.getGuardiansForStudent(studentId, {
      ...accessA,
      roles: ['super_admin'],
    });

    expect(result).toEqual([]);
    expect(auditLog.log).not.toHaveBeenCalled();
  });

  it('skips student branch pre-check when access context is omitted', async () => {
    const service = buildService({
      parentStudents: { data: [], error: null },
    });

    const result = await service.getGuardiansForStudent(studentId);

    expect(result).toEqual([]);
    expect(mock.calls.filter((c) => c.table === 'students')).toHaveLength(0);
    expect(mock.calls.some((c) => c.table === 'parent_students')).toBe(true);
  });
});

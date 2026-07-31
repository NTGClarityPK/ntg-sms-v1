import { ForbiddenException } from '@nestjs/common';
import { BranchGuard } from './branch.guard';
import { SupabaseConfig } from '../config/supabase.config';

type QueryResult = { data: unknown; error: null | { message: string; code?: string } };

/**
 * Table-aware chainable Supabase mock for BranchGuard inactive-path tests.
 */
function createClientMock(state: {
  userBranches: Array<{ branch_id: string }>;
  branchesById: Record<string, { id: string; tenant_id: string | null; is_active: boolean }>;
  tenantsById: Record<string, { id: string; is_active: boolean }>;
  profileBranchId?: string | null;
}) {
  const from = (table: string) => {
    const chain: Record<string, unknown> = {};
    const filters: { eq: Array<[string, unknown]>; inCol?: string; inVals?: unknown } = {
      eq: [],
    };
    const self = () => chain;

    chain.select = jest.fn(self);
    chain.eq = jest.fn((col: string, val: unknown) => {
      filters.eq.push([col, val]);
      return chain;
    });
    chain.in = jest.fn((col: string, vals: unknown) => {
      filters.inCol = col;
      filters.inVals = vals;
      return chain;
    });
    chain.limit = jest.fn(self);
    chain.update = jest.fn(self);
    chain.maybeSingle = jest.fn(async (): Promise<QueryResult> => {
      if (table === 'profiles') {
        return {
          data: { current_branch_id: state.profileBranchId ?? null },
          error: null,
        };
      }
      if (table === 'user_branches') {
        const userId = filters.eq.find(([c]) => c === 'user_id')?.[1];
        const branchId = filters.eq.find(([c]) => c === 'branch_id')?.[1] as string | undefined;
        if (branchId) {
          const hit = state.userBranches.find((ub) => ub.branch_id === branchId);
          return { data: hit ?? null, error: null };
        }
        return { data: state.userBranches[0] ?? null, error: null };
      }
      if (table === 'branches') {
        const id = filters.eq.find(([c]) => c === 'id')?.[1] as string | undefined;
        if (id) {
          return { data: state.branchesById[id] ?? null, error: null };
        }
        return { data: null, error: null };
      }
      if (table === 'tenants') {
        const id = filters.eq.find(([c]) => c === 'id')?.[1] as string | undefined;
        if (id) {
          return { data: state.tenantsById[id] ?? null, error: null };
        }
        return { data: null, error: null };
      }
      return { data: null, error: null };
    });
    // Thenable for list queries (.in without maybeSingle)
    chain.then = (
      resolve: (v: QueryResult) => unknown,
      reject?: (e: unknown) => unknown,
    ) => {
      let result: QueryResult = { data: [], error: null };
      if (table === 'user_branches') {
        result = { data: state.userBranches, error: null };
      } else if (table === 'branches' && filters.inCol === 'id') {
        const ids = (filters.inVals as string[]) || [];
        result = {
          data: ids.map((id) => state.branchesById[id]).filter(Boolean),
          error: null,
        };
      } else if (table === 'tenants' && filters.inCol === 'id') {
        const ids = (filters.inVals as string[]) || [];
        result = {
          data: ids.map((id) => state.tenantsById[id]).filter(Boolean),
          error: null,
        };
      }
      return Promise.resolve(result).then(resolve, reject);
    };

    return chain;
  };

  return { from: jest.fn(from) };
}

function makeContext(user: { id: string; email?: string; roles?: string[] }, branchHeader?: string) {
  const request: Record<string, unknown> = {
    user,
    headers: branchHeader ? { 'x-branch-id': branchHeader } : {},
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    request,
  };
}

describe('BranchGuard inactive checks (no email bypass)', () => {
  const branchInactive = 'branch-inactive';
  const tenantId = 'tenant-1';

  function buildGuard(client: ReturnType<typeof createClientMock>) {
    return new BranchGuard({
      getClient: () => client,
    } as unknown as SupabaseConfig);
  }

  const baseState = {
    userBranches: [{ branch_id: branchInactive }],
    branchesById: {
      [branchInactive]: {
        id: branchInactive,
        tenant_id: tenantId,
        is_active: false,
      },
    },
    tenantsById: {
      [tenantId]: { id: tenantId, is_active: true },
    },
    profileBranchId: branchInactive,
  };

  it('school_admin against inactive branch with no fallback is Forbidden', async () => {
    const client = createClientMock(baseState);
    const guard = buildGuard(client);
    const ctx = makeContext(
      { id: 'user-1', email: 'admin@school.com', roles: ['school_admin'] },
      branchInactive,
    );

    await expect(guard.canActivate(ctx as never)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('normal user against inactive branch with no fallback is Forbidden', async () => {
    const client = createClientMock(baseState);
    const guard = buildGuard(client);
    const ctx = makeContext(
      { id: 'user-2', email: 'teacher@school.com', roles: ['school_admin'] },
      branchInactive,
    );

    await expect(guard.canActivate(ctx as never)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('legacy ops email still hits inactive checks (no early bypass)', async () => {
    const client = createClientMock(baseState);
    const guard = buildGuard(client);
    const ctx = makeContext(
      { id: 'user-3', email: 'ops@ntg.com', roles: ['school_admin'] },
      branchInactive,
    );

    await expect(guard.canActivate(ctx as never)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

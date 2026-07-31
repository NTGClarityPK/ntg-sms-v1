import { ForbiddenException } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { SubscriptionService } from '../subscription/subscription.service';

type QueryResult = {
  data: unknown;
  error: null;
  count?: number;
};

/**
 * Minimal chainable Supabase mock that records filter calls per table.
 */
function createSupabaseMock(handlers: {
  userBranches?: QueryResult;
  branchesList?: QueryResult;
  branchesMembership?: QueryResult;
}) {
  const calls: {
    table: string;
    inFilters: Array<{ column: string; values: unknown }>;
    eqFilters: Array<{ column: string; value: unknown }>;
    didUpdate: boolean;
  }[] = [];

  const from = (table: string) => {
    const state = {
      table,
      inFilters: [] as Array<{ column: string; values: unknown }>,
      eqFilters: [] as Array<{ column: string; value: unknown }>,
      didUpdate: false,
    };
    calls.push(state);

    const chain: Record<string, unknown> = {};
    const self = () => chain;

    chain.select = jest.fn(self);
    chain.range = jest.fn(self);
    chain.order = jest.fn(self);
    chain.or = jest.fn(self);
    chain.in = jest.fn((column: string, values: unknown) => {
      state.inFilters.push({ column, values });
      return chain;
    });
    chain.eq = jest.fn((column: string, value: unknown) => {
      state.eqFilters.push({ column, value });
      return chain;
    });
    chain.maybeSingle = jest.fn(async () => {
      if (table === 'user_branches') {
        return handlers.userBranches ?? { data: null, error: null };
      }
      return handlers.branchesMembership ?? { data: null, error: null };
    });
    chain.single = jest.fn(async () => handlers.branchesList ?? { data: null, error: null });
    chain.update = jest.fn(() => {
      state.didUpdate = true;
      return chain;
    });
    // Thenable: awaiting the chain resolves list queries
    chain.then = (
      resolve: (value: QueryResult) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => {
      let result: QueryResult;
      if (table === 'user_branches') {
        result = handlers.userBranches ?? { data: [], error: null };
      } else {
        result = handlers.branchesList ?? { data: [], error: null, count: 0 };
      }
      return Promise.resolve(result).then(resolve, reject);
    };

    return chain;
  };

  return {
    client: { from: jest.fn(from) },
    calls,
  };
}

describe('BranchesService access scoping', () => {
  const branchA = 'branch-a-id';
  const branchB = 'branch-b-id';
  const userA = 'user-a-id';

  let supabaseConfig: { getClient: jest.Mock };
  let subscriptionService: Partial<SubscriptionService>;
  let mock: ReturnType<typeof createSupabaseMock>;

  const memberUserBranches: QueryResult = {
    data: [{ branch_id: branchA }],
    error: null,
  };

  const emptyBranchList: QueryResult = {
    data: [],
    error: null,
    count: 0,
  };

  function buildService(handlers: Parameters<typeof createSupabaseMock>[0]) {
    mock = createSupabaseMock(handlers);
    supabaseConfig = { getClient: jest.fn(() => mock.client) };
    subscriptionService = {};
    return new BranchesService(
      supabaseConfig as unknown as SupabaseConfig,
      subscriptionService as SubscriptionService,
    );
  }

  it('list for normal member filters by user_branches ids at DB level', async () => {
    const service = buildService({
      userBranches: memberUserBranches,
      branchesList: emptyBranchList,
    });

    await service.list(
      { page: 1, limit: 20, sortOrder: 'desc' },
      { userId: userA, roles: ['school_admin'] },
    );

    const branchesCalls = mock.calls.filter((c) => c.table === 'branches');
    expect(branchesCalls.length).toBeGreaterThan(0);
    const idFilter = branchesCalls[0].inFilters.find((f) => f.column === 'id');
    expect(idFilter?.values).toEqual([branchA]);
  });

  it('list for school_admin without membership still applies id filter', async () => {
    const service = buildService({
      userBranches: memberUserBranches,
      branchesList: emptyBranchList,
    });

    await service.list(
      { page: 1, limit: 20, sortOrder: 'desc' },
      { userId: userA, roles: ['school_admin'] },
    );

    const branchesCalls = mock.calls.filter((c) => c.table === 'branches');
    expect(branchesCalls.length).toBeGreaterThan(0);
    const idFilter = branchesCalls[0].inFilters.find((f) => f.column === 'id');
    expect(idFilter?.values).toEqual([branchA]);
  });

  it('getById for non-member throws 403', async () => {
    const service = buildService({
      userBranches: { data: null, error: null },
    });

    await expect(
      service.getById(branchB, 'en', {
        userId: userA,
        email: 'admin_a@test.com',
        roles: ['school_admin'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('update for non-member throws 403 and does not update branches', async () => {
    const service = buildService({
      userBranches: { data: null, error: null },
    });

    await expect(
      service.update(
        branchB,
        { name: 'Hacked' },
        'admin_a@test.com',
        {
          userId: userA,
          email: 'admin_a@test.com',
          roles: ['school_admin'],
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const updates = mock.calls.filter((c) => c.table === 'branches' && c.didUpdate);
    expect(updates).toHaveLength(0);
  });

  it('updatePublicStats for non-member throws 403', async () => {
    const service = buildService({
      userBranches: { data: null, error: null },
    });

    await expect(
      service.updatePublicStats(branchB, true, null, 'admin_a@test.com', {
        userId: userA,
        email: 'admin_a@test.com',
        roles: ['school_admin'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const updates = mock.calls.filter((c) => c.table === 'branches' && c.didUpdate);
    expect(updates).toHaveLength(0);
  });

  it('getById for member proceeds past access check', async () => {
    const branchRow = {
      id: branchA,
      tenant_id: 'tenant-1',
      name: 'Branch A',
      name_ar: null,
      code: 'BA',
      address: null,
      phone: null,
      email: null,
      storage_quota_gb: 100,
      storage_used_bytes: 0,
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    const service = buildService({
      userBranches: { data: { branch_id: branchA }, error: null },
      branchesMembership: { data: branchRow, error: null },
    });

    // getById: first maybeSingle is membership on user_branches; second is branch row.
    // Our mock returns userBranches for user_branches table and branchesMembership for others.
    const result = await service.getById(branchA, 'en', {
      userId: userA,
      email: 'admin_a@test.com',
      roles: ['school_admin'],
    });

    expect(result.id).toBe(branchA);
    expect(result.name).toBe('Branch A');
  });
});

import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Request } from 'express';
import { SupabaseConfig } from '../config/supabase.config';
import {
  isSupabaseConnectivityError,
  SUPABASE_CONNECTIVITY_USER_MESSAGE,
} from '../utils/supabase-connectivity-error.util';

type BranchRow = {
  id: string;
  tenant_id: string | null;
  is_active: boolean;
};

@Injectable()
export class BranchGuard implements CanActivate {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request['user'] as { id?: string } | undefined;

    const userId = user?.id;
    if (!userId) {
      throw new BadRequestException('Missing authenticated user context');
    }

    // Inactive branch/tenant checks apply to everyone.

    const headerBranchId =
      typeof request.headers['x-branch-id'] === 'string' ? request.headers['x-branch-id'] : undefined;

    const supabase = this.supabaseConfig.getClient();

    let branchId = headerBranchId;
    const selectFirstAccessibleBranch = async (): Promise<string | undefined> => {
      const { data: userBranches } = await supabase
        .from('user_branches')
        .select('branch_id')
        .eq('user_id', userId)
        .limit(1);
      return userBranches?.[0]?.branch_id ?? undefined;
    };

    const selectFirstAccessibleActiveBranch = async (): Promise<string | undefined> => {
      const { data: userBranches, error: userBranchesError } = await supabase
        .from('user_branches')
        .select('branch_id')
        .eq('user_id', userId);

      if (userBranchesError) {
        if (isSupabaseConnectivityError(userBranchesError)) {
          throw new ServiceUnavailableException(SUPABASE_CONNECTIVITY_USER_MESSAGE);
        }
        throw new BadRequestException(userBranchesError.message);
      }

      const branchIds = (userBranches || []).map((ub) => ub.branch_id as string);
      if (branchIds.length === 0) return undefined;

      const { data: branches, error: branchesError } = await supabase
        .from('branches')
        .select('id, tenant_id, is_active')
        .in('id', branchIds);

      if (branchesError) {
        if (isSupabaseConnectivityError(branchesError)) {
          throw new ServiceUnavailableException(SUPABASE_CONNECTIVITY_USER_MESSAGE);
        }
        throw new BadRequestException(branchesError.message);
      }

      const tenantIds = Array.from(
        new Set((branches || []).map((b) => (b as { tenant_id: string | null }).tenant_id).filter(Boolean)),
      ) as string[];

      const { data: tenants, error: tenantsError } = await supabase
        .from('tenants')
        .select('id, is_active')
        .in('id', tenantIds);

      if (tenantsError) {
        if (isSupabaseConnectivityError(tenantsError)) {
          throw new ServiceUnavailableException(SUPABASE_CONNECTIVITY_USER_MESSAGE);
        }
        throw new BadRequestException(tenantsError.message);
      }

      const activeTenantIds = new Set(
        (tenants || [])
          .filter((t) => (t as { is_active: boolean }).is_active)
          .map((t) => (t as { id: string }).id),
      );

      const activeBranch = (branches || []).find((b) => {
        const row = b as { id: string; tenant_id: string | null; is_active: boolean };
        return row.is_active && !!row.tenant_id && activeTenantIds.has(row.tenant_id);
      });

      return activeBranch?.id;
    };

    const persistCurrentBranch = async (newBranchId: string): Promise<void> => {
      await supabase.from('profiles').update({ current_branch_id: newBranchId }).eq('id', userId);
    };

    const fetchBranchRow = async (id: string): Promise<BranchRow> => {
      const { data: branch, error: branchError } = await supabase
        .from('branches')
        .select('id, tenant_id, is_active')
        .eq('id', id)
        .maybeSingle();

      if (branchError) {
        if (isSupabaseConnectivityError(branchError)) {
          throw new ServiceUnavailableException(SUPABASE_CONNECTIVITY_USER_MESSAGE);
        }
        throw new BadRequestException(branchError.message);
      }

      if (!branch) {
        throw new BadRequestException('Branch not found');
      }

      return branch as BranchRow;
    };

    if (!branchId) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('current_branch_id')
        .eq('id', userId)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') {
        if (isSupabaseConnectivityError(profileError)) {
          throw new ServiceUnavailableException(SUPABASE_CONNECTIVITY_USER_MESSAGE);
        }
        throw new BadRequestException(profileError.message);
      }

      const row = profile as { current_branch_id: string | null } | null;
      branchId = row?.current_branch_id ?? undefined;

      // Auto-select first branch when none set (e.g. non–school-admin users who skip branch modal)
      if (!branchId) {
        const firstBranchId = await selectFirstAccessibleBranch();
        if (firstBranchId) {
          await persistCurrentBranch(firstBranchId);
          branchId = firstBranchId;
        }
      }
    }

    if (!branchId) {
      throw new BadRequestException('Branch not selected');
    }

    // Verify user has access to this branch via user_branches
    const { data: userBranch, error: userBranchError } = await supabase
      .from('user_branches')
      .select('branch_id')
      .eq('user_id', userId)
      .eq('branch_id', branchId)
      .maybeSingle();

    if (userBranchError) {
      if (isSupabaseConnectivityError(userBranchError)) {
        throw new ServiceUnavailableException(SUPABASE_CONNECTIVITY_USER_MESSAGE);
      }
      throw new BadRequestException(userBranchError.message);
    }

    if (!userBranch) {
      // Frontend can keep a stale currentBranchId in localStorage across accounts.
      // Recover gracefully by selecting the first accessible branch for this user.
      const firstBranchId = await selectFirstAccessibleBranch();
      if (!firstBranchId) {
        throw new BadRequestException('You do not have access to this branch');
      }

      await persistCurrentBranch(firstBranchId);
      branchId = firstBranchId;
    }

    let branchRow = await fetchBranchRow(branchId);

    // Inactive checks apply to everyone.
    if (branchRow.is_active === false) {
      const fallback = await selectFirstAccessibleActiveBranch();
      if (fallback && fallback !== branchId) {
        await persistCurrentBranch(fallback);
        branchId = fallback;
        branchRow = await fetchBranchRow(branchId);
      } else {
        throw new ForbiddenException(
          'This branch has been marked as inactive by an administrator. Please contact your school if you need help.',
        );
      }
    }

    if (branchRow.tenant_id) {
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id, is_active')
        .eq('id', branchRow.tenant_id)
        .maybeSingle();

      if (tenantError) {
        if (isSupabaseConnectivityError(tenantError)) {
          throw new ServiceUnavailableException(SUPABASE_CONNECTIVITY_USER_MESSAGE);
        }
        throw new BadRequestException(tenantError.message);
      }

      const tenantRow = tenant as { id: string; is_active: boolean } | null;
      if (tenantRow?.is_active === false) {
        const fallback = await selectFirstAccessibleActiveBranch();
        if (fallback && fallback !== branchId) {
          await persistCurrentBranch(fallback);
          branchId = fallback;
          branchRow = await fetchBranchRow(branchId);
        } else {
          throw new ForbiddenException(
            'Your school has been marked as inactive by an administrator. Please contact support if you need help.',
          );
        }
      }
    }

    // Attach branch context to request (always the resolved active branch row)
    (request as unknown as Record<string, unknown>)['branch'] = {
      branchId: branchRow.id,
      tenantId: branchRow.tenant_id,
    };

    return true;
  }
}

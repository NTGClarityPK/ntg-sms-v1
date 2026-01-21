import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { SupabaseConfig } from '../config/supabase.config';

type BranchRow = {
  id: string;
  tenant_id: string | null;
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

    const headerBranchId =
      typeof request.headers['x-branch-id'] === 'string' ? request.headers['x-branch-id'] : undefined;

    const supabase = this.supabaseConfig.getClient();

    let branchId = headerBranchId;
    if (!branchId) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('current_branch_id')
        .eq('id', userId)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') {
        throw new BadRequestException(profileError.message);
      }

      const row = profile as { current_branch_id: string | null } | null;
      branchId = row?.current_branch_id ?? undefined;
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
      throw new BadRequestException(userBranchError.message);
    }

    if (!userBranch) {
      throw new BadRequestException('You do not have access to this branch');
    }

    // Resolve tenantId from branches table
    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .select('id, tenant_id')
      .eq('id', branchId)
      .maybeSingle();

    if (branchError) {
      throw new BadRequestException(branchError.message);
    }

    if (!branch) {
      throw new BadRequestException('Branch not found');
    }

    const branchRow = branch as BranchRow;

    // Attach branch context to request
    (request as unknown as Record<string, unknown>)['branch'] = {
      branchId: branchRow.id,
      tenantId: branchRow.tenant_id,
    };

    return true;
  }
}



import { BadRequestException, Injectable } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { CommitSetupWizardDto } from './dto/commit-setup-wizard.dto';

function throwIfDbError(error: PostgrestError | null): void {
  if (error) throw new BadRequestException(error.message);
}

@Injectable()
export class SetupWizardService {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  async commitSetupWizard(input: {
    payload: CommitSetupWizardDto;
    branchId: string;
    tenantId: string | null;
    userEmail: string;
  }): Promise<{ data: { success: boolean; academicYearId?: string | null } }> {
    if (!input.tenantId) throw new BadRequestException('Tenant not found for current branch');

    const supabase = this.supabaseConfig.getClient();
    // Step 7 (permissions UI) was removed; default roles/permissions are handled in the RPC.
    // Keep payload backward-compatible for older clients by always sending an array.
    const payload = {
      ...input.payload,
      permissions: Array.isArray((input.payload as any).permissions) ? (input.payload as any).permissions : [],
    } as CommitSetupWizardDto;

    const { data, error } = await supabase.rpc('commit_setup_wizard', {
      p_payload: payload,
      p_branch_id: input.branchId,
      p_tenant_id: input.tenantId,
      p_user_email: input.userEmail,
    });
    throwIfDbError(error);

    const result =
      data && typeof data === 'object'
        ? (data as { success?: boolean; academicYearId?: string | null })
        : undefined;

    return {
      data: {
        success: result?.success === true,
        academicYearId: result?.academicYearId ?? null,
      },
    };
  }
}


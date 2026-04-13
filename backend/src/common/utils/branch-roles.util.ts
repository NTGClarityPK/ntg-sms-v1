import { ForbiddenException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Ensures the user has the school_admin role for the given branch only.
 * Do not rely on JWT role arrays — they are not branch-scoped in this codebase.
 */
export async function assertSchoolAdminForBranch(
  supabase: SupabaseClient,
  userId: string,
  branchId: string,
): Promise<void> {
  const { data: roleRow, error: roleError } = await supabase
    .from('roles')
    .select('id')
    .eq('name', 'school_admin')
    .maybeSingle();

  if (roleError) {
    throw new ForbiddenException('Unable to verify permissions');
  }
  if (!roleRow?.id) {
    throw new ForbiddenException('School administrator role is not configured');
  }

  const { count, error: urError } = await supabase
    .from('user_roles')
    .select('user_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('branch_id', branchId)
    .eq('role_id', roleRow.id);

  if (urError) {
    throw new ForbiddenException('Unable to verify permissions');
  }
  if (!count || count < 1) {
    throw new ForbiddenException('Only a school administrator for this branch may perform this action');
  }
}


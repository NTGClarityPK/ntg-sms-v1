import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { RegisterDto } from './dto/register.dto';
import { RegisterResponseDto } from './dto/register-response.dto';

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

@Injectable()
export class RegistrationService {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  async register(input: RegisterDto): Promise<RegisterResponseDto> {
    const supabase = this.supabaseConfig.getClient();

    // Start transaction-like flow (Supabase doesn't support transactions, so we'll handle rollback manually)
    let tenantId: string | null = null;
    let branchId: string | null = null;
    let userId: string | null = null;

    try {
      // Step 1: Create Tenant
      const tenantCode = input.schoolCode || this.generateCode(input.schoolName);
      
      // Check if tenant code already exists
      const { data: existingTenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('code', tenantCode)
        .maybeSingle();

      if (existingTenant) {
        throw new ConflictException(`School code "${tenantCode}" already exists. Please choose a different code.`);
      }

      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          name: input.schoolName,
          code: tenantCode,
          domain: input.schoolDomain ?? null,
          is_active: true,
        })
        .select('id')
        .single();

      throwIfDbError(tenantError);
      if (!tenant) {
        throw new BadRequestException('Failed to create tenant');
      }
      tenantId = tenant.id;

      // Step 2: Create Branch
      const branchCode = input.branchCode || `${tenantCode}-MAIN`;
      
      // Check if branch code already exists
      const { data: existingBranch } = await supabase
        .from('branches')
        .select('id')
        .eq('code', branchCode)
        .maybeSingle();

      if (existingBranch) {
        // Rollback tenant
        await supabase.from('tenants').delete().eq('id', tenantId);
        throw new ConflictException(`Branch code "${branchCode}" already exists. Please choose a different code.`);
      }

      const { data: branch, error: branchError } = await supabase
        .from('branches')
        .insert({
          tenant_id: tenantId,
          name: input.branchName,
          code: branchCode,
          address: input.branchAddress ?? null,
          phone: input.branchPhone ?? null,
          email: input.branchEmail ?? null,
          storage_quota_gb: 100,
          is_active: true,
        })
        .select('id')
        .single();

      throwIfDbError(branchError);
      if (!branch) {
        // Rollback tenant
        await supabase.from('tenants').delete().eq('id', tenantId);
        throw new BadRequestException('Failed to create branch');
      }
      branchId = branch.id;

      // Step 3: Create Auth User
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
      });

      if (authError) {
        // Rollback tenant and branch
        if (branchId) await supabase.from('branches').delete().eq('id', branchId);
        if (tenantId) await supabase.from('tenants').delete().eq('id', tenantId);
        
        if (authError.message.includes('already registered')) {
          throw new ConflictException('User with this email already exists');
        }
        throw new BadRequestException(authError.message);
      }

      if (!user) {
        // Rollback tenant and branch
        if (branchId) await supabase.from('branches').delete().eq('id', branchId);
        if (tenantId) await supabase.from('tenants').delete().eq('id', tenantId);
        throw new BadRequestException('Failed to create user');
      }
      userId = user.id;

      // Step 4: Create Profile
      const { error: profileError } = await supabase.from('profiles').insert({
        id: user.id,
        full_name: input.fullName,
        phone: input.phone ?? null,
        is_active: true,
        current_branch_id: branchId,
      });

      if (profileError) {
        // Rollback: delete user, branch, tenant
        await supabase.auth.admin.deleteUser(user.id);
        if (branchId) await supabase.from('branches').delete().eq('id', branchId);
        if (tenantId) await supabase.from('tenants').delete().eq('id', tenantId);
        throw new BadRequestException(`Failed to create profile: ${profileError.message}`);
      }

      // Step 5: Assign User to Branch
      const { error: userBranchError } = await supabase.from('user_branches').insert({
        user_id: user.id,
        branch_id: branchId,
        is_primary: true,
      });

      if (userBranchError) {
        // Rollback: delete profile, user, branch, tenant
        await supabase.from('profiles').delete().eq('id', user.id);
        await supabase.auth.admin.deleteUser(user.id);
        if (branchId) await supabase.from('branches').delete().eq('id', branchId);
        if (tenantId) await supabase.from('tenants').delete().eq('id', tenantId);
        throw new BadRequestException(`Failed to assign user to branch: ${userBranchError.message}`);
      }

      // Step 6: Get School Admin Role ID
      const { data: schoolAdminRole, error: roleError } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'school_admin')
        .maybeSingle();

      throwIfDbError(roleError);
      if (!schoolAdminRole) {
        // Rollback: delete user_branches, profile, user, branch, tenant
        await supabase.from('user_branches').delete().eq('user_id', user.id);
        await supabase.from('profiles').delete().eq('id', user.id);
        await supabase.auth.admin.deleteUser(user.id);
        if (branchId) await supabase.from('branches').delete().eq('id', branchId);
        if (tenantId) await supabase.from('tenants').delete().eq('id', tenantId);
        throw new BadRequestException('School Admin role not found in database');
      }

      // Step 7: Assign School Admin Role
      const { error: roleAssignmentError } = await supabase.from('user_roles').insert({
        user_id: user.id,
        role_id: schoolAdminRole.id,
        branch_id: branchId,
      });

      if (roleAssignmentError) {
        // Rollback: delete user_branches, profile, user, branch, tenant
        await supabase.from('user_branches').delete().eq('user_id', user.id);
        await supabase.from('profiles').delete().eq('id', user.id);
        await supabase.auth.admin.deleteUser(user.id);
        if (branchId) await supabase.from('branches').delete().eq('id', branchId);
        if (tenantId) await supabase.from('tenants').delete().eq('id', tenantId);
        throw new BadRequestException(`Failed to assign role: ${roleAssignmentError.message}`);
      }

      // Step 8: Return user info - frontend will handle login
      // We can't generate tokens from admin API, so user needs to login after registration
      return {
        user: {
          id: user.id,
          email: user.email!,
          fullName: input.fullName,
          tenantId: tenantId!,
          branchId: branchId!,
        },
        accessToken: '', // Empty - user needs to login via /auth/login endpoint
        refreshToken: '', // Empty - user needs to login via /auth/login endpoint
      };
    } catch (error) {
      // Cleanup on error
      if (userId) {
        try {
          await supabase.from('user_roles').delete().eq('user_id', userId);
          await supabase.from('user_branches').delete().eq('user_id', userId);
          await supabase.from('profiles').delete().eq('id', userId);
          await supabase.auth.admin.deleteUser(userId);
        } catch (cleanupError) {
          console.error('Error during cleanup:', cleanupError);
        }
      }
      if (branchId) {
        try {
          await supabase.from('branches').delete().eq('id', branchId);
        } catch (cleanupError) {
          console.error('Error during branch cleanup:', cleanupError);
        }
      }
      if (tenantId) {
        try {
          await supabase.from('tenants').delete().eq('id', tenantId);
        } catch (cleanupError) {
          console.error('Error during tenant cleanup:', cleanupError);
        }
      }
      throw error;
    }
  }

  private generateCode(name: string): string {
    // Generate a code from school name: "Alekaf High School" -> "ALEKAF001"
    const cleaned = name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 6);
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `${cleaned}${random}`;
  }
}


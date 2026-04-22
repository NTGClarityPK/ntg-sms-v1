import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { RegisterDto } from './dto/register.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import { AcademicYearsService } from '../academic-years/academic-years.service';

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

function isUniqueViolation(error: PostgrestError | null): boolean {
  // Postgres unique violation: 23505
  // Supabase can surface this via PostgrestError.code.
  return !!error && error.code === '23505';
}

@Injectable()
export class RegistrationService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly academicYearsService: AcademicYearsService,
  ) {}

  async register(input: RegisterDto): Promise<RegisterResponseDto> {
    const supabase = this.supabaseConfig.getClient();

    // Start transaction-like flow (Supabase doesn't support transactions, so we'll handle rollback manually)
    let tenantId: string | null = null;
    let branchId: string | null = null;
    let userId: string | null = null;
    let academicYearId: string | null = null;

    try {
      // Step 1: Create Tenant
      // If user supplied a code, enforce uniqueness directly. If not, auto-generate with retries.
      const providedTenantCode = input.schoolCode?.trim();
      let tenantCode =
        providedTenantCode && providedTenantCode.length > 0
          ? this.normalizeTenantCode(providedTenantCode)
          : '';
      const tenantDomain = input.schoolDomain.trim().toLowerCase();
      
      if (tenantCode) {
        const { data: existingTenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('code', tenantCode)
          .maybeSingle();

        if (existingTenant) {
          throw new ConflictException(
            `School code "${tenantCode}" already exists. Please choose a different code.`,
          );
        }
      }

      // Check if tenant domain already exists (global uniqueness)
      const { data: existingDomain } = await supabase
        .from('tenants')
        .select('id')
        .eq('domain', tenantDomain)
        .maybeSingle();
      if (existingDomain) {
        throw new ConflictException(`Domain "${tenantDomain}" already exists. Please choose a different domain.`);
      }

      if (!tenantCode) {
        tenantCode = await this.generateUniqueTenantCode(supabase, input.schoolName);
      }

      const { data: tenant, error: tenantError } = await this.insertTenantWithRetry(supabase, {
        name: input.schoolName,
        code: tenantCode,
        domain: tenantDomain,
        is_active: true,
      });

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
        // Branch code is typically auto-generated, but can be provided manually.
        // If it's a collision on auto-generated code, surface a generic error.
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
        email: input.email,
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

      // Step 8: Create & activate Academic Year (required for core flows)
      const createdAcademicYear = await this.academicYearsService.create(
        {
          name: input.academicYearName,
          startDate: input.academicYearStartDate,
          endDate: input.academicYearEndDate,
        },
        tenantId,
        input.email,
      );
      academicYearId = createdAcademicYear.id;
      await this.academicYearsService.activate(createdAcademicYear.id, tenantId, input.email);

      // Step 9: Return user info - frontend will handle login
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
      if (academicYearId && tenantId) {
        try {
          await supabase
            .from('academic_years')
            .delete()
            .eq('id', academicYearId)
            .eq('tenant_id', tenantId);
        } catch (cleanupError) {
          console.error('Error during academic year cleanup:', cleanupError);
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

  private normalizeTenantCode(code: string): string {
    // Keep codes URL-safe and human-friendly.
    // Example input: "Alekaf High School" -> "ALEKAF-3FQ9K2"
    return code
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 32);
  }

  private buildTenantCodeBase(name: string): string {
    const base = name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 8);
    return base || 'SCHOOL';
  }

  private randomBase36(len: number): string {
    // Node supports crypto.getRandomValues? Use crypto module for strong randomness.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('crypto') as typeof import('crypto');
    const bytes = crypto.randomBytes(Math.ceil((len * 5) / 8)); // 5 bits per base32 char approx; good enough
    // base36: take hex -> bigint-ish via parseInt chunks; simplest: use base64url then strip.
    const s = bytes.toString('base64url').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return s.substring(0, len);
  }

  private generateCandidateTenantCode(name: string): string {
    const base = this.buildTenantCodeBase(name);
    const suffix = this.randomBase36(6);
    return this.normalizeTenantCode(`${base}-${suffix}`);
  }

  private async generateUniqueTenantCode(
    supabase: ReturnType<SupabaseConfig['getClient']>,
    schoolName: string,
  ): Promise<string> {
    // Extremely low collision probability, but still verify uniqueness.
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = this.generateCandidateTenantCode(schoolName);
      const { data } = await supabase.from('tenants').select('id').eq('code', candidate).maybeSingle();
      if (!data) return candidate;
    }
    throw new BadRequestException('Failed to generate a unique school code. Please try again.');
  }

  private async insertTenantWithRetry(
    supabase: ReturnType<SupabaseConfig['getClient']>,
    row: { name: string; code: string; domain: string; is_active: boolean },
  ): Promise<{ data: { id: string } | null; error: PostgrestError | null }> {
    // Handles race conditions where another request inserts the same code between "check" and "insert".
    // If code was auto-generated, we can retry with a fresh candidate. If user provided it, caller should not use this.
    let current = row;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await supabase
        .from('tenants')
        .insert(current)
        .select('id')
        .single();

      if (!error) return { data, error: null };
      if (!isUniqueViolation(error)) return { data: null, error };

      // Unique violation: retry with a fresh code.
      current = {
        ...current,
        code: this.generateCandidateTenantCode(current.name),
      };
    }

    // If we somehow collided repeatedly, surface a user-friendly message.
    throw new BadRequestException('Failed to generate a unique school code. Please try again.');
  }
}


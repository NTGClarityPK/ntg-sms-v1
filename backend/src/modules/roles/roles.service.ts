import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import type { PostgrestError } from '@supabase/supabase-js';
import { RoleDto } from './dto/role.dto';
import { FeatureDto } from './dto/feature.dto';
import { PermissionMatrixDto, UpdatePermissionsDto } from './dto/permission-matrix.dto';

/** Staff features parent/student must never hold (mirrors frontend familyHardDeny). */
const FAMILY_HARD_DENIED_FEATURE_CODES = new Set([
  'students',
  'user_management',
  'staff',
  'class_sections',
  'teacher_mapping',
  'parent_associations',
  'assessment',
  'behavioral',
  'inventory',
  'id_cards',
  'events_management',
  'events',
  'timetable_management',
  'timetable',
  'conflict_management',
  'teacher_substitution',
  'promotion_placement',
  'results',
  'settings',
]);

const PARENT_HARD_DENIED_FEATURE_CODES = new Set([
  'my_assessments',
  'timetable_personal',
  'my_timetable',
  'my_schedule',
]);

const STUDENT_HARD_DENIED_FEATURE_CODES = new Set(['my_schedule']);

const OPERATIONAL_STAFF_HARD_DENIED_FAMILY_FEATURE_CODES = new Set(['my_assessments']);

const NON_TEACHER_STAFF_HARD_DENIED_FAMILY_FEATURE_CODES = new Set([
  'timetable_personal',
  'my_timetable',
  'my_schedule',
  'events_personal',
  'my_events',
]);

const PRIVILEGED_STAFF_ROLE_NAMES = new Set(['school_admin', 'principal']);

const OPERATIONAL_STAFF_ROLE_NAMES = new Set([
  'academic_coordinator',
  'admin_assistant',
  'class_teacher',
  'subject_teacher',
  'guidance_counselor',
]);

const NON_TEACHER_OPERATIONAL_STAFF_ROLE_NAMES = new Set([
  'academic_coordinator',
  'admin_assistant',
  'guidance_counselor',
]);

function isFeatureHardDeniedForFamilyRole(
  roleName: string | undefined,
  featureCode: string | undefined,
): boolean {
  const role = (roleName ?? '').toLowerCase();
  const code = featureCode ?? '';
  if (!code || (role !== 'parent' && role !== 'student')) return false;
  if (FAMILY_HARD_DENIED_FEATURE_CODES.has(code)) return true;
  if (role === 'parent' && PARENT_HARD_DENIED_FEATURE_CODES.has(code)) return true;
  if (role === 'student' && STUDENT_HARD_DENIED_FEATURE_CODES.has(code)) return true;
  return false;
}

function isFeatureHardDeniedForOperationalStaffRole(
  roleName: string | undefined,
  featureCode: string | undefined,
): boolean {
  const role = (roleName ?? '').toLowerCase();
  const code = featureCode ?? '';
  if (!code || PRIVILEGED_STAFF_ROLE_NAMES.has(role)) return false;
  if (!OPERATIONAL_STAFF_ROLE_NAMES.has(role)) return false;
  if (OPERATIONAL_STAFF_HARD_DENIED_FAMILY_FEATURE_CODES.has(code)) return true;
  if (
    NON_TEACHER_STAFF_HARD_DENIED_FAMILY_FEATURE_CODES.has(code) &&
    NON_TEACHER_OPERATIONAL_STAFF_ROLE_NAMES.has(role)
  ) {
    return true;
  }
  return false;
}

function isPermissionMatrixCellLocked(
  roleName: string | undefined,
  featureCode: string | undefined,
): boolean {
  return (
    isFeatureHardDeniedForFamilyRole(roleName, featureCode) ||
    isFeatureHardDeniedForOperationalStaffRole(roleName, featureCode)
  );
}

type RoleRow = {
  id: string;
  name: string;
  display_name: string;
  display_name_ar: string | null;
  description: string | null;
  created_at: string;
};

type FeatureRow = {
  id: string;
  code: string;
  name: string;
  created_at: string;
};

type PermissionRow = {
  id: string;
  role_id: string;
  feature_id: string;
  permission: 'none' | 'view' | 'edit';
  branch_id: string;
  updated_at: string;
};

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

@Injectable()
export class RolesService {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  async listRoles(): Promise<RoleDto[]> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .order('display_name', { ascending: true });

    throwIfDbError(error);
    return (data as RoleRow[]).map(
      (row) =>
        new RoleDto({
          id: row.id,
          name: row.name,
          displayName: row.display_name,
          displayNameAr: row.display_name_ar ?? undefined,
          description: row.description ?? undefined,
          createdAt: row.created_at,
        }),
    );
  }

  async listFeatures(): Promise<FeatureDto[]> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('features')
      .select('*')
      .order('name', { ascending: true });

    throwIfDbError(error);
    return (data as FeatureRow[]).map(
      (row) =>
        new FeatureDto({
          id: row.id,
          code: row.code,
          name: row.name,
          createdAt: row.created_at,
        }),
    );
  }

  async getPermissionMatrix(branchId: string): Promise<PermissionMatrixDto[]> {
    const supabase = this.supabaseConfig.getClient();

    const { data, error } = await supabase
      .from('role_permissions')
      .select(
        `
        id,
        role_id,
        feature_id,
        permission,
        branch_id,
        updated_at,
        roles:role_id (
          id,
          name,
          display_name
        ),
        features:feature_id (
          id,
          code,
          name
        )
      `,
      )
      .eq('branch_id', branchId);

    throwIfDbError(error);

    const rows = data as unknown as Array<{
      id: string;
      role_id: string;
      feature_id: string;
      permission: 'none' | 'view' | 'edit';
      branch_id: string;
      updated_at: string;
      roles: RoleRow | RoleRow[] | null;
      features: FeatureRow | FeatureRow[] | null;
    }>;

    return rows
      .map((row) => {
        const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
        const feature = Array.isArray(row.features) ? row.features[0] : row.features;

        if (!role || !feature) return null;

        return new PermissionMatrixDto({
          roleId: row.role_id,
          roleName: role.display_name,
          featureId: row.feature_id,
          featureCode: feature.code,
          permission: row.permission,
          branchId: row.branch_id,
          updatedAt: row.updated_at,
        });
      })
      .filter((item): item is PermissionMatrixDto => item !== null);
  }

  async updatePermissions(
    branchId: string,
    input: UpdatePermissionsDto,
  ): Promise<PermissionMatrixDto[]> {
    const supabase = this.supabaseConfig.getClient();

    // Get all roles and features first to ensure they exist
    const roles = await this.listRoles();
    const features = await this.listFeatures();

    const roleMap = new Map(roles.map((r) => [r.id, r]));
    const featureMap = new Map(features.map((f) => [f.id, f]));

    // Coerce family × staff locks to none (do not trust client)
    const permissionRows = input.permissions.map((perm) => {
      const role = roleMap.get(perm.roleId);
      const feature = featureMap.get(perm.featureId);
      if (!role) {
        throw new BadRequestException(`Role ${perm.roleId} not found`);
      }
      if (!feature) {
        throw new BadRequestException(`Feature ${perm.featureId} not found`);
      }
      if (!['none', 'view', 'edit'].includes(perm.permission)) {
        throw new BadRequestException(
          `Invalid permission value: ${perm.permission}. Must be 'none', 'view', or 'edit'`,
        );
      }
      const locked = isPermissionMatrixCellLocked(role.name, feature.code);
      return {
        role_id: perm.roleId,
        feature_id: perm.featureId,
        branch_id: branchId,
        permission: locked ? 'none' : perm.permission,
        updated_at: new Date().toISOString(),
      };
    });

    const { error: upsertError } = await supabase
      .from('role_permissions')
      .upsert(permissionRows, {
        onConflict: 'role_id,feature_id,branch_id',
      });

    if (upsertError) {
      throw new BadRequestException(
        `Failed to update permissions: ${upsertError.message}`,
      );
    }

    // Return updated matrix
    return this.getPermissionMatrix(branchId);
  }
}


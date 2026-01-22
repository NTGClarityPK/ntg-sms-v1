import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import type { PostgrestError } from '@supabase/supabase-js';
import { RoleDto } from './dto/role.dto';
import { FeatureDto } from './dto/feature.dto';
import { PermissionMatrixDto, UpdatePermissionsDto } from './dto/permission-matrix.dto';

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

    // Validate all role and feature IDs exist
    for (const perm of input.permissions) {
      if (!roleMap.has(perm.roleId)) {
        throw new BadRequestException(`Role ${perm.roleId} not found`);
      }
      if (!featureMap.has(perm.featureId)) {
        throw new BadRequestException(`Feature ${perm.featureId} not found`);
      }
      if (!['none', 'view', 'edit'].includes(perm.permission)) {
        throw new BadRequestException(
          `Invalid permission value: ${perm.permission}. Must be 'none', 'view', or 'edit'`,
        );
      }
    }

    // Upsert permissions - use a single upsert with all permissions for better performance
    const permissionRows = input.permissions.map((perm) => ({
      role_id: perm.roleId,
      feature_id: perm.featureId,
      branch_id: branchId,
      permission: perm.permission,
      updated_at: new Date().toISOString(),
    }));

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


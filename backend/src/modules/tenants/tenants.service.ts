import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { TenantDto } from './dto/tenant.dto';

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

type TenantRow = {
  id: string;
  name: string;
  code: string;
  domain: string | null;
  is_active: boolean;
  logo_url: string | null;
};

type SystemSettingRow = {
  key: string;
  value: unknown;
};

function mapTenant(row: TenantRow, primaryColor?: string | null): TenantDto {
  return new TenantDto({
    id: row.id,
    name: row.name,
    code: row.code,
    domain: row.domain,
    isActive: row.is_active,
    logoUrl: row.logo_url,
    primaryColor: primaryColor ?? null,
  });
}

type UploadedLogoFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

@Injectable()
export class TenantsService {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  private getThemeSettingKey(tenantId: string): string {
    return `tenant_theme_primary_color:${tenantId}`;
  }

  async getMe(tenantId: string | null): Promise<{ data: TenantDto }> {
    if (!tenantId) throw new BadRequestException('Tenant not resolved from branch');
    const supabase = this.supabaseConfig.getClient();

    const { data, error } = await supabase
      .from('tenants')
      .select('id, name, code, domain, is_active, logo_url')
      .eq('id', tenantId)
      .maybeSingle();

    throwIfDbError(error);
    if (!data) throw new NotFoundException('Tenant not found');

    const themeSettingKey = this.getThemeSettingKey(tenantId);
    const { data: themeSetting, error: themeError } = await supabase
      .from('system_settings')
      .select('key, value')
      .eq('key', themeSettingKey)
      .maybeSingle();

    throwIfDbError(themeError);
    const primaryColor =
      (themeSetting as SystemSettingRow | null)?.value &&
      typeof (themeSetting as SystemSettingRow).value === 'string'
        ? ((themeSetting as SystemSettingRow).value as string)
        : null;

    return { data: mapTenant(data as TenantRow, primaryColor) };
  }

  async updateMe(
    tenantId: string | null,
    updates: { name?: string; primaryColor?: string },
  ): Promise<{ data: TenantDto }> {
    if (!tenantId) throw new BadRequestException('Tenant not resolved from branch');
    if (!updates.name && !updates.primaryColor) {
      throw new BadRequestException('No fields to update');
    }

    const supabase = this.supabaseConfig.getClient();
    let tenantData: TenantRow | null = null;

    if (updates.name) {
      const { data, error } = await supabase
        .from('tenants')
        .update({ name: updates.name })
        .eq('id', tenantId)
        .select('id, name, code, domain, is_active, logo_url')
        .single();

      throwIfDbError(error);
      tenantData = data as TenantRow;
    } else {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, code, domain, is_active, logo_url')
        .eq('id', tenantId)
        .single();
      throwIfDbError(error);
      tenantData = data as TenantRow;
    }

    let primaryColor: string | null = null;
    if (updates.primaryColor) {
      const themeSettingKey = this.getThemeSettingKey(tenantId);
      const { error: upsertThemeError } = await supabase.from('system_settings').upsert(
        {
          key: themeSettingKey,
          value: updates.primaryColor,
        },
        { onConflict: 'key' },
      );
      throwIfDbError(upsertThemeError);
      primaryColor = updates.primaryColor;
    } else {
      const themeSettingKey = this.getThemeSettingKey(tenantId);
      const { data: themeSetting, error: themeError } = await supabase
        .from('system_settings')
        .select('key, value')
        .eq('key', themeSettingKey)
        .maybeSingle();
      throwIfDbError(themeError);
      if (themeSetting && typeof (themeSetting as SystemSettingRow).value === 'string') {
        primaryColor = (themeSetting as SystemSettingRow).value as string;
      }
    }

    return { data: mapTenant(tenantData, primaryColor) };
  }

  async uploadLogo(tenantId: string | null, file: UploadedLogoFile): Promise<{ data: TenantDto }> {
    if (!tenantId) throw new BadRequestException('Tenant not resolved from branch');
    if (!file) throw new BadRequestException('Logo file is required');

    const supabase = this.supabaseConfig.getClient();
    const extension = (file.originalname.split('.').pop() || 'png').toLowerCase();
    const fileName = `${tenantId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('school-logos')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      throw new BadRequestException(uploadError.message);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('school-logos').getPublicUrl(fileName);

    const { data, error } = await supabase
      .from('tenants')
      .update({ logo_url: publicUrl })
      .eq('id', tenantId)
      .select('id, name, code, domain, is_active, logo_url')
      .single();

    throwIfDbError(error);
    const themeSettingKey = this.getThemeSettingKey(tenantId);
    const { data: themeSetting, error: themeError } = await supabase
      .from('system_settings')
      .select('key, value')
      .eq('key', themeSettingKey)
      .maybeSingle();
    throwIfDbError(themeError);
    const primaryColor =
      themeSetting && typeof (themeSetting as SystemSettingRow).value === 'string'
        ? ((themeSetting as SystemSettingRow).value as string)
        : null;

    return { data: mapTenant(data as TenantRow, primaryColor) };
  }
}









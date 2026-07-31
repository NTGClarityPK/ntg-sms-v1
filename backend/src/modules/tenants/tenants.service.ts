import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import {
  normalizeTenantDefaultLocale,
  SYSTEM_DEFAULT_LOCALE,
  type TenantDefaultLocale,
} from '../../common/utils/locale.util';
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
  email: string | null;
  phone: string | null;
  timezone: string | null;
  fiscal_year_start: string | null;
  vat_number: string | null;
  default_locale: string | null;
  is_active: boolean;
  logo_url: string | null;
  deletion_status: 'none' | 'pending' | 'executing' | null;
  deletion_requested_at: string | null;
  deletion_execute_at: string | null;
  deletion_cancelled_at: string | null;
  deletion_requested_by: string | null;
  pre_deletion_is_active: boolean | null;
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
    email: row.email,
    phone: row.phone,
    timezone: row.timezone,
    fiscalYearStart: row.fiscal_year_start,
    vatNumber: row.vat_number,
    defaultLocale: normalizeTenantDefaultLocale(row.default_locale ?? SYSTEM_DEFAULT_LOCALE),
    isActive: row.is_active,
    logoUrl: row.logo_url,
    primaryColor: primaryColor ?? null,
    deletionStatus: row.deletion_status ?? 'none',
    deletionRequestedAt: row.deletion_requested_at,
    deletionExecuteAt: row.deletion_execute_at,
    deletionCancelledAt: row.deletion_cancelled_at,
    deletionRequestedBy: row.deletion_requested_by,
    preDeletionIsActive: row.pre_deletion_is_active,
  });
}

const TENANT_SELECT =
  'id, name, code, domain, email, phone, timezone, fiscal_year_start, vat_number, default_locale, is_active, logo_url, deletion_status, deletion_requested_at, deletion_execute_at, deletion_cancelled_at, deletion_requested_by, pre_deletion_is_active';

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
      .select(TENANT_SELECT)
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
    updates: {
      name?: string;
      domain?: string;
      email?: string;
      phone?: string;
      timezone?: string;
      fiscalYearStart?: string;
      vatNumber?: string;
      defaultLocale?: TenantDefaultLocale;
      primaryColor?: string;
    },
    _userEmail: string,
  ): Promise<{ data: TenantDto }> {
    if (!tenantId) throw new BadRequestException('Tenant not resolved from branch');
    const hasTenantUpdates =
      updates.name !== undefined ||
      updates.domain !== undefined ||
      updates.email !== undefined ||
      updates.phone !== undefined ||
      updates.timezone !== undefined ||
      updates.fiscalYearStart !== undefined ||
      updates.vatNumber !== undefined ||
      updates.defaultLocale !== undefined;

    if (!hasTenantUpdates && !updates.primaryColor) {
      throw new BadRequestException('No fields to update');
    }

    const supabase = this.supabaseConfig.getClient();
    let tenantData: TenantRow | null = null;

    if (hasTenantUpdates) {
      const updateData: Partial<TenantRow> = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.domain !== undefined) updateData.domain = updates.domain || null;
      if (updates.email !== undefined) updateData.email = updates.email || null;
      if (updates.phone !== undefined) updateData.phone = updates.phone || null;
      if (updates.timezone !== undefined) updateData.timezone = updates.timezone || null;
      if (updates.fiscalYearStart !== undefined) updateData.fiscal_year_start = updates.fiscalYearStart || null;
      if (updates.vatNumber !== undefined) updateData.vat_number = updates.vatNumber || null;
      if (updates.defaultLocale !== undefined) {
        updateData.default_locale = normalizeTenantDefaultLocale(updates.defaultLocale);
      }
      const { data, error } = await supabase
        .from('tenants')
        .update(updateData)
        .eq('id', tenantId)
        .select(TENANT_SELECT)
        .single();

      throwIfDbError(error);
      tenantData = data as TenantRow;
    } else {
      const { data, error } = await supabase
        .from('tenants')
        .select(TENANT_SELECT)
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

  async uploadLogo(
    tenantId: string | null,
    file: UploadedLogoFile,
    _userEmail: string,
  ): Promise<{ data: TenantDto }> {
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
      .select(TENANT_SELECT)
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

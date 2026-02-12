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

function mapTenant(row: TenantRow): TenantDto {
  return new TenantDto({
    id: row.id,
    name: row.name,
    code: row.code,
    domain: row.domain,
    isActive: row.is_active,
    logoUrl: row.logo_url,
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
    return { data: mapTenant(data as TenantRow) };
  }

  async updateMe(tenantId: string | null, updates: { name?: string }): Promise<{ data: TenantDto }> {
    if (!tenantId) throw new BadRequestException('Tenant not resolved from branch');
    if (!updates.name) throw new BadRequestException('No fields to update');

    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('tenants')
      .update({ name: updates.name })
      .eq('id', tenantId)
      .select('id, name, code, domain, is_active, logo_url')
      .single();

    throwIfDbError(error);
    return { data: mapTenant(data as TenantRow) };
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
    return { data: mapTenant(data as TenantRow) };
  }
}









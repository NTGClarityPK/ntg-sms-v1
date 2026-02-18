import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { SystemSettingDto } from './dto/system-setting.dto';

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

type SystemSettingRow = {
  key: string;
  value: unknown;
  created_at: string;
  updated_at: string;
};

function mapSetting(row: SystemSettingRow): SystemSettingDto {
  return new SystemSettingDto({
    key: row.key,
    value: row.value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

@Injectable()
export class SystemSettingsService {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  async getAll(): Promise<{ data: SystemSettingDto[] }> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase.from('system_settings').select('*').order('key', { ascending: true });
    throwIfDbError(error);
    return { data: ((data as SystemSettingRow[]) ?? []).map(mapSetting) };
  }

  /** Keys that return an empty array when missing (no 404). */
  private static readonly OPTIONAL_LIST_KEYS = [
    'inventory_categories',
    'inventory_sizes',
    'library_categories',
  ];

  async getByKey(key: string): Promise<{ data: SystemSettingDto }> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase.from('system_settings').select('*').eq('key', key).maybeSingle();
    throwIfDbError(error);
    if (!data) {
      if (SystemSettingsService.OPTIONAL_LIST_KEYS.includes(key)) {
        const now = new Date().toISOString();
        return {
          data: new SystemSettingDto({
            key,
            value: [],
            createdAt: now,
            updatedAt: now,
          }),
        };
      }
      throw new NotFoundException('Setting not found');
    }
    return { data: mapSetting(data as SystemSettingRow) };
  }

  async upsert(key: string, value: unknown): Promise<{ data: SystemSettingDto }> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('system_settings')
      .upsert({ key, value }, { onConflict: 'key' })
      .select('*')
      .single();
    throwIfDbError(error);
    return { data: mapSetting(data as SystemSettingRow) };
  }
}



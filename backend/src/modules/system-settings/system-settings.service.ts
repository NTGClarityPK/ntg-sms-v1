import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { DEFAULT_BEHAVIOURAL_ATTRIBUTE_NAMES } from '../../common/constants/default-behavioral-attributes';
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

  /** Keys that return a default object when missing (no 404). */
  private static readonly OPTIONAL_OBJECT_DEFAULTS: Readonly<
    Record<string, Record<string, unknown>>
  > = {
    communication_branch_broadcast: {
      allow_admin_assistant: false,
      allow_principal: false,
    },
    behavioral_assessment: {
      enabled: false,
      mandatory: false,
      attributes: [...DEFAULT_BEHAVIOURAL_ATTRIBUTE_NAMES],
    },
  };

  async getByKey(key: string): Promise<{ data: SystemSettingDto }> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase.from('system_settings').select('*').eq('key', key).maybeSingle();
    throwIfDbError(error);
    if (!data) {
      const isOptionalListKey =
        SystemSettingsService.OPTIONAL_LIST_KEYS.includes(key) ||
        key.startsWith('student_leave_request_class_ids:');
      if (isOptionalListKey) {
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
      const objectDefault = SystemSettingsService.OPTIONAL_OBJECT_DEFAULTS[key];
      if (objectDefault) {
        const now = new Date().toISOString();
        const valueOut =
          key === 'behavioral_assessment'
            ? {
                enabled: Boolean((objectDefault as { enabled?: boolean }).enabled),
                mandatory: Boolean((objectDefault as { mandatory?: boolean }).mandatory),
                attributes: [...((objectDefault as { attributes?: string[] }).attributes ?? [])],
              }
            : { ...objectDefault };
        return {
          data: new SystemSettingDto({
            key,
            value: valueOut,
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



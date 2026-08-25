import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new ForbiddenException(error.message);
}

export type PromotionWindowStatus = {
  enabled: boolean;
  open: boolean;
  opensOn: string | null;
  manualOverride: boolean;
};

@Injectable()
export class PromotionWindowService {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  async getWindowStatus(branchId: string, academicYearId: string): Promise<PromotionWindowStatus> {
    const supabase = this.supabaseConfig.getClient();

    // Fetch the three promotion settings in parallel
    const [enabledRes, daysRes, manualRes, yearRes] = await Promise.all([
      supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'promotion_module_enabled')
        .maybeSingle(),
      supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'promotion_window_days')
        .maybeSingle(),
      supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'promotion_window_manual_open')
        .maybeSingle(),
      supabase
        .from('academic_years')
        .select('end_date')
        .eq('id', academicYearId)
        .maybeSingle(),
    ]);

    throwIfDbError(enabledRes.error);
    throwIfDbError(daysRes.error);
    throwIfDbError(manualRes.error);
    throwIfDbError(yearRes.error);

    // Defaults: enabled=true, windowDays=45, manualOpen=false
    const enabled: boolean =
      enabledRes.data == null ? true : Boolean((enabledRes.data as { value: unknown }).value);
    const windowDays: number =
      daysRes.data == null ? 45 : Number((daysRes.data as { value: unknown }).value) || 45;
    const manualOverride: boolean =
      manualRes.data == null ? false : Boolean((manualRes.data as { value: unknown }).value);

    if (!yearRes.data) throw new NotFoundException('Academic year not found');
    const endDateStr = (yearRes.data as { end_date: string }).end_date;
    const endDate = new Date(endDateStr);

    // Calculate the date when the window opens
    const windowOpenDate = new Date(endDate);
    windowOpenDate.setDate(windowOpenDate.getDate() - windowDays);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const open = manualOverride || today >= windowOpenDate;
    const opensOn = open ? null : windowOpenDate.toISOString().slice(0, 10);

    return { enabled, open, opensOn, manualOverride };
  }

  async assertPromotionWindowOpen(branchId: string, academicYearId: string): Promise<void> {
    const status = await this.getWindowStatus(branchId, academicYearId);

    if (!status.enabled) {
      throw new ForbiddenException(
        'The Promotion & Placement module is disabled. Enable it in Settings before saving decisions.',
      );
    }

    if (!status.open) {
      throw new ForbiddenException(
        `Promotion decisions cannot be saved yet. The promotion window opens on ${status.opensOn}. Ask an admin to force-open it early in Settings if needed.`,
      );
    }
  }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import {
  DEFAULT_BEHAVIOURAL_ASSESSMENT_VALUE,
  DEFAULT_BEHAVIOURAL_ATTRIBUTE_NAMES,
} from '../../common/constants/default-behavioral-attributes';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { CommitSetupWizardDto } from './dto/commit-setup-wizard.dto';

function throwIfDbError(error: PostgrestError | null): void {
  if (error) throw new BadRequestException(error.message);
}

@Injectable()
export class SetupWizardService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly systemSettingsService: SystemSettingsService,
  ) {}

  async commitSetupWizard(input: {
    payload: CommitSetupWizardDto;
    branchId: string;
    tenantId: string | null;
    userEmail: string;
  }): Promise<{ data: { success: boolean; academicYearId?: string | null } }> {
    if (!input.tenantId) throw new BadRequestException('Tenant not found for current branch');

    const supabase = this.supabaseConfig.getClient();
    // Step 7 (permissions UI) was removed; default roles/permissions are handled in the RPC.
    // Keep payload backward-compatible for older clients by always sending an array.
    const payload = {
      ...input.payload,
      permissions: Array.isArray((input.payload as any).permissions) ? (input.payload as any).permissions : [],
    } as CommitSetupWizardDto;

    const termExaminationTypeCount = (payload.assessment?.assessmentTypes ?? []).filter(
      (t) => t.isTermExamination === true,
    ).length;
    if (termExaminationTypeCount < 2) {
      throw new BadRequestException(
        'At least two assessment types must be marked as term examinations before completing setup.',
      );
    }

    const { data, error } = await supabase.rpc('commit_setup_wizard', {
      p_payload: payload,
      p_branch_id: input.branchId,
      p_tenant_id: input.tenantId,
      p_user_email: input.userEmail,
    });
    throwIfDbError(error);

    const result =
      data && typeof data === 'object'
        ? (data as { success?: boolean; academicYearId?: string | null })
        : undefined;

    if (result?.success === true) {
      await this.persistBehavioralAssessmentAfterWizard(payload.behavior);
    }

    return {
      data: {
        success: result?.success === true,
        academicYearId: result?.academicYearId ?? null,
      },
    };
  }

  private async persistBehavioralAssessmentAfterWizard(
    behavior: CommitSetupWizardDto['behavior'],
  ): Promise<void> {
    const defaults = [...DEFAULT_BEHAVIOURAL_ATTRIBUTE_NAMES];
    if (!behavior) {
      await this.systemSettingsService.upsert('behavioral_assessment', {
        ...DEFAULT_BEHAVIOURAL_ASSESSMENT_VALUE,
        attributes: defaults,
      });
      return;
    }
    const rawAttrs = (behavior.attributes ?? []).map((a) => String(a).trim()).filter((a) => a.length > 0);
    const attributes = rawAttrs.length > 0 ? [...new Set(rawAttrs)] : defaults;
    await this.systemSettingsService.upsert('behavioral_assessment', {
      enabled: behavior.enabled,
      mandatory: behavior.mandatory,
      attributes,
    });
  }
}


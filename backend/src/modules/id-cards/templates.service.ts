import { Injectable } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import type { PostgrestError } from '@supabase/supabase-js';
import { BadRequestException } from '@nestjs/common';
import { IdCardTemplateDto } from './dto/id-card-template.dto';
import type { IdCardRoleType, IdCardCardSide } from './types/id-card-person-type';

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

const DEFAULT_TEMPLATE_SEEDS: Array<{
  name: string;
  roleType: IdCardRoleType;
  cardSide: IdCardCardSide;
  htmlTemplateKey: string;
  isDefault: boolean;
}> = [
  { name: 'Placeholder Student Front', roleType: 'student', cardSide: 'front', htmlTemplateKey: 'placeholder-student-front', isDefault: true },
  { name: 'Placeholder Student Back', roleType: 'student', cardSide: 'back', htmlTemplateKey: 'placeholder-student-back', isDefault: true },
  { name: 'Placeholder Staff Front', roleType: 'staff', cardSide: 'front', htmlTemplateKey: 'placeholder-staff-front', isDefault: true },
  { name: 'Placeholder Staff Back', roleType: 'staff', cardSide: 'back', htmlTemplateKey: 'placeholder-staff-back', isDefault: true },
  { name: 'Modern Student Front', roleType: 'student', cardSide: 'front', htmlTemplateKey: 'modern-student-front', isDefault: false },
  { name: 'Modern Student Back', roleType: 'student', cardSide: 'back', htmlTemplateKey: 'modern-student-back', isDefault: false },
  { name: 'Minimal Student Front', roleType: 'student', cardSide: 'front', htmlTemplateKey: 'minimal-student-front', isDefault: false },
  { name: 'Minimal Student Back', roleType: 'student', cardSide: 'back', htmlTemplateKey: 'minimal-student-back', isDefault: false },
];

@Injectable()
export class TemplatesService {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  async ensureDefaultTemplates(branchId: string): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    const { count, error } = await supabase
      .from('id_card_templates')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId);
    throwIfDbError(error);
    if ((count ?? 0) > 0) return;

    const rows = DEFAULT_TEMPLATE_SEEDS.map((t) => ({
      branch_id: branchId,
      name: t.name,
      role_type: t.roleType,
      card_side: t.cardSide,
      html_template_key: t.htmlTemplateKey,
      is_default: t.isDefault,
      is_active: true,
    }));
    const { error: insErr } = await supabase.from('id_card_templates').insert(rows);
    throwIfDbError(insErr);
  }

  async listTemplates(
    branchId: string,
    roleType?: IdCardRoleType,
  ): Promise<{ data: IdCardTemplateDto[] }> {
    await this.ensureDefaultTemplates(branchId);
    const supabase = this.supabaseConfig.getClient();
    let q = supabase
      .from('id_card_templates')
      .select('id, branch_id, name, role_type, card_side, html_template_key, is_default, is_active')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('role_type')
      .order('card_side');
    if (roleType) q = q.eq('role_type', roleType);
    const { data, error } = await q;
    throwIfDbError(error);
    return {
      data: (data || []).map(
        (r) =>
          new IdCardTemplateDto({
            id: (r as { id: string }).id,
            branchId: (r as { branch_id: string }).branch_id,
            name: (r as { name: string }).name,
            roleType: (r as { role_type: IdCardRoleType }).role_type,
            cardSide: (r as { card_side: IdCardCardSide }).card_side,
            htmlTemplateKey: (r as { html_template_key: string }).html_template_key,
            isDefault: (r as { is_default: boolean }).is_default,
            isActive: (r as { is_active: boolean }).is_active,
          }),
      ),
    };
  }

  async resolveTemplateKeys(
    branchId: string,
    roleType: IdCardRoleType,
    templateId?: string,
  ): Promise<{ frontKey: string; backKey: string; templateRowId: string | null }> {
    await this.ensureDefaultTemplates(branchId);
    const supabase = this.supabaseConfig.getClient();
    if (templateId) {
      const { data: one, error } = await supabase
        .from('id_card_templates')
        .select('id, html_template_key, card_side, role_type')
        .eq('id', templateId)
        .eq('branch_id', branchId)
        .maybeSingle();
      throwIfDbError(error);
      if (!one) throw new BadRequestException('Template not found');
      const front = await this.getSideKey(branchId, (one as { role_type: IdCardRoleType }).role_type, 'front');
      const back = await this.getSideKey(branchId, (one as { role_type: IdCardRoleType }).role_type, 'back');
      return { frontKey: front, backKey: back, templateRowId: templateId };
    }
    const frontKey = await this.getSideKey(branchId, roleType, 'front');
    const backKey = await this.getSideKey(branchId, roleType, 'back');
    return { frontKey, backKey, templateRowId: null };
  }

  private async getSideKey(
    branchId: string,
    roleType: IdCardRoleType,
    side: IdCardCardSide,
  ): Promise<string> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('id_card_templates')
      .select('html_template_key')
      .eq('branch_id', branchId)
      .eq('role_type', roleType)
      .eq('card_side', side)
      .eq('is_default', true)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    throwIfDbError(error);
    const key = (data as { html_template_key?: string } | null)?.html_template_key;
    if (!key) {
      return roleType === 'student'
        ? side === 'front'
          ? 'placeholder-student-front'
          : 'placeholder-student-back'
        : side === 'front'
          ? 'placeholder-staff-front'
          : 'placeholder-staff-back';
    }
    return key;
  }
}

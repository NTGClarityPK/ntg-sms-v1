import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { CertificateTemplateService } from './certificate-template.service';
import { CertificatePdfService } from './certificate-pdf.service';
import { CertificateStudentDataService } from './certificate-student-data.service';
import {
  buildCertificateRenderContext,
  type CertificateBranchSnapshot,
  type CertificateSettingsSnapshot,
} from './certificate-render.mapper';
import { getTemplateIdForType } from './utils/certificate-type.util';
import { throwIfDbError } from './utils/throw-if-db-error.util';
import { normalizeSignatureLabelsByType } from './utils/certificate-signature-labels.util';
import {
  resolveSignatureLabelsForType,
} from './utils/certificate-signature-labels.util';
import { resolveSignatureSlotNames } from './utils/resolve-signature-slot-names.util';
import { CertificateIssueFormDefaultsDto } from './dto/certificate-issue-form-defaults.dto';
import type { CertificateType, CertificateTemplateId } from './types/certificate.types';
import { IssueCertificateDto, GeneratePreviewDto } from './dto/issue-certificate.dto';
import { QueryCertificateHistoryDto } from './dto/query-certificate-history.dto';
import { UpdateCertificateSettingsDto } from './dto/update-certificate-settings.dto';
import {
  CertificateDto,
  CertificateDesignDto,
  CertificateSettingsDto,
} from './dto/certificate.dto';

type CertificateRow = {
  id: string;
  branch_id: string;
  student_id: string;
  certificate_type: CertificateType;
  template_id: CertificateTemplateId;
  certificate_number: string;
  certificate_data: Record<string, unknown>;
  issued_by: string | null;
  issued_at: string;
  pdf_storage_path: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class CertificatesService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly templateService: CertificateTemplateService,
    private readonly pdfService: CertificatePdfService,
    private readonly studentDataService: CertificateStudentDataService,
  ) {}

  listDesigns(): { data: CertificateDesignDto[] } {
    return { data: this.templateService.listDesigns() };
  }

  async getSettings(branchId: string): Promise<{ data: CertificateSettingsDto }> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('certificate_settings')
      .select(
        'branch_id, school_logo_url, primary_color, school_tagline, principal_name, registrar_name, school_established, signature_labels_by_type',
      )
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);

    if (!data) {
      const branchMeta = await this.loadBranchSnapshot(branchId);
      const tenantLogo = await this.resolveTenantLogo(branchId);
      return {
        data: {
          branchId,
          schoolLogoUrl: tenantLogo,
          primaryColor: '#537D5D',
          schoolTagline: null,
          principalName: null,
          registrarName: null,
          schoolEstablished: null,
          signatureLabelsByType: {},
        },
      };
    }

    const row = data as {
      branch_id: string;
      school_logo_url: string | null;
      primary_color: string;
      school_tagline: string | null;
      principal_name: string | null;
      registrar_name: string | null;
      school_established: string | null;
      signature_labels_by_type: unknown;
    };

    return {
      data: {
        branchId: row.branch_id,
        schoolLogoUrl: row.school_logo_url,
        primaryColor: row.primary_color,
        schoolTagline: row.school_tagline,
        principalName: row.principal_name,
        registrarName: row.registrar_name,
        schoolEstablished: row.school_established,
        signatureLabelsByType: this.parseSignatureLabels(row.signature_labels_by_type),
      },
    };
  }

  async updateSettings(
    branchId: string,
    input: UpdateCertificateSettingsDto,
  ): Promise<{ data: CertificateSettingsDto }> {
    const supabase = this.supabaseConfig.getClient();
    const payload: Record<string, unknown> = {
      branch_id: branchId,
      updated_at: new Date().toISOString(),
    };
    if (input.schoolLogoUrl !== undefined) payload.school_logo_url = input.schoolLogoUrl;
    if (input.primaryColor !== undefined) payload.primary_color = input.primaryColor;
    if (input.schoolTagline !== undefined) payload.school_tagline = input.schoolTagline;
    if (input.principalName !== undefined) payload.principal_name = input.principalName;
    if (input.registrarName !== undefined) payload.registrar_name = input.registrarName;
    if (input.schoolEstablished !== undefined) {
      payload.school_established = input.schoolEstablished;
    }
    if (input.signatureLabelsByType !== undefined) {
      payload.signature_labels_by_type = input.signatureLabelsByType;
    }

    const { error } = await supabase
      .from('certificate_settings')
      .upsert(payload, { onConflict: 'branch_id' });
    throwIfDbError(error);
    return this.getSettings(branchId);
  }

  async uploadLogo(
    branchId: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<{ data: { schoolLogoUrl: string } }> {
    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    const filePath = `${branchId}/logo-${Date.now()}.${ext}`;
    const supabase = this.supabaseConfig.getClient();
    const { error: uploadError } = await supabase.storage
      .from('certificate-documents')
      .upload(filePath, buffer, { contentType: mimeType, upsert: true });
    if (uploadError) throw new BadRequestException(uploadError.message);

    const { data: pub } = supabase.storage
      .from('certificate-documents')
      .getPublicUrl(filePath);

    await this.updateSettings(branchId, { schoolLogoUrl: pub.publicUrl });
    return { data: { schoolLogoUrl: pub.publicUrl } };
  }

  async getIssueFormDefaults(
    branchId: string,
    studentId: string,
    certificateType: CertificateType,
  ): Promise<{ data: CertificateIssueFormDefaultsDto }> {
    await this.studentDataService.assertStudentEligible(
      studentId,
      branchId,
      certificateType,
    );
    const settings = await this.loadSettingsSnapshot(branchId);
    const classTeacherName = await this.studentDataService.resolveClassTeacherName(
      studentId,
      branchId,
    );
    const labels = resolveSignatureLabelsForType(
      certificateType,
      settings.signatureLabelsByType,
    );
    const names = resolveSignatureSlotNames(
      certificateType,
      {},
      settings,
      classTeacherName,
    );
    return {
      data: new CertificateIssueFormDefaultsDto({
        signature1Name: names.signature1Name,
        signature2Name: names.signature2Name,
        signature1Label: labels.signature1,
        signature2Label: labels.signature2,
      }),
    };
  }

  async generatePreview(
    branchId: string,
    input: GeneratePreviewDto,
  ): Promise<{ data: { html: string } }> {
    const html = await this.buildHtmlForIssue(branchId, input, {
      certificateNumber: this.resolveCertificateNumberForPreview(input),
      isRevoked: false,
    });
    return { data: { html } };
  }

  async issue(
    branchId: string,
    userId: string,
    input: IssueCertificateDto,
  ): Promise<{ data: CertificateDto }> {
    await this.studentDataService.assertStudentEligible(
      input.studentId,
      branchId,
      input.certificateType,
    );

    const supabase = this.supabaseConfig.getClient();
    const certificateNumber = await this.allocateCertificateNumber(
      branchId,
      input,
    );

    const templateId = getTemplateIdForType(input.certificateType);
    const html = await this.buildHtmlForIssue(branchId, input, {
      certificateNumber,
      isRevoked: false,
    });
    const pdf = await this.pdfService.renderHtmlToPdf(html, templateId);

    const certId = crypto.randomUUID();
    const filePath = `${branchId}/${certId}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('certificate-documents')
      .upload(filePath, pdf, {
        contentType: 'application/pdf',
        upsert: true,
      });
    if (uploadError) throw new BadRequestException(uploadError.message);

    const { data: inserted, error: insertError } = await supabase
      .from('certificates')
      .insert({
        id: certId,
        branch_id: branchId,
        student_id: input.studentId,
        certificate_type: input.certificateType,
        template_id: templateId,
        certificate_number: certificateNumber,
        certificate_data: input.certificateData,
        issued_by: userId,
        issued_at: new Date().toISOString(),
        pdf_storage_path: filePath,
        status: 'issued',
      })
      .select(
        'id, branch_id, student_id, certificate_type, template_id, certificate_number, certificate_data, issued_by, issued_at, pdf_storage_path, status, created_at, updated_at',
      )
      .single();
    throwIfDbError(insertError);

    const dto = await this.mapRowToDto(inserted as CertificateRow, branchId);
    return { data: dto };
  }

  async findHistory(
    branchId: string,
    query: QueryCertificateHistoryDto,
    options?: { restrictStudentIds?: string[] },
  ): Promise<{
    data: CertificateDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const supabase = this.supabaseConfig.getClient();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let studentIdsFilter: string[] | null = null;
    if (query.classSectionId) {
      const { data: cs, error: csErr } = await supabase
        .from('class_sections')
        .select('class_id, section_id, academic_year_id')
        .eq('id', query.classSectionId)
        .eq('branch_id', branchId)
        .maybeSingle();
      throwIfDbError(csErr);
      if (!cs) throw new NotFoundException('Class section not found');
      const csRow = cs as {
        class_id: string;
        section_id: string;
        academic_year_id: string;
      };
      const { data: enrols, error: enrErr } = await supabase
        .from('student_enrolments')
        .select('student_id')
        .eq('branch_id', branchId)
        .eq('academic_year_id', csRow.academic_year_id)
        .eq('class_id', csRow.class_id)
        .eq('section_id', csRow.section_id);
      throwIfDbError(enrErr);
      studentIdsFilter = (enrols || []).map((e: { student_id: string }) => e.student_id);
      if (studentIdsFilter.length === 0) {
        return {
          data: [],
          meta: { total: 0, page, limit, totalPages: 0 },
        };
      }
    }

    if (options?.restrictStudentIds?.length) {
      studentIdsFilter = studentIdsFilter
        ? studentIdsFilter.filter((id) => options.restrictStudentIds!.includes(id))
        : options.restrictStudentIds;
    }

    let dbQuery = supabase
      .from('certificates')
      .select(
        'id, branch_id, student_id, certificate_type, template_id, certificate_number, certificate_data, issued_by, issued_at, pdf_storage_path, status, created_at, updated_at',
        { count: 'exact' },
      )
      .eq('branch_id', branchId)
      .order('issued_at', { ascending: false })
      .range(from, to);

    if (query.type) dbQuery = dbQuery.eq('certificate_type', query.type);
    if (query.studentId) dbQuery = dbQuery.eq('student_id', query.studentId);
    if (query.status) dbQuery = dbQuery.eq('status', query.status);
    if (query.startDate) dbQuery = dbQuery.gte('issued_at', query.startDate);
    if (query.endDate) dbQuery = dbQuery.lte('issued_at', `${query.endDate}T23:59:59.999Z`);
    if (studentIdsFilter?.length) dbQuery = dbQuery.in('student_id', studentIdsFilter);

    const { data: rows, error, count } = await dbQuery;
    throwIfDbError(error);

    // Lean list mapping: batch student/issuer names only — skip loadStudentSnapshot per row (Nano-safe).
    const list = await this.mapHistoryRowsToDtos((rows || []) as CertificateRow[]);

    const total = count ?? 0;
    return {
      data: list,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async exportHistoryCsv(
    branchId: string,
    query: QueryCertificateHistoryDto,
  ): Promise<string> {
    const { data } = await this.findHistory(branchId, {
      ...query,
      page: 1,
      limit: 500,
    });
    const header =
      'Certificate Number,Student Name,Type,Issued At,Issued By,Status';
    const lines = data.map((c) => {
      const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
      return [
        esc(c.certificateNumber),
        esc(c.studentName),
        esc(c.certificateType),
        esc(c.issuedAt),
        esc(c.issuedByName ?? ''),
        esc(c.status),
      ].join(',');
    });
    return [header, ...lines].join('\n');
  }

  async revoke(branchId: string, id: string): Promise<{ data: CertificateDto }> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('certificates')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('branch_id', branchId)
      .select(
        'id, branch_id, student_id, certificate_type, template_id, certificate_number, certificate_data, issued_by, issued_at, pdf_storage_path, status, created_at, updated_at',
      )
      .maybeSingle();
    throwIfDbError(error);
    if (!data) throw new NotFoundException('Certificate not found');
    return { data: await this.mapRowToDto(data as CertificateRow, branchId) };
  }

  async getPdfBuffer(
    branchId: string,
    id: string,
    options?: { studentIdScope?: string },
  ): Promise<Buffer> {
    const supabase = this.supabaseConfig.getClient();
    let q = supabase
      .from('certificates')
      .select(
        'id, branch_id, student_id, certificate_type, template_id, certificate_number, certificate_data, issued_by, issued_at, pdf_storage_path, status, created_at, updated_at',
      )
      .eq('id', id)
      .eq('branch_id', branchId);
    if (options?.studentIdScope) {
      q = q.eq('student_id', options.studentIdScope);
    }
    const { data, error } = await q.maybeSingle();
    throwIfDbError(error);
    if (!data) throw new NotFoundException('Certificate not found');

    const row = data as CertificateRow;
    if (row.pdf_storage_path) {
      const { data: blob, error: dlError } = await supabase.storage
        .from('certificate-documents')
        .download(row.pdf_storage_path);
      if (!dlError && blob) {
        const buf = Buffer.from(await blob.arrayBuffer());
        if (row.status !== 'revoked') return buf;
      }
    }

    const html = await this.buildHtmlFromRow(branchId, row);
    return this.pdfService.renderHtmlToPdf(
      html,
      row.template_id as CertificateTemplateId,
    );
  }

  private resolveCertificateNumberForPreview(
    input: GeneratePreviewDto | IssueCertificateDto,
  ): string {
    const override = this.readCertificateNumberOverride(input.certificateData);
    return override || 'CERT-PREVIEW-0000';
  }

  private readCertificateNumberOverride(
    data: Record<string, unknown>,
  ): string | null {
    const raw = data.certificateNumberOverride;
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private async allocateCertificateNumber(
    branchId: string,
    input: IssueCertificateDto,
  ): Promise<string> {
    const override = this.readCertificateNumberOverride(input.certificateData);
    if (input.certificateType === 'custom' && override) {
      const supabase = this.supabaseConfig.getClient();
      const { data: existing, error } = await supabase
        .from('certificates')
        .select('id')
        .eq('branch_id', branchId)
        .eq('certificate_number', override)
        .maybeSingle();
      throwIfDbError(error);
      if (existing) {
        throw new BadRequestException(
          'This certificate number is already in use. Choose a different number.',
        );
      }
      return override;
    }

    const supabase = this.supabaseConfig.getClient();
    const { data: certNo, error: noError } = await supabase.rpc(
      'allocate_certificate_number',
      { p_branch_id: branchId },
    );
    throwIfDbError(noError);
    return String(certNo);
  }

  private async buildHtmlForIssue(
    branchId: string,
    input: GeneratePreviewDto | IssueCertificateDto,
    meta: { certificateNumber: string; isRevoked: boolean },
  ): Promise<string> {
    const student = await this.studentDataService.loadStudentSnapshot(
      input.studentId,
      branchId,
    );
    const settings = await this.loadSettingsSnapshot(branchId);
    const branch = await this.loadBranchSnapshot(branchId);
    const academicYearLabel = student.academicSession;
    const classTeacherName = await this.studentDataService.resolveClassTeacherName(
      input.studentId,
      branchId,
    );
    const templateId = getTemplateIdForType(input.certificateType);
    const ctx = buildCertificateRenderContext({
      certificateType: input.certificateType,
      certificateData: input.certificateData,
      student,
      branch,
      settings,
      academicYearLabel,
      classTeacherName,
      certificateNumber: meta.certificateNumber,
      issueDate: new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      isRevoked: meta.isRevoked,
    });
    return this.templateService.renderHtml(
      templateId,
      ctx,
      settings.primaryColor,
    );
  }

  private async buildHtmlFromRow(
    branchId: string,
    row: CertificateRow,
  ): Promise<string> {
    const student = await this.studentDataService.loadStudentSnapshot(
      row.student_id,
      branchId,
    );
    const settings = await this.loadSettingsSnapshot(branchId);
    const branch = await this.loadBranchSnapshot(branchId);
    const classTeacherName = await this.studentDataService.resolveClassTeacherName(
      row.student_id,
      branchId,
    );
    const ctx = buildCertificateRenderContext({
      certificateType: row.certificate_type,
      certificateData: row.certificate_data,
      student,
      branch,
      settings,
      academicYearLabel: student.academicSession,
      classTeacherName,
      certificateNumber: row.certificate_number,
      issueDate: new Date(row.issued_at).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      isRevoked: row.status === 'revoked',
    });
    return this.templateService.renderHtml(
      row.template_id as CertificateTemplateId,
      ctx,
      settings.primaryColor,
    );
  }

  private async loadSettingsSnapshot(
    branchId: string,
  ): Promise<CertificateSettingsSnapshot> {
    const { data } = await this.getSettings(branchId);
    const tenantLogo = await this.resolveTenantLogo(branchId);
    return {
      schoolLogoUrl: data.schoolLogoUrl?.trim() || tenantLogo,
      primaryColor: data.primaryColor,
      schoolTagline: data.schoolTagline,
      principalName: data.principalName,
      registrarName: data.registrarName,
      schoolEstablished: data.schoolEstablished,
      signatureLabelsByType: data.signatureLabelsByType,
    };
  }

  private parseSignatureLabels(raw: unknown) {
    return normalizeSignatureLabelsByType(raw);
  }

  private async loadBranchSnapshot(
    branchId: string,
  ): Promise<CertificateBranchSnapshot> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('branches')
      .select('name, address, phone, email, tenant_id')
      .eq('id', branchId)
      .maybeSingle();
    throwIfDbError(error);
    const row = data as {
      name?: string;
      address?: string;
      phone?: string;
      email?: string;
      tenant_id?: string;
    } | null;

    const branchName = row?.name?.trim() || 'Branch';
    let tenantName = branchName;
    const tenantId = row?.tenant_id;
    if (tenantId) {
      const { data: tenant, error: tenantErr } = await supabase
        .from('tenants')
        .select('name')
        .eq('id', tenantId)
        .maybeSingle();
      throwIfDbError(tenantErr);
      const resolvedTenant = (tenant as { name?: string } | null)?.name?.trim();
      if (resolvedTenant) tenantName = resolvedTenant;
    }

    return {
      tenantName,
      branchName,
      schoolAddress: row?.address?.trim() || '—',
      schoolPhone: row?.phone?.trim() || '—',
      schoolEmail: row?.email?.trim() || '—',
    };
  }

  private async resolveTenantLogo(branchId: string): Promise<string> {
    const supabase = this.supabaseConfig.getClient();
    const { data: branch } = await supabase
      .from('branches')
      .select('tenant_id')
      .eq('id', branchId)
      .maybeSingle();
    const tenantId = (branch as { tenant_id?: string } | null)?.tenant_id;
    if (!tenantId) return '';
    const { data: tenant } = await supabase
      .from('tenants')
      .select('logo_url')
      .eq('id', tenantId)
      .maybeSingle();
    return (tenant as { logo_url?: string } | null)?.logo_url?.trim() ?? '';
  }

  private pdfPublicUrl(path: string | null): string | null {
    if (!path) return null;
    const supabase = this.supabaseConfig.getClient();
    const { data } = supabase.storage.from('certificate-documents').getPublicUrl(path);
    return data.publicUrl;
  }

  /**
   * History/CSV list mapping: one students query + one profiles query for the page.
   * Does not call loadStudentSnapshot (issue/PDF/revoke still use mapRowToDto).
   */
  private async mapHistoryRowsToDtos(rows: CertificateRow[]): Promise<CertificateDto[]> {
    if (rows.length === 0) return [];

    const supabase = this.supabaseConfig.getClient();
    const studentIds = Array.from(new Set(rows.map((r) => r.student_id)));
    const issuerIds = Array.from(
      new Set(rows.map((r) => r.issued_by).filter((id): id is string => !!id)),
    );

    const studentNameById = new Map<string, string>();
    if (studentIds.length > 0) {
      const { data: students } = await supabase
        .from('students')
        .select('id, first_name, last_name')
        .in('id', studentIds);
      for (const s of students ?? []) {
        const row = s as { id: string; first_name?: string | null; last_name?: string | null };
        const name = [row.first_name, row.last_name].filter(Boolean).join(' ');
        studentNameById.set(row.id, name);
      }
    }

    const issuerNameById = new Map<string, string>();
    if (issuerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', issuerIds);
      for (const p of profiles ?? []) {
        const row = p as { id: string; full_name?: string | null };
        if (row.full_name) issuerNameById.set(row.id, row.full_name);
      }
    }

    return rows.map((row) => ({
      id: row.id,
      branchId: row.branch_id,
      studentId: row.student_id,
      studentName: studentNameById.get(row.student_id) ?? '',
      certificateType: row.certificate_type,
      templateId: row.template_id,
      certificateNumber: row.certificate_number,
      certificateData: row.certificate_data,
      issuedBy: row.issued_by,
      issuedByName: row.issued_by ? issuerNameById.get(row.issued_by) ?? null : null,
      issuedAt: row.issued_at,
      pdfUrl: this.pdfPublicUrl(row.pdf_storage_path),
      status: row.status as CertificateDto['status'],
      classSectionLabel: null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  private async mapRowToDto(
    row: CertificateRow,
    branchId: string,
  ): Promise<CertificateDto> {
    const supabase = this.supabaseConfig.getClient();
    const { data: stu } = await supabase
      .from('students')
      .select('first_name, last_name')
      .eq('id', row.student_id)
      .maybeSingle();
    const studentName = stu
      ? [(stu as { first_name?: string }).first_name, (stu as { last_name?: string }).last_name]
          .filter(Boolean)
          .join(' ')
      : '';

    let issuedByName: string | null = null;
    if (row.issued_by) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', row.issued_by)
        .maybeSingle();
      issuedByName = (profile as { full_name?: string } | null)?.full_name ?? null;
    }

    const snapshot = await this.studentDataService.loadStudentSnapshot(
      row.student_id,
      branchId,
    );

    return {
      id: row.id,
      branchId: row.branch_id,
      studentId: row.student_id,
      studentName: studentName || snapshot.studentName,
      certificateType: row.certificate_type,
      templateId: row.template_id,
      certificateNumber: row.certificate_number,
      certificateData: row.certificate_data,
      issuedBy: row.issued_by,
      issuedByName,
      issuedAt: row.issued_at,
      pdfUrl: this.pdfPublicUrl(row.pdf_storage_path),
      status: row.status as CertificateDto['status'],
      classSectionLabel: snapshot.classLastAttended,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

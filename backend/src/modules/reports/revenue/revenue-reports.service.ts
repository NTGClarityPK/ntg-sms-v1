import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { PdfLogoCacheService } from '../../../common/pdf/pdf-logo-cache.service';
import { buildPdfFooterTemplate, buildPdfHeaderTemplate } from '../../../common/pdf/pdf-templates';
import { SupabaseConfig } from '../../../common/config/supabase.config';
import type { RevenueReportDto } from '../dto/revenue-report.dto';
import {
  RevenueReportDetailMode,
  RevenueReportScope,
  type QueryRevenueReportDto,
} from '../dto/query-revenue-report.dto';
import { FeeManagementRevenueProvider } from './fee-management-revenue.provider';
import { IdCardReprintRevenueProvider } from './id-card-reprint-revenue.provider';
import type { RevenueSourceProvider } from './revenue-source.provider';
import {
  REVENUE_SOURCE_PROVIDERS,
  type RevenueSourceKey,
} from './revenue-source.types';
import { loadFeePaymentDetails, loadIdCardReprintDetails } from './revenue-report-details';
import { buildRevenueReportPdfHtml } from './revenue-pdf.builder';
import {
  getPaymentMethodLabel,
  getPersonTypeLabel,
  getReportLabel,
  getRevenueSourceLabel,
  getScopeLabel,
  normalizeRevenueLocale,
} from './revenue-labels.util';

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

const ALL_SOURCE_KEYS: RevenueSourceKey[] = ['fee_management', 'id_card_reprints'];

@Injectable()
export class RevenueReportsService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly pdfLogoCache: PdfLogoCacheService,
    private readonly feeManagementRevenueProvider: FeeManagementRevenueProvider,
    private readonly idCardReprintRevenueProvider: IdCardReprintRevenueProvider,
    @Inject(REVENUE_SOURCE_PROVIDERS)
    private readonly revenueProviders: RevenueSourceProvider[],
  ) {}

  static ensureRevenueAdmin(roles: string[] | undefined): void {
    const normalized = (roles ?? []).map((r) => r.toLowerCase());
    if (
      normalized.includes('school_admin') ||
      normalized.includes('principal') ||
      normalized.includes('super_admin')
    ) {
      return;
    }
    throw new ForbiddenException('Only school admin can view revenue reports');
  }

  async getAccessibleBranchIds(userId: string, tenantId: string | null): Promise<string[]> {
    const supabase = this.supabaseConfig.getClient();
    const { data: userBranches, error: ubErr } = await supabase
      .from('user_branches')
      .select('branch_id')
      .eq('user_id', userId);
    throwIfDbError(ubErr);
    if (!userBranches?.length) return [];

    const branchIds = userBranches.map((ub) => (ub as { branch_id: string }).branch_id);
    let query = supabase.from('branches').select('id').in('id', branchIds).eq('is_active', true);
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }
    const { data: branches, error: bErr } = await query;
    throwIfDbError(bErr);
    return ((branches ?? []) as Array<{ id: string }>).map((b) => b.id);
  }

  async resolveBranchIds(
    query: QueryRevenueReportDto,
    currentBranchId: string,
    tenantId: string | null,
    userId: string,
  ): Promise<string[]> {
    const accessible = await this.getAccessibleBranchIds(userId, tenantId);

    if (query.scope === RevenueReportScope.CURRENT) {
      if (!accessible.includes(currentBranchId)) {
        throw new ForbiddenException('You do not have access to this branch');
      }
      return [currentBranchId];
    }

    if (query.scope === RevenueReportScope.BRANCH) {
      if (!query.branchId) {
        throw new BadRequestException('branchId is required when scope is branch');
      }
      if (!accessible.includes(query.branchId)) {
        throw new ForbiddenException('You do not have access to this branch');
      }
      return [query.branchId];
    }

    if (accessible.length === 0) {
      throw new BadRequestException('No accessible branches');
    }
    return accessible;
  }

  async getRevenueReport(
    query: QueryRevenueReportDto,
    currentBranchId: string,
    tenantId: string | null,
    userId: string,
  ): Promise<{ data: RevenueReportDto }> {
    if (query.startDate > query.endDate) {
      throw new BadRequestException('startDate must be on or before endDate');
    }

    const branchIds = await this.resolveBranchIds(query, currentBranchId, tenantId, userId);
    const scope =
      query.scope === RevenueReportScope.COMBINED
        ? 'combined'
        : query.scope === RevenueReportScope.BRANCH
          ? 'branch'
          : 'current';

    const detailMode =
      query.detail === RevenueReportDetailMode.DETAILED ? 'detailed' : 'summary';

    const branchNames = await this.loadBranchNames(branchIds);
    const enabledCtx = { tenantId };
    const locale = query.locale;

    const providerResults = await Promise.all(
      this.revenueProviders.map(async (provider) => {
        const enabled = await provider.isEnabled(enabledCtx);
        if (!enabled) {
          return {
            sourceKey: provider.sourceKey,
            enabled: false,
            total: 0,
            transactionCount: 0,
            byBranch: {} as Record<string, number>,
            meta: undefined as Record<string, unknown> | undefined,
          };
        }
        const agg = await provider.aggregate({
          branchIds,
          startDate: query.startDate,
          endDate: query.endDate,
          tenantId,
        });
        return {
          sourceKey: provider.sourceKey,
          enabled: true,
          total: agg.total,
          transactionCount: agg.transactionCount,
          byBranch: agg.byBranch,
          meta: agg.meta,
        };
      }),
    );

    const sources = providerResults.map((r) => ({
      sourceKey: r.sourceKey,
      enabled: r.enabled,
      total: r.total,
      transactionCount: r.transactionCount,
    }));

    const grandTotal = roundMoney(sources.reduce((s, r) => s + (r.enabled ? r.total : 0), 0));

    const byBranch: RevenueReportDto['byBranch'] = branchIds.map((branchId) => {
      const sourcesMap = {} as Record<RevenueSourceKey, number>;
      for (const key of ALL_SOURCE_KEYS) {
        sourcesMap[key] = 0;
      }
      let branchTotal = 0;
      for (const pr of providerResults) {
        if (!pr.enabled) continue;
        const amt = pr.byBranch[branchId] ?? 0;
        sourcesMap[pr.sourceKey] = amt;
        branchTotal += amt;
      }
      return {
        branchId,
        branchName: branchNames.get(branchId) ?? branchId,
        total: roundMoney(branchTotal),
        sources: sourcesMap,
      };
    });

    const feeResult = providerResults.find((r) => r.sourceKey === 'fee_management' && r.enabled);
    const feeMeta = feeResult?.meta as {
      byPaymentMethod?: Array<{ methodKey: string; total: number }>;
    } | undefined;

    const branding = await this.loadBranding(
      currentBranchId,
      tenantId,
      scope,
      branchIds,
      branchNames,
      locale,
    );

    const report: RevenueReportDto = {
      scope,
      startDate: query.startDate,
      endDate: query.endDate,
      grandTotal,
      detailMode,
      sources,
      byBranch,
      branding,
    };

    if (feeMeta?.byPaymentMethod?.length) {
      report.feeManagement = { byPaymentMethod: feeMeta.byPaymentMethod };
    }

    if (detailMode === 'detailed') {
      const supabase = this.supabaseConfig.getClient();
      const feeEnabled = sources.find((s) => s.sourceKey === 'fee_management')?.enabled;
      const idEnabled = sources.find((s) => s.sourceKey === 'id_card_reprints')?.enabled;

      const [feeLines, idCardLines] = await Promise.all([
        feeEnabled
          ? loadFeePaymentDetails(supabase, branchIds, query.startDate, query.endDate, branchNames)
          : Promise.resolve([]),
        idEnabled
          ? loadIdCardReprintDetails(supabase, branchIds, query.startDate, query.endDate, branchNames)
          : Promise.resolve([]),
      ]);
      report.feeLines = feeLines;
      report.idCardLines = idCardLines;
    }

    return { data: report };
  }

  async exportRevenueReportExcel(
    query: QueryRevenueReportDto,
    currentBranchId: string,
    tenantId: string | null,
    userId: string,
  ): Promise<Buffer> {
    const { data: report } = await this.getRevenueReport(query, currentBranchId, tenantId, userId);
    const loc = normalizeRevenueLocale(query.locale);
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'NTG SMS';

    const summary = workbook.addWorksheet('Summary');
    summary.columns = [
      { header: getReportLabel('source', loc), key: 'source', width: 28 },
      { header: getReportLabel('total', loc), key: 'total', width: 14 },
      { header: getReportLabel('transactions', loc), key: 'count', width: 14 },
      { header: getReportLabel('enabled', loc), key: 'enabled', width: 10 },
    ];
    report.sources.forEach((s) => {
      summary.addRow({
        source: getRevenueSourceLabel(s.sourceKey, loc),
        total: s.total,
        count: s.transactionCount,
        enabled: s.enabled ? getReportLabel('yes', loc) : getReportLabel('no', loc),
      });
    });
    summary.addRow({});
    summary.addRow({
      source: getReportLabel('grandTotal', loc),
      total: report.grandTotal,
      count: '',
      enabled: '',
    });

    const byBranch = workbook.addWorksheet('By branch');
    byBranch.columns = [
      { header: getReportLabel('branch', loc), key: 'branch', width: 28 },
      { header: getRevenueSourceLabel('fee_management', loc), key: 'fees', width: 18 },
      { header: getRevenueSourceLabel('id_card_reprints', loc), key: 'idCards', width: 18 },
      { header: getReportLabel('total', loc), key: 'total', width: 14 },
    ];
    report.byBranch.forEach((b) => {
      byBranch.addRow({
        branch: b.branchName,
        fees: b.sources.fee_management ?? 0,
        idCards: b.sources.id_card_reprints ?? 0,
        total: b.total,
      });
    });

    if (report.feeManagement?.byPaymentMethod?.length) {
      const methods = workbook.addWorksheet('Payment methods');
      methods.columns = [
        { header: getReportLabel('paymentMethod', loc), key: 'method', width: 22 },
        { header: getReportLabel('total', loc), key: 'total', width: 14 },
      ];
      report.feeManagement.byPaymentMethod.forEach((m) => {
        methods.addRow({
          method: getPaymentMethodLabel(m.methodKey, loc),
          total: m.total,
        });
      });
    }

    if (report.detailMode === 'detailed' && report.feeLines?.length) {
      const fees = workbook.addWorksheet('Fee payments');
      const cols = [
        ...(report.scope === 'combined'
          ? [{ header: getReportLabel('branch', loc), key: 'branch', width: 22 }]
          : []),
        { header: getReportLabel('person', loc), key: 'person', width: 26 },
        { header: getReportLabel('challan', loc), key: 'challan', width: 16 },
        { header: getReportLabel('paymentMethod', loc), key: 'method', width: 18 },
        { header: getReportLabel('date', loc), key: 'date', width: 12 },
        { header: getReportLabel('amount', loc), key: 'amount', width: 12 },
      ];
      fees.columns = cols;
      report.feeLines.forEach((line) => {
        fees.addRow({
          branch: line.branchName,
          person: line.personName,
          challan: line.challanNumber ?? '',
          method: getPaymentMethodLabel(line.paymentMethodKey, loc),
          date: line.paymentDate,
          amount: line.amount,
        });
      });
    }

    if (report.detailMode === 'detailed' && report.idCardLines?.length) {
      const cards = workbook.addWorksheet('ID card fees');
      const cols = [
        ...(report.scope === 'combined'
          ? [{ header: getReportLabel('branch', loc), key: 'branch', width: 22 }]
          : []),
        { header: getReportLabel('person', loc), key: 'person', width: 26 },
        { header: getReportLabel('personType', loc), key: 'type', width: 14 },
        { header: getReportLabel('cardNumber', loc), key: 'card', width: 16 },
        { header: getReportLabel('date', loc), key: 'date', width: 12 },
        { header: getReportLabel('amount', loc), key: 'amount', width: 12 },
      ];
      cards.columns = cols;
      report.idCardLines.forEach((line) => {
        cards.addRow({
          branch: line.branchName,
          person: line.personName,
          type: getPersonTypeLabel(line.personType, loc),
          card: line.cardNumber ?? '',
          date: line.eventDate,
          amount: line.amount,
        });
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async exportRevenueReportPdf(
    query: QueryRevenueReportDto,
    currentBranchId: string,
    tenantId: string | null,
    userId: string,
  ): Promise<Buffer> {
    const { data: report } = await this.getRevenueReport(
      query,
      currentBranchId,
      tenantId,
      userId,
    );

    const html = buildRevenueReportPdfHtml(report, query.locale);
    const { headerTemplate, footerTemplate } = await this.buildPdfHeaderFooter(
      currentBranchId,
      tenantId,
      report,
      query.locale,
    );

    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate,
        footerTemplate,
        margin: { top: '100px', bottom: '60px', left: '24px', right: '24px' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private async loadBranding(
    currentBranchId: string,
    tenantId: string | null,
    scope: 'current' | 'branch' | 'combined',
    branchIds: string[],
    branchNames: Map<string, string>,
    locale?: string,
  ): Promise<RevenueReportDto['branding']> {
    const loc = normalizeRevenueLocale(locale);
    const supabase = this.supabaseConfig.getClient();
    const headerBranchId =
      scope === 'branch' && branchIds.length === 1 ? branchIds[0] : currentBranchId;

    const { data: branch } = await supabase
      .from('branches')
      .select('id, name, tenant_id')
      .eq('id', headerBranchId)
      .maybeSingle();

    const branchRow = branch as { name?: string | null; tenant_id?: string | null } | null;
    const resolvedTenantId = tenantId ?? branchRow?.tenant_id ?? null;

    let schoolName = branchRow?.name?.trim() || 'School';
    let logoUrl: string | null = null;
    if (resolvedTenantId) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('name, logo_url')
        .eq('id', resolvedTenantId)
        .maybeSingle();
      const tenantRow = tenant as { name?: string | null; logo_url?: string | null } | null;
      if (tenantRow?.name?.trim()) schoolName = tenantRow.name.trim();
      logoUrl = tenantRow?.logo_url ?? null;
    }

    let branchSubtitle = '';
    if (scope === 'combined') {
      branchSubtitle = getScopeLabel('combined', loc);
    } else if (scope === 'branch' && branchIds.length === 1) {
      branchSubtitle = branchNames.get(branchIds[0]) ?? getScopeLabel('branch', loc);
    } else {
      branchSubtitle = branchNames.get(currentBranchId) ?? getScopeLabel('current', loc);
    }

    const logoDataUrl = resolvedTenantId
      ? await this.pdfLogoCache.getTenantLogoDataUrl(resolvedTenantId, logoUrl)
      : undefined;

    return {
      schoolName,
      branchSubtitle,
      logoDataUrl,
    };
  }

  private async buildPdfHeaderFooter(
    currentBranchId: string,
    tenantId: string | null,
    report: RevenueReportDto,
    locale?: string,
  ): Promise<{ headerTemplate: string; footerTemplate: string }> {
    const loc = normalizeRevenueLocale(locale);
    const ntgLogoDataUrl = await this.pdfLogoCache.getNtgLogoDataUrl();
    const headerLine = report.branding?.schoolName ?? 'School';
    const subLine = [
      report.branding?.branchSubtitle,
      `${getReportLabel('period', loc)}: ${report.startDate} – ${report.endDate}`,
    ]
      .filter(Boolean)
      .join(' · ');

    return {
      headerTemplate: buildPdfHeaderTemplate({
        ntgLogoDataUrl,
        branchName: headerLine,
        tenantLogoDataUrl: report.branding?.logoDataUrl,
        reportTitle: getReportLabel('title', loc),
        academicYearLabel: subLine,
      }),
      footerTemplate: buildPdfFooterTemplate(),
    };
  }

  private async loadBranchNames(branchIds: string[]): Promise<Map<string, string>> {
    if (branchIds.length === 0) return new Map();
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase.from('branches').select('id, name').in('id', branchIds);
    throwIfDbError(error);
    return new Map(
      ((data ?? []) as Array<{ id: string; name: string | null }>).map((b) => [
        b.id,
        b.name?.trim() || b.id,
      ]),
    );
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { BranchesService } from '../branches/branches.service';
import type { StorageBreakdownDto, StorageCategoryDto } from './dto/storage-breakdown.dto';
import type { FileSummaryDto } from './dto/file-summary.dto';
import type { StorageAlertDto } from './dto/storage-alert.dto';
import type { QueryStorageFilesDto } from './dto/query-storage-files.dto';
import type { QueryStorageAlertsDto } from './dto/query-storage-alerts.dto';

function throwIfDbError(error: { message: string } | null): void {
  if (error) {
    throw new BadRequestException(error.message);
  }
}

@Injectable()
export class StorageService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly branchesService: BranchesService,
  ) {}

  async getOverview(branchId: string): Promise<{
    quotaGb: number;
    usedBytes: number;
    usedPercentage: number;
  }> {
    return this.branchesService.getStorage(branchId);
  }

  async getBreakdown(branchId: string): Promise<StorageBreakdownDto> {
    const supabase = this.supabaseConfig.getClient();
    const { data: rows, error } = await supabase
      .from('storage_usage')
      .select('category, bytes_used, file_count')
      .eq('branch_id', branchId);

    throwIfDbError(error);
    const list = (rows ?? []) as { category: string; bytes_used: number; file_count: number }[];
    const categories: StorageCategoryDto[] = list.map((r) => ({
      category: r.category,
      bytesUsed: Number(r.bytes_used),
      fileCount: Number(r.file_count),
    }));
    const totalBytes = categories.reduce((s, c) => s + c.bytesUsed, 0);
    const totalFiles = categories.reduce((s, c) => s + c.fileCount, 0);
    return { categories, totalBytes, totalFiles };
  }

  async refreshBreakdown(branchId: string): Promise<StorageBreakdownDto> {
    const supabase = this.supabaseConfig.getClient();

    const [libraryRes, attachmentRes] = await Promise.all([
      supabase
        .from('library_items')
        .select('file_size_bytes, category, mime_type')
        .eq('branch_id', branchId),
      supabase
        .from('assessment_attachments')
        .select('file_size_bytes, assessment_id'),
    ]);
    throwIfDbError(libraryRes.error);
    throwIfDbError(attachmentRes.error);

    const assessmentIds = [...new Set((attachmentRes.data ?? []).map((a: { assessment_id: string }) => a.assessment_id))];
    let assessmentBranchIds: string[] = [];
    if (assessmentIds.length > 0) {
      const { data: assessments } = await supabase
        .from('assessments')
        .select('id')
        .eq('branch_id', branchId)
        .in('id', assessmentIds);
      assessmentBranchIds = (assessments ?? []).map((a: { id: string }) => a.id);
    }
    const attachmentRows = (attachmentRes.data ?? []).filter((a: { assessment_id: string }) =>
      assessmentBranchIds.includes(a.assessment_id),
    );

    const categoryMap = new Map<string, { bytes: number; count: number }>();
    const libItems = (libraryRes.data ?? []) as { file_size_bytes: number; category: string; mime_type: string }[];
    for (const r of libItems) {
      const bytes = Number(r.file_size_bytes) || 0;
      let cat = 'library';
      if (r.mime_type?.startsWith('image/')) cat = 'images';
      else if (r.mime_type === 'application/pdf' || r.mime_type?.includes('pdf')) cat = 'pdfs';
      const cur = categoryMap.get(cat) ?? { bytes: 0, count: 0 };
      categoryMap.set(cat, { bytes: cur.bytes + bytes, count: cur.count + 1 });
    }
    const attachmentBytes = (attachmentRows as { file_size_bytes: number }[]).reduce(
      (s, r) => s + (Number(r.file_size_bytes) || 0),
      0,
    );
    if (attachmentRows.length > 0 || attachmentBytes > 0) {
      const cur = categoryMap.get('attachments') ?? { bytes: 0, count: 0 };
      categoryMap.set('attachments', {
        bytes: cur.bytes + attachmentBytes,
        count: cur.count + attachmentRows.length,
      });
    }

    const categoriesToUpsert = ['library', 'images', 'pdfs', 'attachments', 'other'];
    for (const cat of categoriesToUpsert) {
      const cur = categoryMap.get(cat) ?? { bytes: 0, count: 0 };
      await supabase
        .from('storage_usage')
        .upsert(
          {
            branch_id: branchId,
            category: cat,
            bytes_used: cur.bytes,
            file_count: cur.count,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'branch_id,category' },
        );
    }

    return this.getBreakdown(branchId);
  }

  async getFiles(branchId: string, query: QueryStorageFilesDto): Promise<FileSummaryDto[]> {
    const supabase = this.supabaseConfig.getClient();
    const limit = query.limit ?? 50;

    const files: FileSummaryDto[] = [];

    if (!query.source || query.source === 'library') {
      const { data: libRows, error } = await supabase
        .from('library_items')
        .select('id, file_name, file_url, file_size_bytes, mime_type, created_at')
        .eq('branch_id', branchId)
        .order('file_size_bytes', { ascending: false })
        .limit(limit);
      throwIfDbError(error);
      for (const r of (libRows ?? []) as { id: string; file_name: string; file_url: string; file_size_bytes: number; mime_type: string | null; created_at: string }[]) {
        files.push({
          id: r.id,
          source: 'library',
          fileName: r.file_name,
          fileUrl: r.file_url,
          fileSizeBytes: Number(r.file_size_bytes) || 0,
          mimeType: r.mime_type,
          createdAt: r.created_at,
        });
      }
    }

    if (!query.source || query.source === 'assessment') {
      const { data: assessments } = await supabase
        .from('assessments')
        .select('id')
        .eq('branch_id', branchId);
      const assessmentIds = (assessments ?? []).map((a: { id: string }) => a.id);
      if (assessmentIds.length > 0) {
        const { data: attRows, error } = await supabase
          .from('assessment_attachments')
          .select('id, file_name, file_url, file_size_bytes, mime_type, created_at')
          .in('assessment_id', assessmentIds)
          .order('file_size_bytes', { ascending: false })
          .limit(limit);
        throwIfDbError(error);
        for (const r of (attRows ?? []) as { id: string; file_name: string; file_url: string | null; file_size_bytes: number | null; mime_type: string | null; created_at: string }[]) {
          files.push({
            id: r.id,
            source: 'assessment',
            fileName: r.file_name,
            fileUrl: r.file_url,
            fileSizeBytes: Number(r.file_size_bytes) || 0,
            mimeType: r.mime_type,
            createdAt: r.created_at,
          });
        }
      }
    }

    files.sort((a, b) => b.fileSizeBytes - a.fileSizeBytes);
    return files.slice(0, limit);
  }

  async deleteFile(
    branchId: string,
    source: 'library' | 'assessment' | 'uniform',
    fileId: string,
    userEmail: string,
  ): Promise<void> {
    const supabase = this.supabaseConfig.getClient();

    if (source === 'library') {
      const { data: row, error } = await supabase
        .from('library_items')
        .select('id, file_url, file_size_bytes')
        .eq('id', fileId)
        .eq('branch_id', branchId)
        .maybeSingle();
      throwIfDbError(error);
      if (!row) throw new NotFoundException('File not found');
      const fileUrl = (row as { file_url: string }).file_url;
      const fileSizeBytes = Number((row as { file_size_bytes: number }).file_size_bytes) || 0;
      this.removeFileFromStorage(supabase, fileUrl);
      await supabase.from('library_items').delete().eq('id', fileId).eq('branch_id', branchId);
      await this.decrementBranchStorage(branchId, fileSizeBytes);
      return;
    }

    if (source === 'assessment') {
      const { data: att, error: attError } = await supabase
        .from('assessment_attachments')
        .select('id, file_url, file_size_bytes, assessment_id')
        .eq('id', fileId)
        .maybeSingle();
      throwIfDbError(attError);
      if (!att) throw new NotFoundException('File not found');
      const { data: assessment, error: assError } = await supabase
        .from('assessments')
        .select('id')
        .eq('id', (att as { assessment_id: string }).assessment_id)
        .eq('branch_id', branchId)
        .maybeSingle();
      throwIfDbError(assError);
      if (!assessment) throw new NotFoundException('File not found');
      const fileUrl = (att as { file_url: string | null }).file_url;
      const fileSizeBytes = Number((att as { file_size_bytes: number | null }).file_size_bytes) || 0;
      if (fileUrl) this.removeFileFromStorage(supabase, fileUrl);
      await supabase.from('assessment_attachments').delete().eq('id', fileId);
      await this.decrementBranchStorage(branchId, fileSizeBytes);
      return;
    }

    if (source === 'uniform') {
      const { data: row, error } = await supabase
        .from('uniform_items')
        .select('id, image_url')
        .eq('id', fileId)
        .eq('branch_id', branchId)
        .maybeSingle();
      throwIfDbError(error);
      if (!row) throw new NotFoundException('File not found');
      const imageUrl = (row as { image_url: string | null }).image_url;
      if (imageUrl) this.removeFileFromStorage(supabase, imageUrl);
      await supabase
        .from('uniform_items')
        .update({ image_url: null })
        .eq('id', fileId)
        .eq('branch_id', branchId);
      return;
    }

    throw new NotFoundException('Unknown source');
  }

  private removeFileFromStorage(supabase: { storage: { from: (b: string) => { remove: (paths: string[]) => Promise<unknown> } } }, fileUrl: string): void {
    try {
      const urlParts = fileUrl.split('/');
      const bucketIndex = urlParts.findIndex((p) => p.includes('storage'));
      if (bucketIndex !== -1 && bucketIndex < urlParts.length - 1) {
        const bucketName = urlParts[bucketIndex + 1];
        const filePath = urlParts.slice(bucketIndex + 2).join('/');
        if (bucketName && filePath) {
          supabase.storage.from(bucketName).remove([filePath]).catch(() => {});
        }
      }
    } catch {
      // ignore
    }
  }

  private async decrementBranchStorage(branchId: string, bytes: number): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    const branch = await this.branchesService.getById(branchId);
    const newUsed = Math.max(0, branch.storageUsedBytes - bytes);
    await supabase.from('branches').update({ storage_used_bytes: newUsed }).eq('id', branchId);
  }

  async getAlerts(branchId: string, query?: QueryStorageAlertsDto): Promise<StorageAlertDto[]> {
    const supabase = this.supabaseConfig.getClient();
    let q = supabase
      .from('storage_alerts')
      .select('id, branch_id, alert_type, percentage_used, acknowledged, acknowledged_by, acknowledged_at, created_at')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });

    if (query?.filter === 'unacknowledged') {
      q = q.eq('acknowledged', false);
    } else if (
      query?.filter &&
      (query.filter === 'warning' || query.filter === 'critical' || query.filter === 'exceeded')
    ) {
      q = q.eq('alert_type', query.filter);
    }

    const { data: rows, error } = await q;
    throwIfDbError(error);
    return (rows ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      branchId: r.branch_id as string,
      alertType: r.alert_type as 'warning' | 'critical' | 'exceeded',
      percentageUsed: Number(r.percentage_used),
      acknowledged: Boolean(r.acknowledged),
      acknowledgedBy: (r.acknowledged_by as string | null) ?? null,
      acknowledgedAt: (r.acknowledged_at as string | null) ?? null,
      createdAt: r.created_at as string,
    }));
  }

  /**
   * Create storage alerts when usage crosses 80%, 95%, or 100%.
   * Call after any upload or storage update. Only creates if no unacknowledged alert of that type exists.
   */
  async ensureStorageAlerts(branchId: string): Promise<void> {
    const overview = await this.getOverview(branchId);
    const pct = Math.round(overview.usedPercentage);
    const supabase = this.supabaseConfig.getClient();

    const typesToCreate: { alert_type: 'warning' | 'critical' | 'exceeded'; minPct: number }[] = [];
    if (pct >= 100) typesToCreate.push({ alert_type: 'exceeded', minPct: 100 });
    if (pct >= 95) typesToCreate.push({ alert_type: 'critical', minPct: 95 });
    if (pct >= 80) typesToCreate.push({ alert_type: 'warning', minPct: 80 });

    for (const { alert_type, minPct } of typesToCreate) {
      const { data: existing } = await supabase
        .from('storage_alerts')
        .select('id')
        .eq('branch_id', branchId)
        .eq('alert_type', alert_type)
        .eq('acknowledged', false)
        .limit(1)
        .maybeSingle();
      if (existing) continue;
      await supabase.from('storage_alerts').insert({
        branch_id: branchId,
        alert_type,
        percentage_used: pct,
        acknowledged: false,
      });
    }
  }

  async acknowledgeAlert(branchId: string, alertId: string, userId: string): Promise<StorageAlertDto> {
    const supabase = this.supabaseConfig.getClient();
    const { data: row, error } = await supabase
      .from('storage_alerts')
      .update({
        acknowledged: true,
        acknowledged_by: userId,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', alertId)
      .eq('branch_id', branchId)
      .select('id, branch_id, alert_type, percentage_used, acknowledged, acknowledged_by, acknowledged_at, created_at')
      .single();
    throwIfDbError(error);
    if (!row) throw new NotFoundException('Alert not found');
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      branchId: r.branch_id as string,
      alertType: r.alert_type as 'warning' | 'critical' | 'exceeded',
      percentageUsed: Number(r.percentage_used),
      acknowledged: true,
      acknowledgedBy: r.acknowledged_by as string | null,
      acknowledgedAt: r.acknowledged_at as string | null,
      createdAt: r.created_at as string,
    };
  }
}

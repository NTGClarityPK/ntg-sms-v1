import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { ChallanService } from './challan.service';

type JobRow = {
  id: string;
  branch_id: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  payload: any;
};

@Injectable()
export class ChallanJobWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly workerId = `fees-challan-worker:${randomUUID()}`;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly concurrency = Number(process.env.FEE_CHALLAN_JOB_CONCURRENCY ?? '3') || 3;

  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly challanService: ChallanService,
  ) {}

  onModuleInit() {
    // Lightweight polling worker. Safe enough for single-instance deploys and local dev.
    // For multi-instance, SKIP LOCKED in the SQL function prevents duplicate claims.
    this.timer = setInterval(() => void this.tick(), 1500);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const supabase = this.supabaseConfig.getClient();
      const { data, error } = await supabase.rpc('claim_next_fee_challan_job', { worker_id: this.workerId });
      if (error || !data) return;
      const job = data as JobRow;
      await this.processJob(job);
    } finally {
      this.running = false;
    }
  }

  private async processJob(job: JobRow): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    const payload = (job.payload ?? {}) as {
      studentIds?: string[];
      months?: string[];
      dueDate?: string;
      autoCalculateDueDate?: boolean;
      selectedInheritedTemplateId?: string;
      studentOverrides?: any[];
    };

    try {
      const studentIds = (payload.studentIds ?? []).filter(Boolean);
      const months = (payload.months ?? []).filter(Boolean);
      const results: Array<{ studentId: string; challanId: string; challanNumber: string; pdfUrl: string | null }> = [];
      const errors: Array<{ studentId: string; message: string }> = [];

      let processed = 0;
      let lastProgressFlush = 0;
      let lastProgressFlushAt = 0;
      const maxConcurrency = Math.min(Math.max(this.concurrency, 1), 6, studentIds.length || 1);

      const flushProgressIfNeeded = async (force = false) => {
        const now = Date.now();
        const isSmallBatch = studentIds.length <= 25;
        const countThreshold = isSmallBatch ? 1 : 5;
        const timeThresholdMs = isSmallBatch ? 200 : 1000;

        if (!force) {
          const countOk = processed - lastProgressFlush >= countThreshold;
          const timeOk = now - lastProgressFlushAt >= timeThresholdMs;
          if (!countOk && !timeOk) return;
        }
        lastProgressFlush = processed;
        lastProgressFlushAt = now;
        await supabase
          .from('fee_challan_generation_jobs')
          .update({ processed_students: processed })
          .eq('id', job.id);
      };

      // Parallelise safely with bounded concurrency to reduce wall time.
      // NOTE: we still update processed count as each student completes.
      let cursor = 0;
      const worker = async () => {
        while (true) {
          const idx = cursor;
          cursor += 1;
          if (idx >= studentIds.length) return;
          const studentId = studentIds[idx]!;
          try {
            const r = await this.challanService.generate(
              {
                studentIds: [studentId],
                months,
                dueDate: payload.dueDate,
                autoCalculateDueDate: payload.autoCalculateDueDate,
                selectedInheritedTemplateId: payload.selectedInheritedTemplateId,
                studentOverrides: payload.studentOverrides,
              },
              job.branch_id,
            );
            for (const row of r.data ?? []) results.push(row);
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to generate challan';
            errors.push({ studentId, message: msg });
          } finally {
            processed += 1;
            await flushProgressIfNeeded(false);
          }
        }
      };

      await Promise.all(Array.from({ length: maxConcurrency }, () => worker()));

      await flushProgressIfNeeded(true);

      const result = {
        data: results,
        meta: errors.length > 0 ? { errors } : undefined,
      };

      await supabase
        .from('fee_challan_generation_jobs')
        .update({
          status: 'completed',
          processed_students: processed,
          error_message: null,
          result: result,
        })
        .eq('id', job.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to generate challans';
      await supabase
        .from('fee_challan_generation_jobs')
        .update({
          status: 'failed',
          error_message: msg,
        })
        .eq('id', job.id);
    }
  }
}


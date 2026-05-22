import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { IdCardsService } from './id-cards.service';
import type { GenerateIdCardsDto } from './dto/generate-id-cards.dto';

type JobRow = {
  id: string;
  branch_id: string;
  created_by: string | null;
  status: string;
  payload: GenerateIdCardsDto & { personIds?: string[] };
};

@Injectable()
export class IdCardJobWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly workerId = `id-card-worker:${randomUUID()}`;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly idCardsService: IdCardsService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), 1500);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const supabase = this.supabaseConfig.getClient();
      const { data, error } = await supabase.rpc('claim_next_id_card_generation_job', {
        worker_id: this.workerId,
      });
      if (error || !data) return;
      const job = data as JobRow;
      try {
        await this.idCardsService.processGenerationJobPayload(
          job.id,
          job.branch_id,
          job.created_by ?? '',
          job.payload ?? {},
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Job failed';
        await supabase
          .from('id_card_generation_jobs')
          .update({ status: 'failed', error_message: message, updated_at: new Date().toISOString() })
          .eq('id', job.id);
      }
    } finally {
      this.running = false;
    }
  }
}

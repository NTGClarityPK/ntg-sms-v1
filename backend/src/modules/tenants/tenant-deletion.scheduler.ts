import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TenantsService } from './tenants.service';

@Injectable()
export class TenantDeletionScheduler {
  private readonly logger = new Logger(TenantDeletionScheduler.name);

  constructor(private readonly tenantsService: TenantsService) {}

  // Run frequently so the 2-minute window feels accurate.
  @Cron('*/30 * * * * *')
  async run(): Promise<void> {
    try {
      await this.tenantsService.runDueTenantDeletions();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      this.logger.error(`Tenant deletion scheduler failed: ${message}`);
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { isCronJobEnabled } from '../../common/config/cron-job-enabled.util';
import { CRON_JOB_ENV_KEYS } from '../../common/config/cron-job-env-keys';
import { TenantsService } from './tenants.service';

@Injectable()
export class TenantDeletionScheduler {
  private readonly logger = new Logger(TenantDeletionScheduler.name);
  private readonly enabled: boolean;

  constructor(
    private readonly tenantsService: TenantsService,
    private readonly configService: ConfigService,
  ) {
    // Disabled by default — set TENANT_DELETION_JOB_ENABLED=true only when needed.
    this.enabled = isCronJobEnabled(this.configService, CRON_JOB_ENV_KEYS.tenantDeletion, 'off');
  }

  // Run frequently so the 2-minute window feels accurate.
  @Cron('*/30 * * * * *')
  async run(): Promise<void> {
    if (!this.enabled) return;
    try {
      await this.tenantsService.runDueTenantDeletions();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      this.logger.error(`Tenant deletion scheduler failed: ${message}`);
    }
  }
}

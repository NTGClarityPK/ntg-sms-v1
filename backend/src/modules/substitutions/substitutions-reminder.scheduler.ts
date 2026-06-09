import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { isCronJobEnabled } from '../../common/config/cron-job-enabled.util';
import { CRON_JOB_ENV_KEYS } from '../../common/config/cron-job-env-keys';
import { SubstitutionsService } from './substitutions.service';

@Injectable()
export class SubstitutionsReminderScheduler {
  private readonly logger = new Logger(SubstitutionsReminderScheduler.name);
  private readonly enabled: boolean;

  constructor(
    private readonly substitutionsService: SubstitutionsService,
    private readonly configService: ConfigService,
  ) {
    this.enabled = isCronJobEnabled(
      this.configService,
      CRON_JOB_ENV_KEYS.substitutionReminders,
      'production',
    );
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async sendSubstitutionReminders(): Promise<void> {
    if (!this.enabled) return;
    try {
      await this.substitutionsService.processReminderNotifications();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.warn(`sendSubstitutionReminders failed: ${message}`);
    }
  }
}

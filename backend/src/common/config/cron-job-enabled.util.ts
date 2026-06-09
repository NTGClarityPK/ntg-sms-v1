import { ConfigService } from '@nestjs/config';

/** When env is unset: `off` = disabled; `production` = enabled only when NODE_ENV is production. */
export type CronJobDefaultWhenUnset = 'off' | 'production';

export function isCronJobEnabled(
  configService: ConfigService,
  envKey: string,
  defaultWhenUnset: CronJobDefaultWhenUnset = 'off',
): boolean {
  const raw = configService.get<string>(envKey)?.trim().toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (defaultWhenUnset === 'production') {
    return configService.get<string>('NODE_ENV') === 'production';
  }
  return false;
}

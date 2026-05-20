import { ForbiddenException } from '@nestjs/common';

export class SubscriptionFeatureForbiddenException extends ForbiddenException {
  constructor(feature: string) {
    super({
      code: 'SUBSCRIPTION_FEATURE',
      message: `This feature requires a higher plan: ${feature}`,
      feature,
    });
  }
}

export class SubscriptionLimitForbiddenException extends ForbiddenException {
  constructor(metric: string, limit: number, used: number) {
    super({
      code: 'SUBSCRIPTION_LIMIT',
      message: `Plan limit reached for ${metric}`,
      metric,
      limit,
      used,
    });
  }
}

export class DowngradeNotAllowedException extends ForbiddenException {
  constructor(reasons: string[]) {
    super({
      code: 'DOWNGRADE_NOT_ALLOWED',
      message: 'Cannot downgrade — current usage exceeds target plan limits',
      reasons,
    });
  }
}

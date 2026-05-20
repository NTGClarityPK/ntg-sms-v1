import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { CurrentBranchContext } from '../../../common/decorators/current-branch.decorator';
import type { CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import type { PlanFeatures } from '../plan-config';
import { parsePlanId, planHasFeature } from '../plan-config';
import { SubscriptionService } from '../subscription.service';
import { SubscriptionFeatureForbiddenException } from '../subscription.errors';

export const REQUIRES_FEATURE_KEY = 'subscription_feature';

export const RequiresFeature = (feature: keyof PlanFeatures) =>
  SetMetadata(REQUIRES_FEATURE_KEY, feature);

@Injectable()
export class FeatureAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.getAllAndOverride<keyof PlanFeatures | undefined>(
      REQUIRES_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredFeature) return true;

    const request = context.switchToHttp().getRequest<{
      user?: CurrentUserPayload;
      branch?: CurrentBranchContext;
    }>();
    const user = request.user;
    if (user?.roles?.some((r) => r.toLowerCase() === 'super_admin')) {
      return true;
    }
    const tenantId = request.branch?.tenantId;
    if (!tenantId) return false;

    const subscription = await this.subscriptionService.getByTenantId(tenantId);
    const planId = parsePlanId(subscription.planId);
    if (!planId || !planHasFeature(planId, requiredFeature)) {
      throw new SubscriptionFeatureForbiddenException(requiredFeature);
    }
    return true;
  }
}

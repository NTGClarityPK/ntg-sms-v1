import {
  BadRequestException,
  Controller,
  Headers,
  Post,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import Stripe from 'stripe';
import type { StripeClient, StripeEvent } from './stripe-types';
import { SubscriptionStripeService } from './subscription-stripe.service';
import { getStripeSecretKey, isStripeConfigured } from './stripe-config';

@ApiTags('Subscription webhooks')
@Controller('api/v1/subscription/webhooks')
export class SubscriptionWebhookController {
  private stripe: StripeClient | null = null;

  constructor(private readonly subscriptionStripeService: SubscriptionStripeService) {}

  private getStripe(): StripeClient {
    if (!this.stripe) {
      this.stripe = new Stripe(getStripeSecretKey());
    }
    return this.stripe;
  }

  @Post('stripe')
  async handleStripeWebhook(
    @Headers('stripe-signature') signature: string | undefined,
    @Req() request: RawBodyRequest<Request>,
  ) {
    if (!isStripeConfigured()) {
      throw new ServiceUnavailableException('Stripe is not configured');
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    if (!webhookSecret) {
      throw new ServiceUnavailableException('Stripe webhook secret is not configured');
    }

    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    const rawBody = request.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing raw request body for webhook verification');
    }

    let event: StripeEvent;
    try {
      event = this.getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid signature';
      throw new BadRequestException(`Webhook Error: ${message}`);
    }

    await this.subscriptionStripeService.handleStripeWebhookEvent(event);

    return { received: true };
  }
}

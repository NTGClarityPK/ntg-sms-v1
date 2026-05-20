import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { SubscriptionService } from './subscription.service';
import { SubscriptionInvoiceService } from './subscription-invoice.service';
import { SubscriptionInvoicePdfService } from './subscription-invoice-pdf.service';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionAdminController } from './subscription-admin.controller';
import { SubscriptionWebhookController } from './subscription-webhook.controller';
import { SubscriptionStripeService } from './subscription-stripe.service';
import { SchoolAdminGuard } from './guards/school-admin.guard';
import { FeatureAccessGuard } from './guards/feature-access.guard';

@Module({
  controllers: [
    SubscriptionController,
    SubscriptionAdminController,
    SubscriptionWebhookController,
  ],
  providers: [
    SubscriptionService,
    SubscriptionInvoiceService,
    SubscriptionInvoicePdfService,
    SubscriptionStripeService,
    SupabaseConfig,
    SchoolAdminGuard,
    FeatureAccessGuard,
  ],
  exports: [SubscriptionService, FeatureAccessGuard],
})
export class SubscriptionModule {}

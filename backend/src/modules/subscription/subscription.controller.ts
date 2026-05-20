import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch, type CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { SubscriptionService } from './subscription.service';
import { SubscriptionInvoiceService } from './subscription-invoice.service';
import { SubscriptionStripeService } from './subscription-stripe.service';
import { ChangePlanDto } from './dto/change-plan.dto';
import { ConfirmCheckoutDto } from './dto/confirm-checkout.dto';
import { SchoolAdminGuard } from './guards/school-admin.guard';
import { isStripeConfigured } from './stripe-config';

@ApiTags('Subscription')
@Controller('api/v1/subscription')
@UseGuards(JwtAuthGuard, BranchGuard)
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly subscriptionInvoiceService: SubscriptionInvoiceService,
    private readonly subscriptionStripeService: SubscriptionStripeService,
  ) {}

  private requireTenantId(branch: CurrentBranchContext): string {
    if (!branch.tenantId) {
      throw new BadRequestException('Tenant context is required');
    }
    return branch.tenantId;
  }

  @Get('plans')
  getPlans() {
    return this.subscriptionService.getPlans();
  }

  @Get('current-plan')
  async getCurrentPlanId(@CurrentBranch() branch: CurrentBranchContext) {
    const subscription = await this.subscriptionService.getByTenantId(
      this.requireTenantId(branch),
    );
    return { data: { planId: subscription.planId } };
  }

  @Get()
  @UseGuards(SchoolAdminGuard)
  async getSubscription(@CurrentBranch() branch: CurrentBranchContext) {
    const data = await this.subscriptionService.getByTenantId(this.requireTenantId(branch));
    return { data };
  }

  @Get('invoices')
  @UseGuards(SchoolAdminGuard)
  listInvoices(
    @CurrentBranch() branch: CurrentBranchContext,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? Number.parseInt(page, 10) : 1;
    const limitNum = limit ? Number.parseInt(limit, 10) : 20;
    return this.subscriptionInvoiceService.listForTenant(
      this.requireTenantId(branch),
      Number.isFinite(pageNum) ? pageNum : 1,
      Number.isFinite(limitNum) ? limitNum : 20,
    );
  }

  @Get('payment-config')
  @UseGuards(SchoolAdminGuard)
  getPaymentConfig() {
    return { data: { stripeEnabled: isStripeConfigured() } };
  }

  @Get('customer-portal')
  @UseGuards(SchoolAdminGuard)
  getCustomerPortal(@CurrentBranch() branch: CurrentBranchContext) {
    return this.subscriptionStripeService.createCustomerPortalSession(
      this.requireTenantId(branch),
    );
  }

  @Post('checkout/confirm')
  @UseGuards(SchoolAdminGuard)
  confirmCheckout(
    @CurrentBranch() branch: CurrentBranchContext,
    @Body() dto: ConfirmCheckoutDto,
  ) {
    return this.subscriptionStripeService.confirmCheckoutSession(
      this.requireTenantId(branch),
      dto.sessionId,
    );
  }

  @Post('invoices/:invoiceId/checkout')
  @UseGuards(SchoolAdminGuard)
  createInvoiceCheckout(
    @CurrentBranch() branch: CurrentBranchContext,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.subscriptionStripeService.createCheckoutForInvoice(
      this.requireTenantId(branch),
      invoiceId,
    );
  }

  @Get('invoices/:invoiceId/download')
  @UseGuards(SchoolAdminGuard)
  getInvoiceDownload(
    @CurrentBranch() branch: CurrentBranchContext,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.subscriptionInvoiceService.getDownloadUrl(
      this.requireTenantId(branch),
      invoiceId,
    );
  }

  @Get('usage')
  @UseGuards(SchoolAdminGuard)
  async getUsage(
    @CurrentBranch() branch: CurrentBranchContext,
    @Query('refresh') refresh?: string,
  ) {
    const data = await this.subscriptionService.getUsageWithLimits(
      this.requireTenantId(branch),
      refresh === 'true',
    );
    return { data };
  }

  @Post('change-plan')
  @UseGuards(SchoolAdminGuard)
  changePlan(
    @CurrentBranch() branch: CurrentBranchContext,
    @Body() dto: ChangePlanDto,
  ) {
    return this.subscriptionService.changePlan(this.requireTenantId(branch), dto);
  }

  @Delete('pending-change')
  @UseGuards(SchoolAdminGuard)
  async clearPendingChange(@CurrentBranch() branch: CurrentBranchContext) {
    await this.subscriptionService.clearPendingChange(this.requireTenantId(branch));
    return { data: { message: 'Pending change cleared' } };
  }
}

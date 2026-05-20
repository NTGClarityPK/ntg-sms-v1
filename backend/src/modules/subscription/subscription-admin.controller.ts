import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { SubscriptionService } from './subscription.service';
import { SubscriptionInvoiceService } from './subscription-invoice.service';
import { AdminUpdateSubscriptionDto } from './dto/subscription.dto';
import { AdminUpdateInvoiceDto } from './dto/subscription-invoice.dto';

@ApiTags('Subscription admin')
@Controller('api/v1/admin/subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionAdminController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly subscriptionInvoiceService: SubscriptionInvoiceService,
  ) {}

  private assertSuperAdmin(user: CurrentUserPayload): void {
    const isSuperAdmin = user.roles?.some((r) => r.toLowerCase() === 'super_admin');
    if (!isSuperAdmin) {
      throw new ForbiddenException('Super admin access required');
    }
  }

  @Get()
  listAll(@CurrentUser() user: CurrentUserPayload) {
    this.assertSuperAdmin(user);
    return this.subscriptionService.listAllForAdmin();
  }

  @Patch('invoices/:invoiceId')
  updateInvoice(
    @CurrentUser() user: CurrentUserPayload,
    @Param('invoiceId') invoiceId: string,
    @Body() body: AdminUpdateInvoiceDto,
  ) {
    this.assertSuperAdmin(user);
    return this.subscriptionInvoiceService.adminUpdateInvoice(invoiceId, body);
  }

  @Patch(':tenantId')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('tenantId') tenantId: string,
    @Body() body: AdminUpdateSubscriptionDto,
  ) {
    this.assertSuperAdmin(user);
    return this.subscriptionService.adminUpdateSubscription(tenantId, body);
  }

  @Post(':tenantId/sync-usage')
  async syncUsage(
    @CurrentUser() user: CurrentUserPayload,
    @Param('tenantId') tenantId: string,
  ) {
    this.assertSuperAdmin(user);
    const usage = await this.subscriptionService.syncUsage(tenantId);
    return { data: usage };
  }

  @Post(':tenantId/invoices')
  generateInvoice(
    @CurrentUser() user: CurrentUserPayload,
    @Param('tenantId') tenantId: string,
  ) {
    this.assertSuperAdmin(user);
    return this.subscriptionInvoiceService.adminGenerateForTenant(tenantId);
  }
}

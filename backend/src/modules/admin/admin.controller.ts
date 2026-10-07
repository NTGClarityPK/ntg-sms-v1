import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminApiKeyGuard } from './guards/admin-api-key.guard';
import { AdminSubscriptionService } from './admin-subscription.service';
import { AdminAssessmentsLockService } from './admin-assessments-lock.service';
import { AdminTenantDeleteService } from './admin-tenant-delete.service';
import { AdminLogsService } from './admin-logs.service';
import {
  AssessmentsLockDto,
  DeleteTenantConfirmDto,
  PutEnterpriseOfferDto,
} from './dto/enterprise-offer.dto';

@ApiTags('Admin Ops')
@Controller('api/v1/admin')
@UseGuards(AdminApiKeyGuard)
export class AdminController {
  constructor(
    private readonly adminSubscriptionService: AdminSubscriptionService,
    private readonly assessmentsLockService: AdminAssessmentsLockService,
    private readonly tenantDeleteService: AdminTenantDeleteService,
    private readonly logsService: AdminLogsService,
  ) {}

  @Get('tenants')
  listTenants(@Query('q') q?: string) {
    return this.adminSubscriptionService.listTenants(q);
  }

  @Get('tenants/:tenantId/subscription')
  getSubscription(@Param('tenantId') tenantId: string) {
    return this.adminSubscriptionService.getSubscription(tenantId);
  }

  @Put('tenants/:tenantId/subscription/enterprise')
  putEnterprise(
    @Param('tenantId') tenantId: string,
    @Body() dto: PutEnterpriseOfferDto,
  ) {
    return this.adminSubscriptionService.putEnterpriseOffer(tenantId, dto);
  }

  @Delete('tenants/:tenantId/subscription/enterprise')
  deleteEnterprise(
    @Param('tenantId') tenantId: string,
    @Query('force') force?: string,
    @Body() body?: { force?: boolean },
  ) {
    const forceFlag = force === 'true' || body?.force === true;
    return this.adminSubscriptionService.deleteEnterpriseOffer(
      tenantId,
      forceFlag,
    );
  }

  @Get('tenants/:tenantId/assessments-lock')
  getAssessmentsLock(@Param('tenantId') tenantId: string) {
    return this.assessmentsLockService.getLock(tenantId);
  }

  @Put('tenants/:tenantId/assessments-lock')
  putAssessmentsLock(
    @Param('tenantId') tenantId: string,
    @Body() dto: AssessmentsLockDto,
  ) {
    return this.assessmentsLockService.setLock(tenantId, dto);
  }

  @Delete('tenants/:tenantId')
  deleteTenant(
    @Param('tenantId') tenantId: string,
    @Body() dto: DeleteTenantConfirmDto,
  ) {
    return this.tenantDeleteService.deleteTenant(
      tenantId,
      dto.confirmTenantId,
      dto.confirm,
    );
  }

  @Get('logs')
  listLogs(
    @Query('tenantId') tenantId?: string,
    @Query('method') method?: string,
    @Query('statusCode') statusCode?: string,
    @Query('actionType') actionType?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.logsService.listHits({
      tenantId,
      method,
      statusCode: statusCode ? Number.parseInt(statusCode, 10) : undefined,
      actionType,
      cursor,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
    });
  }
}

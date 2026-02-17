import { Controller, Get, Query, Param, UseGuards, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { AuditLogsService } from './audit-logs.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

@Controller('api/v1/audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  async list(
    @Query() query: QueryAuditLogsDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{
    data: Array<{
      id: string;
      tableName: string;
      recordId: string;
      action: 'CREATE' | 'UPDATE' | 'DELETE';
      userEmail: string;
      username: string;
      branchId: string | null;
      tenantId: string | null;
      oldValues: Record<string, unknown> | null;
      newValues: Record<string, unknown> | null;
      changedFields: string[] | null;
      ipAddress: string | null;
      userAgent: string | null;
      createdAt: string;
    }>;
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    // Only super admins can view audit logs
    const isSuperAdmin = user.roles?.includes('super_admin');
    if (!isSuperAdmin) {
      throw new ForbiddenException('Only super admins can view audit logs');
    }

    return this.auditLogsService.listAuditLogs(query);
  }

  @Get(':id')
  async getById(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{
    data: {
      id: string;
      tableName: string;
      recordId: string;
      action: 'CREATE' | 'UPDATE' | 'DELETE';
      userEmail: string;
      username: string;
      branchId: string | null;
      tenantId: string | null;
      oldValues: Record<string, unknown> | null;
      newValues: Record<string, unknown> | null;
      changedFields: string[] | null;
      ipAddress: string | null;
      userAgent: string | null;
      createdAt: string;
    };
  }> {
    // Only super admins can view audit logs
    const isSuperAdmin = user.roles?.includes('super_admin');
    if (!isSuperAdmin) {
      throw new ForbiddenException('Only super admins can view audit logs');
    }

    const data = await this.auditLogsService.getAuditLogById(id);
    return { data };
  }

  @Get('record/:tableName/:recordId')
  async getByRecord(
    @Param('tableName') tableName: string,
    @Param('recordId') recordId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{
    data: Array<{
      id: string;
      tableName: string;
      recordId: string;
      action: 'CREATE' | 'UPDATE' | 'DELETE';
      userEmail: string;
      username: string;
      branchId: string | null;
      tenantId: string | null;
      oldValues: Record<string, unknown> | null;
      newValues: Record<string, unknown> | null;
      changedFields: string[] | null;
      ipAddress: string | null;
      userAgent: string | null;
      createdAt: string;
    }>;
  }> {
    // Only super admins can view audit logs
    const isSuperAdmin = user.roles?.includes('super_admin');
    if (!isSuperAdmin) {
      throw new ForbiddenException('Only super admins can view audit logs');
    }

    const data = await this.auditLogsService.getAuditLogsForRecord(tableName, recordId);
    return { data };
  }
}

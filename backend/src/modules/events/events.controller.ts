import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import {
  CurrentBranch,
  type CurrentBranchContext,
} from '../../common/decorators/current-branch.decorator';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { EventsService } from './events.service';
import { EventDto } from './dto/event.dto';
import { EventConsentDto } from './dto/event-consent.dto';
import { QueryEventsDto } from './dto/query-events.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { SubmitConsentDto } from './dto/submit-consent.dto';
import { SupabaseConfig } from '../../common/config/supabase.config';

@ApiTags('Events')
@UseGuards(JwtAuthGuard, BranchGuard)
@Controller('api/v1/events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly supabaseConfig: SupabaseConfig,
  ) {}

  private async ensureFeatureEditAccess(
    user: CurrentUserPayload,
    branchId: string,
    featureCode: string,
  ): Promise<void> {
    const roleNames = user.roles || [];
    if (roleNames.includes('school_admin')) return;
    if (roleNames.length === 0) throw new ForbiddenException('No role assigned for this user');

    const supabase = this.supabaseConfig.getClient();
    const { data: rolesData, error: rolesError } = await supabase
      .from('roles')
      .select('id')
      .in('name', roleNames);
    if (rolesError) throw new ForbiddenException('Unable to verify role permissions');

    const roleIds = (rolesData || []).map((r: { id: string }) => r.id);
    if (roleIds.length === 0) throw new ForbiddenException('No valid role found for this user');

    const candidateFeatureCodes =
      featureCode === 'events_management' ? ['events_management', 'events'] : [featureCode];

    const { data: featureRows, error: featureError } = await supabase
      .from('features')
      .select('id')
      .in('code', candidateFeatureCodes);
    if (featureError || !featureRows || featureRows.length === 0) {
      throw new ForbiddenException(`${featureCode} permission feature not configured`);
    }

    const featureIds = featureRows.map((f: { id: string }) => f.id);
    const { data: permissionRows, error: permissionError } = await supabase
      .from('role_permissions')
      .select('permission')
      .eq('branch_id', branchId)
      .in('feature_id', featureIds)
      .in('role_id', roleIds);
    if (permissionError) {
      throw new ForbiddenException(`Unable to verify ${featureCode} edit permissions`);
    }

    const canEdit = (permissionRows || []).some(
      (row: { permission: string }) => row.permission === 'edit',
    );
    if (!canEdit) throw new ForbiddenException(`You do not have edit access to ${featureCode}`);
  }

  // CRITICAL: Specific routes must come before parameterized routes
  @Get('my-events')
  async getMyEvents(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: EventDto[] }> {
    const userRoles = user.roles || [];
    return this.eventsService.getMyEvents(user.id, branch.branchId, userRoles);
  }

  @Get('conflicts')
  async checkConflicts(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('classSectionIds') classSectionIds: string | string[],
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{
    assessmentConflicts: Array<{
      id: string;
      title: string;
      dueDate: string;
      classSectionId: string;
      className?: string;
      sectionName?: string;
      classTeacherName?: string;
      subjectName?: string;
    }>;
    eventConflicts: Array<{ id: string; title: string; startDate: string; endDate: string }>;
  }> {
    if (!startDate || !endDate) {
      return { assessmentConflicts: [], eventConflicts: [] };
    }

    const classSectionIdsArray = Array.isArray(classSectionIds)
      ? classSectionIds
      : classSectionIds
        ? [classSectionIds]
        : [];

    return this.eventsService.checkConflicts(
      startDate,
      endDate,
      classSectionIdsArray,
      branch.branchId,
    );
  }

  @Get('upcoming-conflict-count')
  async getUpcomingEventsConflictCount(
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: { totalUpcoming: number; eventsWithConflicts: number } }> {
    const result = await this.eventsService.getUpcomingEventsConflictCount(branch.branchId);
    return { data: result };
  }

  @Get()
  async listEvents(
    @Query() query: QueryEventsDto,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{
    data: EventDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.eventsService.listEvents(query, branch.branchId);
  }

  @Post()
  async createEvent(
    @Body() body: CreateEventDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: EventDto }> {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'events_management');
    const created = await this.eventsService.createEvent(
      body,
      branch.branchId,
      user.id,
      user.email,
    );
    return { data: created };
  }

  // CRITICAL: Specific routes before :id routes
  @Get(':id/consents')
  async getEventConsents(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: EventConsentDto[] }> {
    return this.eventsService.getEventConsents(id, branch.branchId);
  }

  @Get(':id/conflicts')
  async getEventConflicts(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{
    assessmentConflicts: Array<{
      id: string;
      title: string;
      dueDate: string;
      classSectionId: string;
      className?: string;
      sectionName?: string;
      classTeacherName?: string;
      subjectName?: string;
    }>;
    eventConflicts: Array<{ id: string; title: string; startDate: string; endDate: string }>;
  }> {
    return this.eventsService.getConflicts(id, branch.branchId);
  }

  @Get(':id')
  async getEvent(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @Query('language') language?: 'en' | 'en-US' | 'en-GB' | 'ar',
  ): Promise<{ data: EventDto }> {
    const event = await this.eventsService.getEvent(id, branch.branchId, language ?? 'en-GB');
    return { data: event };
  }

  @Put(':id')
  async updateEvent(
    @Param('id') id: string,
    @Body() body: UpdateEventDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: EventDto }> {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'events_management');
    const updated = await this.eventsService.updateEvent(
      id,
      body,
      branch.branchId,
      user.email,
    );
    return { data: updated };
  }

  @Delete(':id')
  async deleteEvent(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: { id: string } }> {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'events_management');
    const result = await this.eventsService.deleteEvent(id, branch.branchId, user.email);
    return { data: result };
  }

  @Post(':id/consent')
  async submitConsent(
    @Param('id') eventId: string,
    @Body() body: SubmitConsentDto & { studentId: string },
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ): Promise<{ data: EventConsentDto }> {
    // Get IP address from request
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      undefined;

    const consent = await this.eventsService.submitConsent(
      eventId,
      body.studentId,
      body.status,
      body.notes,
      ipAddress,
      user.id,
      branch.branchId,
    );
    return { data: consent };
  }
}


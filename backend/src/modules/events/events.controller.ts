import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
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

@UseGuards(JwtAuthGuard, BranchGuard)
@Controller('api/v1/events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

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
    assessmentConflicts: Array<{ id: string; title: string; dueDate: string; classSectionId: string }>;
    eventConflicts: Array<{ id: string; title: string; startDate: string; endDate: string }>;
  }> {
    const classSectionIdsArray = Array.isArray(classSectionIds)
      ? classSectionIds
      : classSectionIds
        ? [classSectionIds]
        : [];
    // This is a simplified check - full implementation would be in service
    return { assessmentConflicts: [], eventConflicts: [] };
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
    const created = await this.eventsService.createEvent(
      body,
      branch.branchId,
      user.id,
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
    assessmentConflicts: Array<{ id: string; title: string; dueDate: string; classSectionId: string }>;
    eventConflicts: Array<{ id: string; title: string; startDate: string; endDate: string }>;
  }> {
    return this.eventsService.getConflicts(id, branch.branchId);
  }

  @Get(':id')
  async getEvent(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: EventDto }> {
    const event = await this.eventsService.getEvent(id, branch.branchId);
    return { data: event };
  }

  @Put(':id')
  async updateEvent(
    @Param('id') id: string,
    @Body() body: UpdateEventDto,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: EventDto }> {
    const updated = await this.eventsService.updateEvent(
      id,
      body,
      branch.branchId,
    );
    return { data: updated };
  }

  @Delete(':id')
  async deleteEvent(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: { id: string } }> {
    const result = await this.eventsService.deleteEvent(id, branch.branchId);
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


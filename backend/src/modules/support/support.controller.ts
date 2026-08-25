import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseFilePipeBuilder,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
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
import { CreateSupportConversationDto } from './dto/create-support-conversation.dto';
import { NoteAgentActivityDto } from './dto/note-agent-activity.dto';
import { QueryMinutesSummaryDto } from './dto/query-minutes-summary.dto';
import { QuerySupportConversationsDto } from './dto/query-support-conversations.dto';
import { QuerySupportMessagesDto } from './dto/query-support-messages.dto';
import { RealtimeTokenDto } from './dto/realtime-token.dto';
import { SendSupportMessageDto } from './dto/send-support-message.dto';
import { UploadSupportFileDto } from './dto/upload-support-file.dto';
import { SupportService } from './support.service';
import { REACH_UPLOAD_ABSOLUTE_MAX_BYTES } from './support.types';

type UploadedSupportFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

@ApiTags('Support')
@UseGuards(JwtAuthGuard, BranchGuard)
@Controller('api/v1/support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('coverage')
  async getCoverage() {
    return this.supportService.getCoverage();
  }

  @Get('unread-summary')
  async getUnreadSummary(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    const ctx = await this.supportService.getPortalContext(branch, user.id);
    return this.supportService.getUnreadSummary(ctx);
  }

  @Get('minutes-summary')
  async getMinutesSummary(
    @Query() query: QueryMinutesSummaryDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    const ctx = await this.supportService.getPortalContext(branch, user.id);
    return this.supportService.getMinutesSummary(ctx, query);
  }

  @Post('realtime-token')
  async getRealtimeToken(
    @Body() dto: RealtimeTokenDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    const ctx = await this.supportService.getPortalContext(branch, user.id);
    return this.supportService.getRealtimeToken(ctx, dto.conversationId);
  }

  @Get('conversations')
  async listConversations(
    @Query() query: QuerySupportConversationsDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    const ctx = await this.supportService.getPortalContext(branch, user.id);
    return this.supportService.listConversations(ctx, query);
  }

  @Post('conversations')
  async createConversation(
    @Body() dto: CreateSupportConversationDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    const ctx = await this.supportService.getPortalContext(branch, user.id);
    return this.supportService.createConversation(ctx, dto);
  }

  @Post('conversations/:conversationId/mark-read')
  async markConversationRead(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    const ctx = await this.supportService.getPortalContext(branch, user.id);
    return this.supportService.markConversationRead(ctx, conversationId);
  }

  @Post('conversations/:conversationId/note-agent-activity')
  async noteAgentActivity(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: NoteAgentActivityDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    const ctx = await this.supportService.getPortalContext(branch, user.id);
    return this.supportService.noteAgentActivity(ctx, conversationId, dto.at);
  }

  @Get('conversations/:conversationId/messages')
  async listMessages(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Query() query: QuerySupportMessagesDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    const ctx = await this.supportService.getPortalContext(branch, user.id);
    return this.supportService.listMessages(ctx, conversationId, query);
  }

  @Post('messages')
  async sendMessage(
    @Body() dto: SendSupportMessageDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    const ctx = await this.supportService.getPortalContext(branch, user.id);
    return this.supportService.sendMessage(ctx, dto);
  }

  @Post('uploads')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: REACH_UPLOAD_ABSOLUTE_MAX_BYTES } }),
  )
  async upload(
    @Body() dto: UploadSupportFileDto,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: REACH_UPLOAD_ABSOLUTE_MAX_BYTES })
        .build({
          errorHttpStatusCode: HttpStatus.PAYLOAD_TOO_LARGE,
          fileIsRequired: true,
        }),
    )
    file: UploadedSupportFile,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    const ctx = await this.supportService.getPortalContext(branch, user.id);
    return this.supportService.upload(ctx, dto.messageType, dto.conversationId, file);
  }

  @Delete('messages/:messageId')
  async deleteMessage(
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    const ctx = await this.supportService.getPortalContext(branch, user.id);
    return this.supportService.deleteMessage(ctx, messageId);
  }
}

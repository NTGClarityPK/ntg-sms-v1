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
import { StudentJwtGuard } from '../../common/guards/student-jwt.guard';
import {
  CurrentStudent,
  type CurrentStudentPayload,
} from '../../common/decorators/current-student.decorator';
import { CreateSupportConversationDto } from './dto/create-support-conversation.dto';
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

@ApiTags('Student self-service')
@UseGuards(StudentJwtGuard)
@Controller('api/v1/student/support')
export class StudentSupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('coverage')
  async getCoverage() {
    return this.supportService.getCoverage();
  }

  @Get('minutes-summary')
  async getMinutesSummary(
    @Query() query: QueryMinutesSummaryDto,
    @CurrentStudent() student: CurrentStudentPayload,
  ) {
    const ctx = await this.supportService.getStudentContext(student);
    return this.supportService.getMinutesSummary(ctx, query);
  }

  @Post('realtime-token')
  async getRealtimeToken(
    @Body() dto: RealtimeTokenDto,
    @CurrentStudent() student: CurrentStudentPayload,
  ) {
    const ctx = await this.supportService.getStudentContext(student);
    return this.supportService.getRealtimeToken(ctx, dto.conversationId);
  }

  @Get('conversations')
  async listConversations(
    @Query() query: QuerySupportConversationsDto,
    @CurrentStudent() student: CurrentStudentPayload,
  ) {
    const ctx = await this.supportService.getStudentContext(student);
    return this.supportService.listConversations(ctx, query);
  }

  @Post('conversations')
  async createConversation(
    @Body() dto: CreateSupportConversationDto,
    @CurrentStudent() student: CurrentStudentPayload,
  ) {
    const ctx = await this.supportService.getStudentContext(student);
    return this.supportService.createConversation(ctx, dto);
  }

  @Get('conversations/:conversationId/messages')
  async listMessages(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Query() query: QuerySupportMessagesDto,
    @CurrentStudent() student: CurrentStudentPayload,
  ) {
    const ctx = await this.supportService.getStudentContext(student);
    return this.supportService.listMessages(ctx, conversationId, query);
  }

  @Post('messages')
  async sendMessage(
    @Body() dto: SendSupportMessageDto,
    @CurrentStudent() student: CurrentStudentPayload,
  ) {
    const ctx = await this.supportService.getStudentContext(student);
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
    @CurrentStudent() student: CurrentStudentPayload,
  ) {
    const ctx = await this.supportService.getStudentContext(student);
    return this.supportService.upload(ctx, dto.messageType, dto.conversationId, file);
  }

  @Delete('messages/:messageId')
  async deleteMessage(
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @CurrentStudent() student: CurrentStudentPayload,
  ) {
    const ctx = await this.supportService.getStudentContext(student);
    return this.supportService.deleteMessage(ctx, messageId);
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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
import { MessagesService } from './messages.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { QueryConversationsDto } from './dto/query-conversations.dto';
import { QueryMessagesDto } from './dto/query-messages.dto';

@UseGuards(JwtAuthGuard, BranchGuard)
@Controller('api/v1/conversations')
export class ConversationsController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  async listConversations(
    @Query() query: QueryConversationsDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    return this.messagesService.listConversations(user.id, branch.branchId, query);
  }

  @Post()
  async createConversation(
    @Body() dto: CreateConversationDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    const data = await this.messagesService.createConversation(
      dto,
      user.id,
      branch.branchId,
    );
    return { data };
  }

  @Get(':id')
  async getConversation(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    const data = await this.messagesService.getConversation(
      id,
      user.id,
      branch.branchId,
    );
    return { data };
  }

  @Get(':id/messages')
  async listMessages(
    @Param('id') id: string,
    @Query() query: QueryMessagesDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.messagesService.listMessages(id, user.id, query);
  }

  @Post(':id/messages')
  async sendMessage(
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    const roles = user.roles ?? [];
    const data = await this.messagesService.sendMessage(
      id,
      dto,
      user.id,
      branch.branchId,
      roles,
    );
    return { data };
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
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

@ApiTags('Messaging')
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
      user.roles ?? [],
    );
    return { data };
  }

  @Get(':id')
  async getConversation(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    const data = await this.messagesService.getConversationForRequester(
      id,
      user.id,
      branch.branchId,
    );
    return { data };
  }

  @Put(':id/read')
  async markConversationAsRead(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.messagesService.markConversationRead(id, user.id);
    return { data: null };
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

  @Delete(':id/messages')
  async clearMessages(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.messagesService.clearConversationMessages(id, user.id);
    return { data: null };
  }

  @Delete(':id')
  async deleteConversation(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    await this.messagesService.deleteConversation(id, user.id, branch.branchId);
    return { data: null };
  }
}

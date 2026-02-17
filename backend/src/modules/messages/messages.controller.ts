import { Controller, Param, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { MessagesService } from './messages.service';

@UseGuards(JwtAuthGuard, BranchGuard)
@Controller('api/v1/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Put(':id/read')
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const data = await this.messagesService.markMessageRead(id, user.id);
    return { data };
  }
}

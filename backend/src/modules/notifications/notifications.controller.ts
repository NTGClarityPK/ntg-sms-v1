import {
  Controller,
  Get,
  Put,
  Param,
  Query,
  UseGuards,
  Body,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { QueryNotificationsDto } from './dto/query-notifications.dto';

@Controller('api/v1/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async listNotifications(
    @Query() query: QueryNotificationsDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.notificationsService.listNotifications(user.id, query);
  }

  @Get(':id')
  async getNotificationById(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    const data = await this.notificationsService.getNotificationById(id, user.id);
    return { data };
  }

  @Put(':id/read')
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    const data = await this.notificationsService.markAsRead(id, user.id);
    return { data };
  }

  @Put('read-all')
  async markAllAsRead(@CurrentUser() user: { id: string }) {
    await this.notificationsService.markAllAsRead(user.id);
    return { data: { success: true } };
  }
}




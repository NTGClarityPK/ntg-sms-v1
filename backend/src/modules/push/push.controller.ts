import { Controller, Get, Post, Body, Delete, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PushService } from './push.service';
import { SubscribePushDto } from './dto/subscribe-push.dto';
import { UnsubscribePushDto } from './dto/unsubscribe-push.dto';

@Controller('api/v1/push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Get('vapid-public-key')
  async getVapidPublicKey() {
    const key = this.pushService.getVapidPublicKey();
    return { data: { vapidPublicKey: key ?? null } };
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  async subscribe(
    @Body() dto: SubscribePushDto,
    @CurrentUser() user: { id: string },
  ) {
    await this.pushService.subscribe(
      user.id,
      dto.endpoint,
      dto.keys.p256dh,
      dto.keys.auth,
    );
    return { data: { success: true } };
  }

  @Delete('subscribe')
  @UseGuards(JwtAuthGuard)
  async unsubscribe(
    @Body() dto: UnsubscribePushDto,
    @CurrentUser() user: { id: string },
  ) {
    await this.pushService.unsubscribe(user.id, dto.endpoint);
    return { data: { success: true } };
  }
}

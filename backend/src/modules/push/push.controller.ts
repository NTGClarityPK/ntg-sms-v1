import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PushService } from './push.service';
import { SubscribePushDto } from './dto/subscribe-push.dto';

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
}

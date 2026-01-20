import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SystemSettingsService } from './system-settings.service';
import { SystemSettingDto } from './dto/system-setting.dto';
import { UpdateSystemSettingDto } from './dto/update-system-setting.dto';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/settings')
export class SystemSettingsController {
  constructor(private readonly systemSettingsService: SystemSettingsService) {}

  @Get()
  async getAll(): Promise<{ data: SystemSettingDto[] }> {
    return this.systemSettingsService.getAll();
  }

  @Get(':key')
  async getByKey(@Param('key') key: string): Promise<{ data: SystemSettingDto }> {
    return this.systemSettingsService.getByKey(key);
  }

  @Put(':key')
  async upsert(@Param('key') key: string, @Body() body: UpdateSystemSettingDto): Promise<{ data: SystemSettingDto }> {
    // Body.key is optional; path param is the source of truth.
    const updated = await this.systemSettingsService.upsert(key, body.value);
    return { data: updated.data };
  }
}



import { Body, Controller, ForbiddenException, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BranchGuard } from '../../common/guards/branch.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { SystemSettingsService } from './system-settings.service';
import { SystemSettingDto } from './dto/system-setting.dto';
import { UpdateSystemSettingDto } from './dto/update-system-setting.dto';

@ApiTags('System settings')
@UseGuards(JwtAuthGuard, BranchGuard)
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
  async upsert(
    @Param('key') key: string,
    @Body() body: UpdateSystemSettingDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: SystemSettingDto }> {
    // Restrict sensitive settings to admins only.
    if (key.startsWith('student_leave_request_class_ids:')) {
      const isAdmin = user.roles?.includes('school_admin') || user.roles?.includes('super_admin');
      if (!isAdmin) {
        throw new ForbiddenException('Only school admins can update this setting');
      }
    }
    // Body.key is optional; path param is the source of truth.
    const updated = await this.systemSettingsService.upsert(key, body.value);
    return { data: updated.data };
  }
}



import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch, CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { SettingsImportService } from './settings-import.service';
import { ApplySettingsImportDto } from './dto/apply-settings-import.dto';

@Controller('api/v1/settings-import')
@UseGuards(JwtAuthGuard, BranchGuard)
@ApiBearerAuth()
export class SettingsImportController {
  constructor(private readonly settingsImportService: SettingsImportService) {}

  @Get('template')
  @ApiOperation({ summary: 'Get settings import workbook schema' })
  async getTemplate() {
    return this.settingsImportService.getTemplateDefinition();
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate settings workbook and generate apply token' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async validate(
    @UploadedFile() file: Express.Multer.File,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (!branch.branchId) {
      throw new BadRequestException('Branch context required');
    }
    return this.settingsImportService.validateWorkbook(
      file,
      branch.branchId,
      branch.tenantId,
      user.email,
    );
  }

  @Post('apply')
  @ApiOperation({ summary: 'Apply previously validated settings import' })
  async apply(@Body() body: ApplySettingsImportDto) {
    return this.settingsImportService.applyValidatedImport(body.validationToken);
  }
}


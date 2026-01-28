import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ParentsService } from './parents.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LinkChildDto } from './dto/link-child.dto';
import { SelectChildDto } from './dto/select-child.dto';

@Controller('api/v1/parents')
@UseGuards(JwtAuthGuard)
export class ParentsController {
  constructor(private readonly parentsService: ParentsService) {}

  @Get('associations')
  @UseGuards(BranchGuard)
  async listAssociations(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('parentId') parentId?: string,
    @Query('studentId') studentId?: string,
    @CurrentBranch() branch?: { branchId: string; tenantId: string },
  ) {
    const data = await this.parentsService.listAssociations(
      {
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
        parentId,
        studentId,
      },
      branch?.branchId || '',
    );
    return data;
  }

  @Get(':id/children')
  async getChildren(@Param('id') id: string) {
    const data = await this.parentsService.getChildren(id);
    return { data };
  }

  @Post(':id/children')
  async linkChild(@Param('id') id: string, @Body() input: LinkChildDto) {
    const data = await this.parentsService.linkChild(id, input);
    return { data };
  }

  @Delete(':id/children/:studentId')
  async unlinkChild(@Param('id') id: string, @Param('studentId') studentId: string) {
    await this.parentsService.unlinkChild(id, studentId);
    return { data: { success: true } };
  }
}


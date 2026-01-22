import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ParentsService } from './parents.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LinkChildDto } from './dto/link-child.dto';
import { SelectChildDto } from './dto/select-child.dto';

@Controller('api/v1/parents')
@UseGuards(JwtAuthGuard)
export class ParentsController {
  constructor(private readonly parentsService: ParentsService) {}

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


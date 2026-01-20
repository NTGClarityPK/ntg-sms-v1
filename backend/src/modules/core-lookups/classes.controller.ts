import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CoreLookupsService } from './core-lookups.service';
import { QueryClassesDto } from './dto/query-classes.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { ClassDto } from './dto/class.dto';

@Controller('api/v1/classes')
@UseGuards(JwtAuthGuard)
export class ClassesController {
  constructor(private readonly coreLookupsService: CoreLookupsService) {}

  @Get()
  async list(
    @Query() query: QueryClassesDto,
  ): Promise<{
    data: ClassDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.coreLookupsService.listClasses(query);
  }

  @Post()
  async create(@Body() body: CreateClassDto): Promise<{ data: ClassDto }> {
    const created = await this.coreLookupsService.createClass(body);
    return { data: created };
  }
}



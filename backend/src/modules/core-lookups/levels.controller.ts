import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CoreLookupsService } from './core-lookups.service';
import { QueryLevelsDto } from './dto/query-levels.dto';
import { CreateLevelDto } from './dto/create-level.dto';
import { LevelDto } from './dto/level.dto';

@Controller('api/v1/levels')
@UseGuards(JwtAuthGuard)
export class LevelsController {
  constructor(private readonly coreLookupsService: CoreLookupsService) {}

  @Get()
  async list(
    @Query() query: QueryLevelsDto,
  ): Promise<{
    data: LevelDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.coreLookupsService.listLevels(query);
  }

  @Post()
  async create(@Body() body: CreateLevelDto): Promise<{ data: LevelDto }> {
    const created = await this.coreLookupsService.createLevel(body);
    return { data: created };
  }
}



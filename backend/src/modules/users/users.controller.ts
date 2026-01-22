import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';
import { QueryUsersDto } from './dto/query-users.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';

@Controller('api/v1/users')
@UseGuards(JwtAuthGuard, BranchGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async listUsers(
    @Query() query: QueryUsersDto,
    @CurrentBranch() branch: { branchId: string },
  ) {
    return this.usersService.listUsers(query, branch.branchId);
  }

  @Get(':id')
  async getUserById(
    @Param('id') id: string,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.usersService.getUserById(id, branch.branchId);
    return { data };
  }

  @Post()
  async createUser(
    @Body() input: CreateUserDto,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.usersService.createUser(input, branch.branchId);
    return { data };
  }

  @Put(':id')
  async updateUser(
    @Param('id') id: string,
    @Body() input: UpdateUserDto,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.usersService.updateUser(id, input, branch.branchId);
    return { data };
  }

  @Put(':id/roles')
  async updateUserRoles(
    @Param('id') id: string,
    @Body() input: UpdateUserRolesDto,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.usersService.updateUserRoles(id, input, branch.branchId);
    return { data };
  }

  @Delete(':id')
  async deleteUser(
    @Param('id') id: string,
    @CurrentBranch() branch: { branchId: string },
  ) {
    await this.usersService.deleteUser(id, branch.branchId);
    return { data: { success: true } };
  }
}


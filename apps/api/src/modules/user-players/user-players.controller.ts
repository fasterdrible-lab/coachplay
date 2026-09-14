import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { UserPlayersService } from './user-players.service';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AuthUser } from '../../shared/types/auth-user.type';
import { CreateUserPlayerDto } from './dto/create-user-player.dto';
import { UpdateUserPlayerDto } from './dto/update-user-player.dto';
import { FindUserPlayersQueryDto } from './dto/find-user-players-query.dto';
import { CreateUserPlayerBuildDto } from './dto/create-user-player-build.dto';

@Controller('user-players')
export class UserPlayersController {
  constructor(private readonly userPlayersService: UserPlayersService) {}

  @Post()
  create(@Body() dto: CreateUserPlayerDto, @CurrentUser() user: AuthUser) {
    return this.userPlayersService.create(dto, user);
  }

  @Get()
  findAll(@Query() query: FindUserPlayersQueryDto, @CurrentUser() user: AuthUser) {
    return this.userPlayersService.findAll(query, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.userPlayersService.findOne(id, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserPlayerDto, @CurrentUser() user: AuthUser) {
    return this.userPlayersService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.userPlayersService.remove(id, user);
  }

  @Post(':id/builds')
  addBuild(
    @Param('id') id: string,
    @Body() dto: CreateUserPlayerBuildDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.userPlayersService.addBuild(id, dto, user);
  }

  @Patch(':id/builds/:buildId/activate')
  activateBuild(
    @Param('id') id: string,
    @Param('buildId') buildId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.userPlayersService.activateBuild(id, buildId, user);
  }
}

import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { SquadBuilderService } from './squad-builder.service';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AuthUser } from '../../shared/types/auth-user.type';
import { GenerateSquadDto } from './dto/generate-squad.dto';
import { SaveSquadDto } from './dto/save-squad.dto';

@Controller('squad-builder')
export class SquadBuilderController {
  constructor(private readonly squadBuilderService: SquadBuilderService) {}

  @Get('formations')
  listFormations(@Query('gameId') gameId: string) {
    return this.squadBuilderService.listFormations(gameId);
  }

  @Post('generate')
  generate(@Body() dto: GenerateSquadDto, @CurrentUser() user: AuthUser) {
    return this.squadBuilderService.generate(dto, user);
  }

  @Post('squads')
  saveSquad(@Body() dto: SaveSquadDto, @CurrentUser() user: AuthUser) {
    return this.squadBuilderService.saveSquad(dto, user);
  }

  @Get('squads')
  listSquads(@Query('gameId') gameId: string, @CurrentUser() user: AuthUser) {
    return this.squadBuilderService.listSquads(gameId, user);
  }

  @Get('squads/:id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.squadBuilderService.findOne(id, user);
  }

  @Get('squads/:id/explain')
  explainSquad(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.squadBuilderService.explainSquad(id, user);
  }

  @Delete('squads/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.squadBuilderService.remove(id, user);
  }
}

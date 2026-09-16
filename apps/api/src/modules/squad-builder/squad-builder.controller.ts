import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SquadBuilderService } from './squad-builder.service';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AuthUser } from '../../shared/types/auth-user.type';
import { GenerateSquadDto } from './dto/generate-squad.dto';
import { SaveSquadDto } from './dto/save-squad.dto';
import { GameIdQueryDto } from './dto/game-id-query.dto';

@Controller('squad-builder')
export class SquadBuilderController {
  constructor(private readonly squadBuilderService: SquadBuilderService) {}

  @Get('formations')
  listFormations(@Query() query: GameIdQueryDto) {
    return this.squadBuilderService.listFormations(query.gameId);
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
  listSquads(@Query() query: GameIdQueryDto, @CurrentUser() user: AuthUser) {
    return this.squadBuilderService.listSquads(query.gameId, user);
  }

  @Get('squads/:id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.squadBuilderService.findOne(id, user);
  }

  // Sempre chama IA generativa (Tarefa 10) — mesmo padrão de POST /matches/:id/video (Task 7.3):
  // limite dedicado, mais estrito que o default global (60/min).
  @Get('squads/:id/explain')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  explainSquad(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.squadBuilderService.explainSquad(id, user);
  }

  @Delete('squads/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.squadBuilderService.remove(id, user);
  }
}

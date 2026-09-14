import { Controller, Get, Param, Query } from '@nestjs/common';
import { PlayersService } from './players.service';
import { SearchPlayersQueryDto } from './dto/search-players-query.dto';
import { FindCardsQueryDto } from './dto/find-cards-query.dto';

@Controller()
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get('players')
  search(@Query() query: SearchPlayersQueryDto) {
    return this.playersService.search(query.query, query.gameId);
  }

  @Get('players/:id')
  findOne(@Param('id') id: string) {
    return this.playersService.findPlayerById(id);
  }

  @Get('player-cards')
  findCards(@Query() query: FindCardsQueryDto) {
    return this.playersService.findCards(query);
  }

  @Get('player-cards/:id')
  findCard(@Param('id') id: string) {
    return this.playersService.findCardById(id);
  }
}

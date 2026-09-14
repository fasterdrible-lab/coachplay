import { Body, Controller, Post } from '@nestjs/common';
import { PlayerBuildsService } from './player-builds.service';
import { CompareBuildsDto } from './dto/compare-builds.dto';

@Controller('player-builds')
export class PlayerBuildsController {
  constructor(private readonly playerBuildsService: PlayerBuildsService) {}

  @Post('compare')
  compare(@Body() dto: CompareBuildsDto) {
    return this.playerBuildsService.compare(dto);
  }
}

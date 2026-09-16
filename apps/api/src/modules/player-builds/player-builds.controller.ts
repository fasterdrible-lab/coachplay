import { Body, Controller, Post } from '@nestjs/common';
import { PlayerBuildsService } from './player-builds.service';
import { CompareBuildsDto } from './dto/compare-builds.dto';
import { GenerateBuildDto } from './dto/generate-build.dto';

@Controller('player-builds')
export class PlayerBuildsController {
  constructor(private readonly playerBuildsService: PlayerBuildsService) {}

  @Post('generate')
  generate(@Body() dto: GenerateBuildDto) {
    return this.playerBuildsService.generate(dto);
  }

  @Post('compare')
  compare(@Body() dto: CompareBuildsDto) {
    return this.playerBuildsService.compare(dto);
  }
}

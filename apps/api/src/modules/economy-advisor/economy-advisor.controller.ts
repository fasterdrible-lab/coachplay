import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { EconomyAdvisorService } from './economy-advisor.service';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AuthUser } from '../../shared/types/auth-user.type';
import { EvaluatePackDto } from './dto/evaluate-pack.dto';
import { ListPacksQueryDto } from './dto/list-packs-query.dto';

@Controller('economy-advisor')
export class EconomyAdvisorController {
  constructor(private readonly economyAdvisorService: EconomyAdvisorService) {}

  @Get('packs')
  listPacks(@Query() query: ListPacksQueryDto) {
    return this.economyAdvisorService.listPacks(query.gameId);
  }

  @Post('evaluate')
  evaluate(@Body() dto: EvaluatePackDto, @CurrentUser() user: AuthUser) {
    return this.economyAdvisorService.evaluate(dto, user);
  }
}

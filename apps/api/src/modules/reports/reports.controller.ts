import { Controller, Get, Param, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { EvolutionQueryDto } from './dto/evolution-query.dto';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AuthUser } from '../../shared/types/auth-user.type';

@Controller()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('matches/:matchId/report')
  getMatchReport(@Param('matchId') matchId: string, @CurrentUser() user: AuthUser) {
    return this.reportsService.getMatchReport(matchId, user);
  }

  @Get('reports/evolution')
  getEvolution(@Query() query: EvolutionQueryDto, @CurrentUser() user: AuthUser) {
    return this.reportsService.getEvolution(user.id, query.days ?? 30);
  }

  @Get('reports/summary')
  getSummary(@CurrentUser() user: AuthUser) {
    return this.reportsService.getSummary(user.id);
  }
}

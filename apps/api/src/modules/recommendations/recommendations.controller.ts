import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AuthUser } from '../../shared/types/auth-user.type';

@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  @Get('next-best-action')
  getNextBestAction(@CurrentUser() user: AuthUser) {
    return this.recommendationsService.getNextBestAction(user);
  }

  @Post(':id/dismiss')
  @HttpCode(HttpStatus.NO_CONTENT)
  dismiss(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.recommendationsService.dismiss(id, user);
  }
}

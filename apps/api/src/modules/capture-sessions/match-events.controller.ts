import { Controller, Get, Param } from '@nestjs/common';
import { CaptureSessionsService } from './capture-sessions.service';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AuthUser } from '../../shared/types/auth-user.type';

@Controller('matches')
export class MatchEventsController {
  constructor(private readonly captureSessionsService: CaptureSessionsService) {}

  @Get(':id/events')
  getEvents(@Param('id') matchId: string, @CurrentUser() user: AuthUser) {
    return this.captureSessionsService.getMatchEvents(matchId, user);
  }

  @Get(':id/feedbacks')
  getFeedbacks(@Param('id') matchId: string, @CurrentUser() user: AuthUser) {
    return this.captureSessionsService.getMatchFeedbacks(matchId, user);
  }
}

import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { LearningService } from './learning.service';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AuthUser } from '../../shared/types/auth-user.type';
import { FindPathsQueryDto } from './dto/find-paths-query.dto';
import { UpdateLearningProfileDto } from './dto/update-learning-profile.dto';

@Controller('learning')
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  @Get('paths')
  listPaths(@Query() query: FindPathsQueryDto) {
    return this.learningService.listPaths(query.gameId, query.level);
  }

  @Get('paths/:id')
  getPath(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.learningService.getPath(id, user);
  }

  @Get('paths/:id/progress')
  getProgress(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.learningService.getProgress(id, user);
  }

  @Post('lessons/:id/complete')
  completeLesson(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.learningService.completeLesson(id, user);
  }

  @Get('profile')
  getProfile(@CurrentUser() user: AuthUser) {
    return this.learningService.getProfile(user);
  }

  @Patch('profile')
  updateProfile(@Body() dto: UpdateLearningProfileDto, @CurrentUser() user: AuthUser) {
    return this.learningService.updateProfile(dto, user);
  }
}

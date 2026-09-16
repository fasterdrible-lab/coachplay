import { Controller, Get } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AuthUser } from '../../shared/types/auth-user.type';

@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('me')
  getMyProgress(@CurrentUser() user: AuthUser) {
    return this.progressService.getMyProgress(user);
  }
}

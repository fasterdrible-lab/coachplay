import { Controller, Get } from '@nestjs/common';
import { PlansService } from './plans.service';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AuthUser } from '../../shared/types/auth-user.type';

@Controller()
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get('plans')
  findAll() {
    return this.plansService.findAll();
  }

  @Get('subscriptions/me')
  getMySubscription(@CurrentUser() user: AuthUser) {
    return this.plansService.getMySubscription(user.id);
  }
}

import { Body, Controller, Post } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AuthUser } from '../../shared/types/auth-user.type';
import { OnboardingEfootballDto } from './dto/onboarding-efootball.dto';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('efootball')
  completeEfootballOnboarding(@Body() dto: OnboardingEfootballDto, @CurrentUser() user: AuthUser) {
    return this.onboardingService.completeOnboarding(dto, user);
  }
}

import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AskCoachService } from './ask-coach.service';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AuthUser } from '../../shared/types/auth-user.type';
import { AskCoachDto } from './dto/ask-coach.dto';

@Controller('ask-coach')
export class AskCoachController {
  constructor(private readonly askCoachService: AskCoachService) {}

  // 2 das 5 intents chamam IA generativa (Tarefa 14) — mesmo padrão de
  // POST /matches/:id/video (Task 7.3): limite dedicado, mais estrito que o default global
  // (60/min), pra endpoint que pode gerar custo real de provedor de IA por chamada.
  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 15 } })
  ask(@Body() dto: AskCoachDto, @CurrentUser() user: AuthUser) {
    return this.askCoachService.ask(dto, user);
  }
}

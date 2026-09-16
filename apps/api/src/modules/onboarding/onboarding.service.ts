import { Injectable } from '@nestjs/common';
import { GameProvider } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { AuthUser } from '../../shared/types/auth-user.type';
import { GamesService } from '../games/games.service';
import { OnboardingEfootballDto } from './dto/onboarding-efootball.dto';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamesService: GamesService,
  ) {}

  /**
   * Onboarding do eFootball (Tarefa 13): registra o nível autodeclarado + objetivos do usuário
   * (mesmos campos de `LearningService.updateProfile`, Tarefa 12) e já resolve a trilha inicial
   * correspondente — evita o cliente ter que encadear PATCH /learning/profile + GET /learning/paths.
   * `onboardingCompletedAt` só é preenchido na primeira vez; refazer o onboarding depois (ex.:
   * usuário reavalia o próprio nível) atualiza nível/objetivos sem perder a data original.
   */
  async completeOnboarding(dto: OnboardingEfootballDto, currentUser: AuthUser) {
    const game = await this.gamesService.findByProvider(GameProvider.EFOOTBALL);

    const existing = await this.prisma.userLearningProfile.findUnique({
      where: { userId: currentUser.id },
    });

    const profile = await this.prisma.userLearningProfile.upsert({
      where: { userId: currentUser.id },
      create: {
        userId: currentUser.id,
        level: dto.level,
        goals: dto.goals,
        onboardingCompletedAt: new Date(),
      },
      update: {
        level: dto.level,
        ...(dto.goals !== undefined && { goals: dto.goals }),
        onboardingCompletedAt: existing?.onboardingCompletedAt ?? new Date(),
      },
    });

    const recommendedPath = await this.prisma.learningPath.findUnique({
      where: { gameId_level: { gameId: game.id, level: dto.level } },
    });

    return { profile, recommendedPath };
  }
}

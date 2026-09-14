import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { computeBuild } from './player-build.calculator';
import { BuildStrategy } from './player-build-engine.config';
import { PlayerBuildResult } from './player-build.types';

export interface GenerateBuildParams {
  playerCardId: string;
  level: number;
  position: string;
  strategy: BuildStrategy;
  availableProgressionPoints: number;
  desiredRole?: string;
  userStyle?: string;
}

@Injectable()
export class PlayerBuildEngineService {
  constructor(private readonly prisma: PrismaService) {}

  async generateBuild(params: GenerateBuildParams): Promise<PlayerBuildResult> {
    const card = await this.prisma.playerCard.findUnique({
      where: { id: params.playerCardId },
      include: { stats: true },
    });

    if (!card) {
      throw new NotFoundException(`Carta "${params.playerCardId}" não encontrada`);
    }

    try {
      return computeBuild({
        playerCard: { id: card.id, overallBase: card.overallBase, maxLevel: card.maxLevel },
        stats: card.stats.map((s) => ({ statKey: s.statKey, baseValue: s.baseValue, maxValue: s.maxValue })),
        level: params.level,
        position: params.position,
        strategy: params.strategy,
        availableProgressionPoints: params.availableProgressionPoints,
        desiredRole: params.desiredRole,
        userStyle: params.userStyle,
      });
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { compareBuilds } from './build-comparator';
import { BuildComparisonResult } from './build-comparator.types';
import { CompareBuildsDto } from './dto/compare-builds.dto';
import { GenerateBuildDto } from './dto/generate-build.dto';
import { PlayerBuildEngineService } from '../player-build-engine/player-build-engine.service';
import { PlayerBuildResult } from '../player-build-engine/player-build.types';

@Injectable()
export class PlayerBuildsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly playerBuildEngine: PlayerBuildEngineService,
  ) {}

  /** Pré-visualização (Tarefa 18 — frontend): roda o Player Build Engine (Tarefa 5) e devolve o
   * resultado sem persistir nada. O usuário decide se salva via `POST /user-players/:id/builds`
   * (Tarefa 8) — esse endpoint nunca escreve no banco. */
  async generate(dto: GenerateBuildDto): Promise<PlayerBuildResult> {
    return this.playerBuildEngine.generateBuild(dto);
  }

  async compare(dto: CompareBuildsDto): Promise<BuildComparisonResult> {
    const card = await this.prisma.playerCard.findUnique({
      where: { id: dto.cardId },
      include: { stats: true, positions: true },
    });

    if (!card) {
      throw new NotFoundException(`Carta "${dto.cardId}" não encontrada`);
    }

    const cardPositions = [card.position, ...card.positions.map((p) => p.position)];

    try {
      return compareBuilds({
        cardId: card.id,
        overallBase: card.overallBase,
        stats: card.stats.map((s) => ({ statKey: s.statKey, baseValue: s.baseValue, maxValue: s.maxValue })),
        position: dto.position,
        cardPositions,
        buildA: dto.buildA,
        buildB: dto.buildB,
      });
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }
}

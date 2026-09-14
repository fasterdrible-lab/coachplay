import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { compareBuilds } from './build-comparator';
import { BuildComparisonResult } from './build-comparator.types';
import { CompareBuildsDto } from './dto/compare-builds.dto';

@Injectable()
export class PlayerBuildsService {
  constructor(private readonly prisma: PrismaService) {}

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

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { AuthUser } from '../../shared/types/auth-user.type';
import { SquadBuilderService } from '../squad-builder/squad-builder.service';
import { evaluatePack, EconomyAdvisorResult, EconomyTarget } from './economy-advisor.engine';
import { EvaluatePackDto } from './dto/evaluate-pack.dto';

@Injectable()
export class EconomyAdvisorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly squadBuilder: SquadBuilderService,
  ) {}

  async evaluate(dto: EvaluatePackDto, currentUser: AuthUser): Promise<EconomyAdvisorResult> {
    const pack = await this.prisma.pack.findUnique({
      where: { id: dto.packId },
      include: { targets: { include: { playerCard: { select: { overallBase: true, position: true } } } } },
    });
    if (!pack || !pack.active) {
      throw new NotFoundException(`Pack "${dto.packId}" não encontrado`);
    }

    const ownedRows = await this.prisma.userPlayer.findMany({
      where: { userId: currentUser.id, playerCard: { player: { gameId: pack.gameId } } },
      select: { playerCardId: true },
    });
    const ownedPlayerCardIds = ownedRows.map((r) => r.playerCardId);

    // "needs" (Tarefa 11): reaproveita o Squad Builder (Tarefa 9) — nunca infere necessidade sem
    // um elenco real pra comparar. Sem userSquadId, nenhuma necessidade é assumida.
    const weakPositionGroups = dto.userSquadId
      ? await this.squadBuilder.getWeakPositionGroups(dto.userSquadId, currentUser)
      : [];

    const targets: EconomyTarget[] = pack.targets.map((t) => ({
      playerCardId: t.playerCardId,
      probability: t.probability,
      overallBase: t.playerCard.overallBase,
      position: t.playerCard.position,
    }));

    const result = evaluatePack({
      userCoins: dto.userCoins,
      packCost: pack.cost,
      targets,
      ownedPlayerCardIds,
      weakPositionGroups,
    });

    await this.prisma.economyRecommendation.create({
      data: {
        userId: currentUser.id,
        packId: pack.id,
        recommendation: result.recommendation,
        score: result.recommendationScore ?? undefined,
        explanation: result.reasons.join(' ') || undefined,
      },
    });

    return result;
  }
}

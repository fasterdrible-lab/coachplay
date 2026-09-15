import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { AuthUser } from '../../shared/types/auth-user.type';
import { buildSquad, BuildSquadResult, SquadCandidate } from './squad-builder.engine';
import { FormationDef } from './formations.catalog';
import { GenerateSquadDto } from './dto/generate-squad.dto';
import { SaveSquadDto } from './dto/save-squad.dto';
import { EfootballCoachService } from '../efootball-coach/efootball-coach.service';
import { SquadCoachExplanation } from '../efootball-coach/squad-coach.types';
import { resolvePositionGroup } from '../player-build-engine/player-build-engine.config';

@Injectable()
export class SquadBuilderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly efootballCoach: EfootballCoachService,
  ) {}

  async listFormations(gameId: string) {
    return this.prisma.formation.findMany({
      where: { gameId, active: true },
      include: { positions: { orderBy: { order: 'asc' } } },
      orderBy: { code: 'asc' },
    });
  }

  async generate(dto: GenerateSquadDto, currentUser: AuthUser): Promise<BuildSquadResult> {
    const formation = await this.loadFormationDef(dto.gameId, dto.formationCode);
    const roster = await this.loadRoster(dto.gameId, currentUser.id);

    return buildSquad(formation, roster);
  }

  async saveSquad(dto: SaveSquadDto, currentUser: AuthUser) {
    const formation = await this.prisma.formation.findUnique({
      where: { gameId_code: { gameId: dto.gameId, code: dto.formationCode } },
    });
    if (!formation || !formation.active) {
      throw new NotFoundException(`Formação "${dto.formationCode}" não encontrada`);
    }

    const result = await this.generate(dto, currentUser);

    const userSquad = await this.prisma.userSquad.create({
      data: { userId: currentUser.id, gameId: dto.gameId, name: dto.name, formationId: formation.id },
    });

    const playerRows = [
      ...result.startingXI.map((s) => ({
        userSquadId: userSquad.id,
        userPlayerId: s.userPlayerId,
        slot: s.slot,
        isStarting: true,
      })),
      ...result.bench.map((userPlayerId) => ({
        userSquadId: userSquad.id,
        userPlayerId,
        slot: null,
        isStarting: false,
      })),
    ];

    if (playerRows.length > 0) {
      await this.prisma.squadPlayer.createMany({ data: playerRows });
    }

    return this.findOne(userSquad.id, currentUser);
  }

  async listSquads(gameId: string, currentUser: AuthUser) {
    return this.prisma.userSquad.findMany({
      where: { userId: currentUser.id, gameId },
      include: { formation: true, players: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, currentUser: AuthUser) {
    await this.assertOwner(id, currentUser);

    return this.prisma.userSquad.findUnique({
      where: { id },
      include: { formation: { include: { positions: true } }, players: true },
    });
  }

  async remove(id: string, currentUser: AuthUser): Promise<void> {
    await this.assertOwner(id, currentUser);

    await this.prisma.userSquad.delete({ where: { id } });
  }

  /**
   * Coach de Elenco (Tarefa 10) — reexecuta o motor determinístico (Tarefa 9) contra o elenco
   * ATUAL (reflete qualquer mudança desde que o elenco foi salvo, em vez de reler
   * startingXI/bench já persistidos) e pede pro AI Coach só explicar o resultado. A IA nunca
   * recebe acesso ao banco nem escolhe jogador — só o contexto já resolvido abaixo.
   */
  async explainSquad(userSquadId: string, currentUser: AuthUser): Promise<SquadCoachExplanation | null> {
    const { result, roster, nameById, overallById } = await this.recomputeSquad(userSquadId, currentUser);

    const rosterCompositionByGroup: Record<string, number> = {};
    for (const candidate of roster) {
      try {
        const group = resolvePositionGroup(candidate.position);
        rosterCompositionByGroup[group] = (rosterCompositionByGroup[group] ?? 0) + 1;
      } catch {
        // Posição fora do catálogo (dado de import malformado) — não entra na composição.
      }
    }

    return this.efootballCoach.explainSquad({
      formationCode: result.formationCode,
      startingXI: result.startingXI.map((s) => ({
        slot: s.slot,
        position: s.position,
        playerName: nameById.get(s.userPlayerId) ?? 'Desconhecido',
        overallBase: overallById.get(s.userPlayerId) ?? 0,
      })),
      weakPositions: result.weakPositions,
      rosterCompositionByGroup,
    });
  }

  /** Usado pelo Economy Advisor (Tarefa 11) como "needs" — nunca chama IA, só o motor da
   * Tarefa 9. Grupos posicionais (não slots) porque é isso que o pack de eFootball anuncia como
   * posição do jogador-alvo. */
  async getWeakPositionGroups(userSquadId: string, currentUser: AuthUser): Promise<string[]> {
    const { result } = await this.recomputeSquad(userSquadId, currentUser);

    const groups = new Set<string>();
    for (const weak of result.weakPositions) {
      try {
        groups.add(resolvePositionGroup(weak.position));
      } catch {
        // Posição fora do catálogo — não entra na lista de necessidades.
      }
    }
    return [...groups];
  }

  private async recomputeSquad(
    userSquadId: string,
    currentUser: AuthUser,
  ): Promise<{
    result: BuildSquadResult;
    roster: SquadCandidate[];
    nameById: Map<string, string>;
    overallById: Map<string, number>;
  }> {
    await this.assertOwner(userSquadId, currentUser);

    const squad = await this.prisma.userSquad.findUnique({
      where: { id: userSquadId },
      include: { formation: { include: { positions: { orderBy: { order: 'asc' } } } } },
    });
    if (!squad || !squad.formation) {
      throw new NotFoundException('Elenco não tem formação associada');
    }

    const formationDef: FormationDef = {
      code: squad.formation.code,
      name: squad.formation.name,
      slots: squad.formation.positions.map((p) => ({ slot: p.slot, position: p.position, x: p.x, y: p.y })),
    };

    const rosterRows = await this.prisma.userPlayer.findMany({
      where: { userId: currentUser.id, playerCard: { player: { gameId: squad.gameId } } },
      select: {
        id: true,
        playerCard: { select: { position: true, overallBase: true, player: { select: { name: true } } } },
      },
    });

    const roster: SquadCandidate[] = rosterRows.map((r) => ({
      userPlayerId: r.id,
      position: r.playerCard.position,
      overallBase: r.playerCard.overallBase,
    }));
    const nameById = new Map(rosterRows.map((r) => [r.id, r.playerCard.player.name]));
    const overallById = new Map(rosterRows.map((r) => [r.id, r.playerCard.overallBase]));

    const result = buildSquad(formationDef, roster);

    return { result, roster, nameById, overallById };
  }

  private async loadFormationDef(gameId: string, code: string): Promise<FormationDef> {
    const formation = await this.prisma.formation.findUnique({
      where: { gameId_code: { gameId, code } },
      include: { positions: { orderBy: { order: 'asc' } } },
    });

    if (!formation || !formation.active) {
      throw new NotFoundException(`Formação "${code}" não encontrada`);
    }

    return {
      code: formation.code,
      name: formation.name,
      slots: formation.positions.map((p) => ({ slot: p.slot, position: p.position, x: p.x, y: p.y })),
    };
  }

  private async loadRoster(gameId: string, userId: string): Promise<SquadCandidate[]> {
    const userPlayers = await this.prisma.userPlayer.findMany({
      where: { userId, playerCard: { player: { gameId } } },
      select: { id: true, playerCard: { select: { position: true, overallBase: true } } },
    });

    return userPlayers.map((up) => ({
      userPlayerId: up.id,
      position: up.playerCard.position,
      overallBase: up.playerCard.overallBase,
    }));
  }

  private async assertOwner(id: string, currentUser: AuthUser): Promise<void> {
    const squad = await this.prisma.userSquad.findUnique({ where: { id }, select: { userId: true } });

    if (!squad) throw new NotFoundException('Elenco não encontrado');
    if (squad.userId !== currentUser.id) throw new ForbiddenException('Acesso negado');
  }
}

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { AuthUser } from '../../shared/types/auth-user.type';
import { buildSquad, BuildSquadResult, SquadCandidate } from './squad-builder.engine';
import { FormationDef } from './formations.catalog';
import { GenerateSquadDto } from './dto/generate-squad.dto';
import { SaveSquadDto } from './dto/save-squad.dto';

@Injectable()
export class SquadBuilderService {
  constructor(private readonly prisma: PrismaService) {}

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

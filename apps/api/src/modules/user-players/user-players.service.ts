import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserPlayer } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { AuthUser } from '../../shared/types/auth-user.type';
import { CreateUserPlayerDto } from './dto/create-user-player.dto';
import { UpdateUserPlayerDto } from './dto/update-user-player.dto';
import { FindUserPlayersQueryDto } from './dto/find-user-players-query.dto';
import { CreateUserPlayerBuildDto } from './dto/create-user-player-build.dto';

const WITH_DETAIL = {
  include: { playerCard: { include: { player: true } }, builds: { orderBy: { createdAt: 'desc' as const } } },
} as const;

@Injectable()
export class UserPlayersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserPlayerDto, currentUser: AuthUser) {
    const card = await this.prisma.playerCard.findUnique({ where: { id: dto.playerCardId } });
    if (!card) {
      throw new NotFoundException(`Carta "${dto.playerCardId}" não encontrada`);
    }

    const existing = await this.prisma.userPlayer.findUnique({
      where: { userId_playerCardId: { userId: currentUser.id, playerCardId: dto.playerCardId } },
    });
    if (existing) {
      throw new ConflictException('Esta carta já está no seu elenco');
    }

    return this.prisma.userPlayer.create({
      data: { ...dto, userId: currentUser.id },
      ...WITH_DETAIL,
    });
  }

  async findAll(query: FindUserPlayersQueryDto, currentUser: AuthUser) {
    const where: Prisma.UserPlayerWhereInput = {
      userId: currentUser.id,
      ...(query.favorite !== undefined && { isFavorite: query.favorite }),
      ...(query.level !== undefined && { currentLevel: query.level }),
      playerCard: {
        ...(query.position && { position: query.position }),
        ...(query.cardType && { cardType: query.cardType }),
        ...((query.minOverall !== undefined || query.maxOverall !== undefined) && {
          overallBase: {
            ...(query.minOverall !== undefined && { gte: query.minOverall }),
            ...(query.maxOverall !== undefined && { lte: query.maxOverall }),
          },
        }),
      },
    };

    return this.prisma.userPlayer.findMany({
      where,
      ...WITH_DETAIL,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, currentUser: AuthUser) {
    await this.assertOwner(id, currentUser);

    return this.prisma.userPlayer.findUnique({ where: { id }, ...WITH_DETAIL });
  }

  async update(id: string, dto: UpdateUserPlayerDto, currentUser: AuthUser) {
    await this.assertOwner(id, currentUser);

    return this.prisma.userPlayer.update({ where: { id }, data: dto, ...WITH_DETAIL });
  }

  async remove(id: string, currentUser: AuthUser): Promise<void> {
    await this.assertOwner(id, currentUser);

    await this.prisma.userPlayer.delete({ where: { id } });
  }

  async addBuild(userPlayerId: string, dto: CreateUserPlayerBuildDto, currentUser: AuthUser) {
    await this.assertOwner(userPlayerId, currentUser);

    return this.prisma.userPlayerBuild.create({ data: { ...dto, userPlayerId } });
  }

  /** "Trocar build" — só aceita um build que pertence a este mesmo UserPlayer. */
  async activateBuild(userPlayerId: string, buildId: string, currentUser: AuthUser): Promise<UserPlayer> {
    await this.assertOwner(userPlayerId, currentUser);

    const build = await this.prisma.userPlayerBuild.findUnique({ where: { id: buildId } });
    if (!build || build.userPlayerId !== userPlayerId) {
      throw new NotFoundException(`Build "${buildId}" não encontrada para este jogador`);
    }

    return this.prisma.userPlayer.update({ where: { id: userPlayerId }, data: { currentBuildId: buildId } });
  }

  private async assertOwner(id: string, currentUser: AuthUser): Promise<void> {
    const userPlayer = await this.prisma.userPlayer.findUnique({ where: { id }, select: { userId: true } });

    if (!userPlayer) throw new NotFoundException('Jogador não encontrado no elenco');
    if (userPlayer.userId !== currentUser.id) throw new ForbiddenException('Acesso negado');
  }
}

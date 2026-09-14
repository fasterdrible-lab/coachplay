import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Player, PlayerCard, Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { normalizePlayerName } from './player-name.util';
import { CreatePlayerDto } from './dto/create-player.dto';
import { CreatePlayerCardDto } from './dto/create-player-card.dto';
import { FindCardsQueryDto } from './dto/find-cards-query.dto';

const PLAYER_WITH_CARDS = {
  include: { cards: { orderBy: { releaseDate: 'desc' as const } } },
} as const;

const CARD_DETAIL = {
  include: { positions: true, stats: true, skills: true, playStyles: true },
} as const;

@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService) {}

  async createPlayer(dto: CreatePlayerDto): Promise<Player> {
    const existing = await this.prisma.player.findUnique({
      where: { gameId_externalId: { gameId: dto.gameId, externalId: dto.externalId } },
    });
    if (existing) {
      throw new ConflictException(
        `Já existe um jogador com externalId "${dto.externalId}" para este jogo`,
      );
    }

    return this.prisma.player.create({
      data: { ...dto, normalizedName: normalizePlayerName(dto.name) },
    });
  }

  async findPlayerById(id: string): Promise<Player & { cards: PlayerCard[] }> {
    const player = await this.prisma.player.findUnique({ where: { id }, ...PLAYER_WITH_CARDS });
    if (!player) {
      throw new NotFoundException(`Jogador "${id}" não encontrado`);
    }
    return player;
  }

  /** Busca por nome/apelido — substring sobre normalizedName, sem depender de IA. */
  async search(query?: string, gameId?: string): Promise<Player[]> {
    const where: Prisma.PlayerWhereInput = {
      ...(gameId && { gameId }),
      ...(query?.trim() && {
        normalizedName: { contains: normalizePlayerName(query), mode: 'insensitive' },
      }),
    };

    return this.prisma.player.findMany({ where, orderBy: { name: 'asc' } });
  }

  async addCard(playerId: string, dto: CreatePlayerCardDto): Promise<PlayerCard> {
    await this.findPlayerById(playerId);

    const existing = await this.prisma.playerCard.findUnique({
      where: { playerId_externalId: { playerId, externalId: dto.externalId } },
    });
    if (existing) {
      throw new ConflictException(
        `Já existe uma carta com externalId "${dto.externalId}" para este jogador`,
      );
    }

    return this.prisma.playerCard.create({ data: { ...dto, playerId } });
  }

  async findCardById(id: string): Promise<PlayerCard> {
    const card = await this.prisma.playerCard.findUnique({ where: { id }, ...CARD_DETAIL });
    if (!card) {
      throw new NotFoundException(`Carta "${id}" não encontrada`);
    }
    return card;
  }

  async findCards(query: FindCardsQueryDto): Promise<PlayerCard[]> {
    const where: Prisma.PlayerCardWhereInput = {
      ...(query.playerId && { playerId: query.playerId }),
      ...(query.position && { position: query.position }),
      ...(query.cardType && { cardType: query.cardType }),
    };

    return this.prisma.playerCard.findMany({ where, orderBy: { overallBase: 'desc' } });
  }
}

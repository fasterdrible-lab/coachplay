import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Game, GameProvider } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class GamesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { provider: GameProvider; name: string }): Promise<Game> {
    return this.prisma.game.create({ data });
  }

  async findAll(): Promise<Game[]> {
    return this.prisma.game.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
  }

  /** Valida uma string recebida (ex.: query param) contra o enum GameProvider. */
  resolveProvider(provider: string): GameProvider {
    if (!Object.values(GameProvider).includes(provider as GameProvider)) {
      throw new BadRequestException(`Provider de jogo inválido: ${provider}`);
    }
    return provider as GameProvider;
  }

  /** Resolve e retorna o Game de um provider — só jogos ativos podem ser selecionados. */
  async findByProvider(provider: string): Promise<Game> {
    const resolved = this.resolveProvider(provider);
    const game = await this.prisma.game.findUnique({ where: { provider: resolved } });

    if (!game || !game.active) {
      throw new NotFoundException(`Jogo "${provider}" não encontrado ou inativo`);
    }

    return game;
  }
}

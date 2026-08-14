import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { TacticalPattern } from './tactical-pattern.type';

// Persistência dos TacticalPattern detectados (tactical-pattern.detector.ts, Tarefa 21). Camada
// fina sobre o Prisma — nenhuma regra de detecção vive aqui, mesmo padrão de
// tactical-snapshots.service.ts.
@Injectable()
export class TacticalPatternsService {
  constructor(private readonly prisma: PrismaService) {}

  // Upsert por (userId, pattern): uma nova rodada de detecção sempre atualiza o padrão já
  // existente em vez de duplicar — firstDetectedAt nunca é sobrescrito num update (é a data da
  // primeira vez que o padrão surgiu na história do usuário, não da última rodada).
  async upsertPatterns(userId: string, patterns: TacticalPattern[]) {
    return Promise.all(
      patterns.map((pattern) =>
        this.prisma.tacticalPattern.upsert({
          where: { userId_pattern: { userId, pattern: pattern.pattern } },
          create: {
            userId,
            pattern: pattern.pattern,
            frequency: pattern.frequency,
            confidence: pattern.confidence,
            severity: pattern.severity,
            firstDetectedAt: pattern.firstDetectedAt,
            lastDetectedAt: pattern.lastDetectedAt,
          },
          update: {
            frequency: pattern.frequency,
            confidence: pattern.confidence,
            severity: pattern.severity,
            lastDetectedAt: pattern.lastDetectedAt,
          },
        }),
      ),
    );
  }

  async findByUser(userId: string) {
    return this.prisma.tacticalPattern.findMany({
      where: { userId },
      orderBy: [{ confidence: 'desc' }, { lastDetectedAt: 'desc' }],
    });
  }
}

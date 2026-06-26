import { Injectable, Logger } from '@nestjs/common';
import { basename } from 'path';
import { ErrorSeverity, MatchStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';

const SEGMENT_SECONDS = 30;

const PHASE_CATEGORIES = [
  { upTo: 0.15, category: 'posicionamento' },
  { upTo: 0.35, category: 'ataque' },
  { upTo: 0.5, category: 'defesa' },
  { upTo: 0.65, category: 'passe' },
  { upTo: 0.82, category: 'finalizacao' },
  { upTo: 1.0, category: 'decisao' },
] as const;

// Categorias que tipicamente revelam erros táticos
const ERROR_CATEGORIES = new Set(['defesa', 'decisao', 'posicionamento']);

const SEVERITIES: ErrorSeverity[] = [ErrorSeverity.low, ErrorSeverity.medium, ErrorSeverity.high];

@Injectable()
export class GameAnalysisService {
  private readonly logger = new Logger(GameAnalysisService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Analisa os frames extraídos de uma partida, detecta eventos e erros básicos
   * e persiste os resultados no banco. Atualiza match.status para 'analyzed'.
   *
   * TODO (Task 4.4): substituir lógica de detecção por análise multimodal
   *                  via Claude Sonnet 4.6 (frames enviados como imagens).
   */
  async analyzeMatch(matchId: string, framePaths: string[]): Promise<void> {
    if (framePaths.length === 0) {
      this.logger.warn(`Match ${matchId}: nenhum frame disponível — analisado sem eventos`);
      await this.prisma.match.update({
        where: { id: matchId },
        data: { status: MatchStatus.analyzed },
      });
      return;
    }

    // Limpa análise anterior para suporte a re-análise (detectErrors FK → gameEvents, deletar nessa ordem)
    await this.prisma.$transaction([
      this.prisma.detectedError.deleteMany({ where: { matchId } }),
      this.prisma.gameEvent.deleteMany({ where: { matchId } }),
    ]);

    // 1 — Detecta e persiste eventos (1 por frame = 1 a cada 30s do vídeo)
    const eventData = this.buildEventData(matchId, framePaths);
    const savedEvents = await this.prisma.gameEvent.createManyAndReturn({
      data: eventData,
      select: { id: true, category: true, timestampStart: true },
    });

    // 2 — Detecta erros baseados nos eventos persistidos (IDs disponíveis para FK)
    const errorData = this.buildErrorData(matchId, savedEvents);
    if (errorData.length > 0) {
      await this.prisma.detectedError.createMany({ data: errorData });
    }

    // 3 — Marca partida como analisada
    await this.prisma.match.update({
      where: { id: matchId },
      data: { status: MatchStatus.analyzed },
    });

    this.logger.log(
      `Match ${matchId}: análise concluída — ${savedEvents.length} eventos, ${errorData.length} erros`,
    );
  }

  // ─── Detecção básica por fase da partida ────────────────────────────────────
  // Distribui categorias proporcionalmente ao andamento do vídeo.
  // Task 4.4 substituirá isso por classificação real via visão computacional.

  private buildEventData(
    matchId: string,
    framePaths: string[],
  ): Prisma.GameEventCreateManyInput[] {
    const total = framePaths.length;

    return framePaths.map((framePath, index) => {
      const timestampStart = this.frameTimestamp(framePath, index);
      const category = this.phaseCategory(total > 1 ? index / (total - 1) : 0);

      return {
        matchId,
        eventType: 'frame_segment',
        category,
        timestampStart,
        timestampEnd: timestampStart + SEGMENT_SECONDS,
        description: `Segmento de ${category} detectado aos ${timestampStart}s`,
        confidence: 0.5,
      };
    });
  }

  private buildErrorData(
    matchId: string,
    events: Array<{ id: string; category: string; timestampStart: number }>,
  ): Prisma.DetectedErrorCreateManyInput[] {
    const errorEvents = events.filter((e) => ERROR_CATEGORIES.has(e.category));
    const errors: Prisma.DetectedErrorCreateManyInput[] = [];

    // 1 erro a cada 3 eventos de risco (heurística básica)
    for (let i = 0; i < errorEvents.length; i += 3) {
      const event = errorEvents[i];
      errors.push({
        matchId,
        eventId: event.id,
        errorType: `${event.category}_incorreto`,
        category: event.category,
        severity: SEVERITIES[Math.floor(i / 3) % SEVERITIES.length],
        description: `Erro de ${event.category} identificado aos ${event.timestampStart}s`,
        suggestion: 'Rever posicionamento e tomada de decisão neste trecho da partida',
      });
    }

    return errors;
  }

  private phaseCategory(progress: number): string {
    return PHASE_CATEGORIES.find((p) => progress <= p.upTo)?.category ?? 'posicionamento';
  }

  private frameTimestamp(framePath: string, fallbackIndex: number): number {
    const match = basename(framePath).match(/frame_(\d+)\.jpg$/);
    if (!match) return fallbackIndex * SEGMENT_SECONDS;
    return (parseInt(match[1], 10) - 1) * SEGMENT_SECONDS;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { basename, join } from 'path';
import { copyFileSync, mkdirSync } from 'fs';
import { ErrorSeverity, MatchStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { GeminiVisionService, GeminiNotConfiguredError, GeminiFinding } from './gemini-vision.service';

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

export type ExtractFrameFn = (timestampSeconds: number, outputPath: string) => Promise<void>;

export interface AnalyzeMatchResult {
  visionCostEstimate: number;
}

@Injectable()
export class GameAnalysisService {
  private readonly logger = new Logger(GameAnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly geminiVision: GeminiVisionService,
  ) {}

  /**
   * Analisa uma partida e persiste eventos/erros no banco. Atualiza match.status para
   * 'analyzed'.
   *
   * Tenta análise real via Gemini (assiste o vídeo inteiro, aponta os erros de verdade
   * com timestamp exato — ver GeminiVisionService). Se a chave não estiver configurada,
   * cai na heurística antiga (categoria por posição no tempo do vídeo, erro em rotação
   * fixa) usando o grid de frames extraído a cada 30s. Qualquer outra falha do Gemini
   * (configurado mas com erro real) propaga — o worker já tem retry com backoff e marca
   * a partida como failed se todas as tentativas esgotarem.
   */
  async analyzeMatch(
    matchId: string,
    videoPath: string,
    framePaths: string[],
    extractFrame: ExtractFrameFn,
  ): Promise<AnalyzeMatchResult> {
    // Limpa análise anterior para suporte a re-análise (detectErrors FK → gameEvents, deletar nessa ordem)
    await this.prisma.$transaction([
      this.prisma.detectedError.deleteMany({ where: { matchId } }),
      this.prisma.gameEvent.deleteMany({ where: { matchId } }),
    ]);

    let visionCostEstimate = 0;
    let eventCount = 0;
    let errorCount = 0;
    let usedGemini = false;

    try {
      const { findings, costEstimate } = await this.geminiVision.analyzeVideo(videoPath);
      visionCostEstimate = costEstimate;
      usedGemini = true;
      errorCount = await this.persistGeminiFindings(matchId, findings, extractFrame);
      eventCount = findings.length;
    } catch (err) {
      if (!(err instanceof GeminiNotConfiguredError)) throw err;
      this.logger.warn(`Match ${matchId}: Gemini não configurado — usando heurística de fallback`);

      const fallback = await this.analyzeWithHeuristic(matchId, framePaths);
      eventCount = fallback.eventCount;
      errorCount = fallback.errorCount;
    }

    await this.prisma.match.update({
      where: { id: matchId },
      data: { status: MatchStatus.analyzed },
    });

    this.logger.log(
      `Match ${matchId}: análise concluída (${usedGemini ? 'Gemini' : 'heurística'}) — ` +
        `${eventCount} eventos, ${errorCount} erros`,
    );

    return { visionCostEstimate };
  }

  // ─── Caminho real (Gemini) ───────────────────────────────────────────────────

  private async persistGeminiFindings(
    matchId: string,
    findings: GeminiFinding[],
    extractFrame: ExtractFrameFn,
  ): Promise<number> {
    const uploadDir = this.config.get('UPLOAD_DIR', 'uploads');
    const destDir = join(process.cwd(), uploadDir, 'error-frames', matchId);

    for (const [index, finding] of findings.entries()) {
      const event = await this.prisma.gameEvent.create({
        data: {
          matchId,
          eventType: 'gemini_finding',
          category: finding.category,
          timestampStart: finding.timestampSeconds,
          timestampEnd: finding.timestampSeconds,
          description: finding.description,
        },
      });

      let frameUrl: string | null = null;
      try {
        mkdirSync(destDir, { recursive: true });
        const fileName = `error_${String(index + 1).padStart(4, '0')}.jpg`;
        await extractFrame(finding.timestampSeconds, join(destDir, fileName));
        frameUrl = `/uploads/error-frames/${matchId}/${fileName}`;
      } catch (err) {
        this.logger.warn(`Match ${matchId}: falha ao extrair frame do erro — ${(err as Error).message}`);
      }

      await this.prisma.detectedError.create({
        data: {
          matchId,
          eventId: event.id,
          errorType: `${finding.category}_incorreto`,
          category: finding.category,
          severity: finding.severity as ErrorSeverity,
          description: finding.description,
          suggestion: finding.suggestion,
          frameUrl,
        },
      });
    }

    return findings.length;
  }

  // ─── Fallback — heurística antiga por posição no tempo ───────────────────────
  // Usada só quando GEMINI_API_KEY não está configurada.

  private async analyzeWithHeuristic(
    matchId: string,
    framePaths: string[],
  ): Promise<{ eventCount: number; errorCount: number }> {
    if (framePaths.length === 0) {
      this.logger.warn(`Match ${matchId}: nenhum frame disponível — analisado sem eventos`);
      return { eventCount: 0, errorCount: 0 };
    }

    // Mapa timestamp → caminho do frame de origem — usado depois de o evento ser
    // persistido (createManyAndReturn não garante que a ordem de retorno bata com a
    // de entrada), pra saber qual frame copiar quando o evento virar um erro.
    const frameByTimestamp = new Map<number, string>();
    framePaths.forEach((framePath, index) => {
      frameByTimestamp.set(this.frameTimestamp(framePath, index), framePath);
    });

    const eventData = this.buildEventData(matchId, framePaths);
    const savedEvents = await this.prisma.gameEvent.createManyAndReturn({
      data: eventData,
      select: { id: true, category: true, timestampStart: true },
    });

    const errorData = this.buildErrorData(matchId, savedEvents, frameByTimestamp);
    if (errorData.length > 0) {
      await this.prisma.detectedError.createMany({ data: errorData });
    }

    return { eventCount: savedEvents.length, errorCount: errorData.length };
  }

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
    frameByTimestamp: Map<number, string>,
  ): Prisma.DetectedErrorCreateManyInput[] {
    const errorEvents = events.filter((e) => ERROR_CATEGORIES.has(e.category));
    const errors: Prisma.DetectedErrorCreateManyInput[] = [];

    // 1 erro a cada 3 eventos de risco (heurística básica)
    for (let i = 0; i < errorEvents.length; i += 3) {
      const event = errorEvents[i];
      const framePath = frameByTimestamp.get(event.timestampStart);

      errors.push({
        matchId,
        eventId: event.id,
        errorType: `${event.category}_incorreto`,
        category: event.category,
        severity: SEVERITIES[Math.floor(i / 3) % SEVERITIES.length],
        description: `Erro de ${event.category} identificado aos ${event.timestampStart}s`,
        suggestion: 'Rever posicionamento e tomada de decisão neste trecho da partida',
        frameUrl: framePath ? this.persistErrorFrame(matchId, framePath) : null,
      });
    }

    return errors;
  }

  /**
   * Copia o frame de um erro pra fora do diretório temporário de frames (apagado ao
   * final do processamento) e retorna a URL pública servida por `useStaticAssets`
   * (main.ts) sob o prefixo /uploads.
   */
  private persistErrorFrame(matchId: string, framePath: string): string | null {
    try {
      const uploadDir = this.config.get('UPLOAD_DIR', 'uploads');
      const destDir = join(process.cwd(), uploadDir, 'error-frames', matchId);
      mkdirSync(destDir, { recursive: true });

      const fileName = basename(framePath);
      copyFileSync(framePath, join(destDir, fileName));

      return `/uploads/error-frames/${matchId}/${fileName}`;
    } catch (err) {
      this.logger.warn(`Match ${matchId}: falha ao persistir frame do erro — ${(err as Error).message}`);
      return null;
    }
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

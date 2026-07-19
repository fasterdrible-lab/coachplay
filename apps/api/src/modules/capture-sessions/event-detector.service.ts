import { Injectable } from '@nestjs/common';
import { FrameGameState } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';

// Heurística MVP (Fase 2): um evento candidato é um pico de motion depois de um trecho sustentado
// de atividade ("match_running") — não há reconhecimento semântico do que aconteceu (gol, jogada,
// etc.), só um sinal de "algo mudou bruscamente na tela depois de um período ativo". Por isso a
// confiança máxima é deliberadamente limitada abaixo de 1.0.
const WINDOW_SIZE = 5;
const MIN_SUSTAINED_ACTIVE_FRAMES = 3;
const SPIKE_THRESHOLD = 0.25;
const MAX_CANDIDATE_CONFIDENCE = 0.9;

export interface CurrentFrameSignal {
  id: string;
  timestampMs: number;
  motionScore: number;
  gameState: FrameGameState | null;
}

export interface EventCandidate {
  confidence: number;
  motionSpike: number;
  windowSize: number;
  description: string;
}

@Injectable()
export class EventDetectorService {
  constructor(private readonly prisma: PrismaService) {}

  async detectCandidate(captureSessionId: string, currentFrame: CurrentFrameSignal): Promise<EventCandidate | null> {
    if (currentFrame.gameState !== FrameGameState.match_running) return null;

    const window = await this.prisma.frameSample.findMany({
      where: {
        captureSessionId,
        analysisStatus: 'analyzed',
        timestampMs: { lt: currentFrame.timestampMs },
      },
      orderBy: { timestampMs: 'desc' },
      take: WINDOW_SIZE,
      select: { motionScore: true, gameState: true },
    });

    if (window.length === 0) return null;

    const sustainedActiveCount = window.filter((f) => f.gameState === FrameGameState.match_running).length;
    if (sustainedActiveCount < MIN_SUSTAINED_ACTIVE_FRAMES) return null;

    const scores = window.map((f) => f.motionScore ?? 0);
    const baseline = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const spike = currentFrame.motionScore - baseline;

    if (spike <= SPIKE_THRESHOLD) return null;

    const confidence = clamp((spike / SPIKE_THRESHOLD) * 0.5 + 0.4, 0, MAX_CANDIDATE_CONFIDENCE);

    return {
      confidence,
      motionSpike: spike,
      windowSize: window.length,
      description: 'Pico de movimento detectado após trecho de atividade sustentada (heurística automática, pode ser impreciso)',
    };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

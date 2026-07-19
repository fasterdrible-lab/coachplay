import { Injectable, Logger } from '@nestjs/common';
// `sharp` usa `export =` (CJS puro, sem `.default`) — sob o tsconfig deste projeto
// (esModuleInterop desligado), `import sharp from 'sharp'` compilaria para
// `sharp_1.default`, que não existe em runtime. `import ... = require(...)` é a forma correta.
import sharp = require('sharp');
import { FrameGameState } from '@prisma/client';

// Heurística MVP (Fase 2): diferença de pixels entre o frame atual e o anterior da mesma sessão.
// Não há reconhecimento de HUD/cores específicas do EA FC — sem capturas reais disponíveis para
// calibrar esse tipo de regra. Por isso o detector só distingue "estático" (proxy: menu) de
// "ativo" (proxy: match_running); paused/replay/post_match ficam reservados no schema para uma
// heurística futura mais específica, quando houver imagens reais de referência.
const DIFF_WIDTH = 64;
const DIFF_HEIGHT = 36;
const STATIC_THRESHOLD = 0.02;
const ACTIVE_THRESHOLD = 0.05;
const MIN_CONFIDENCE = 0.5;
const MAX_CONFIDENCE = 0.95;
const AMBIGUOUS_CONFIDENCE = 0.35;

export interface GameStateDetectionResult {
  gameState: FrameGameState | null;
  confidence: number | null;
  motionScore: number | null;
}

@Injectable()
export class GameStateDetectorService {
  private readonly logger = new Logger(GameStateDetectorService.name);

  async detect(currentFramePath: string, previousFramePath: string | null): Promise<GameStateDetectionResult> {
    if (!previousFramePath) {
      return { gameState: null, confidence: null, motionScore: null };
    }

    let motionScore: number;
    try {
      motionScore = await this.computeMotionScore(currentFramePath, previousFramePath);
    } catch (err) {
      this.logger.warn(`Falha ao calcular motion score (${(err as Error).message})`);
      return { gameState: null, confidence: null, motionScore: null };
    }

    if (motionScore < STATIC_THRESHOLD) {
      const confidence = clamp(1 - motionScore / STATIC_THRESHOLD, MIN_CONFIDENCE, MAX_CONFIDENCE);
      return { gameState: FrameGameState.menu, confidence, motionScore };
    }

    if (motionScore >= ACTIVE_THRESHOLD) {
      const confidence = clamp(motionScore, MIN_CONFIDENCE, MAX_CONFIDENCE);
      return { gameState: FrameGameState.match_running, confidence, motionScore };
    }

    // Faixa ambígua entre os dois limiares: pender para "ativo" com confiança baixa é mais
    // seguro do que silenciar — um falso positivo aqui só custa uma classificação de baixa
    // confiança, um falso negativo perderia um evento real.
    return { gameState: FrameGameState.match_running, confidence: AMBIGUOUS_CONFIDENCE, motionScore };
  }

  private async computeMotionScore(currentFramePath: string, previousFramePath: string): Promise<number> {
    const [current, previous] = await Promise.all([
      sharp(currentFramePath).resize(DIFF_WIDTH, DIFF_HEIGHT, { fit: 'fill' }).grayscale().raw().toBuffer(),
      sharp(previousFramePath).resize(DIFF_WIDTH, DIFF_HEIGHT, { fit: 'fill' }).grayscale().raw().toBuffer(),
    ]);

    const length = Math.min(current.length, previous.length);
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += Math.abs(current[i] - previous[i]);
    }

    return sum / (length * 255);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

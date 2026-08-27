import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ffmpeg from 'fluent-ffmpeg';
import { join } from 'path';
import { mkdirSync, readdirSync, rmSync } from 'fs';

// Static binaries — eliminam dependência de FFmpeg instalado no sistema
const ffmpegPath = (require('@ffmpeg-installer/ffmpeg') as { path: string }).path;
const ffprobePath = (require('ffprobe-static') as { path: string }).path;

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const SEGMENT_SECONDS = 30;
const MAX_DURATION_SECONDS = 90 * 60; // 5400s

export interface VideoValidation {
  valid: boolean;
  durationSeconds: number;
  error?: string;
}

@Injectable()
export class VideoCaptureService {
  private readonly logger = new Logger(VideoCaptureService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Retorna a duração do vídeo em segundos via ffprobe.
   */
  async getVideoDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) return reject(new Error(`ffprobe: ${err.message}`));
        resolve(metadata.format.duration ?? 0);
      });
    });
  }

  /**
   * Valida formato e duração do vídeo (máx. 90 min).
   * Cobre o TODO deixado na Task 3.2.
   */
  async validateVideo(filePath: string): Promise<VideoValidation> {
    try {
      const durationSeconds = await this.getVideoDuration(filePath);
      if (durationSeconds > MAX_DURATION_SECONDS) {
        const minutes = Math.ceil(durationSeconds / 60);
        return {
          valid: false,
          durationSeconds,
          error: `Vídeo muito longo: ${minutes} min. Máximo permitido: 90 min.`,
        };
      }
      return { valid: true, durationSeconds };
    } catch (err) {
      return {
        valid: false,
        durationSeconds: 0,
        error: err instanceof Error ? err.message : 'Não foi possível ler o arquivo de vídeo.',
      };
    }
  }

  /**
   * Extrai 1 frame a cada SEGMENT_SECONDS segundos do vídeo.
   * Armazena em UPLOAD_DIR/frames/<matchId>/frame_XXXX.jpg.
   * Retorna array de caminhos absolutos ordenados por timestamp.
   */
  async extractFrames(matchId: string, videoPath: string): Promise<string[]> {
    const framesDir = this.getFramesDir(matchId);

    // Remove frames antigos caso o vídeo tenha sido substituído
    rmSync(framesDir, { recursive: true, force: true });
    mkdirSync(framesDir, { recursive: true });

    const durationSeconds = await this.getVideoDuration(videoPath);
    const expectedFrames = Math.max(1, Math.ceil(durationSeconds / SEGMENT_SECONDS));

    this.logger.log(
      `Match ${matchId}: iniciando extração de ~${expectedFrames} frames ` +
        `(vídeo ${Math.round(durationSeconds)}s, segmento ${SEGMENT_SECONDS}s)`,
    );

    await this.runExtraction(videoPath, framesDir);

    const framePaths = readdirSync(framesDir)
      .filter((f) => f.endsWith('.jpg'))
      .sort()
      .map((f) => join(framesDir, f));

    this.logger.log(`Match ${matchId}: ${framePaths.length} frames extraídos em ${framesDir}`);

    return framePaths;
  }

  /**
   * Extrai um único frame no timestamp exato informado (ex.: o segundo que o Gemini
   * apontou como o momento de um erro) — mais preciso que reusar o grid de 30s do
   * extractFrames, que pode errar por até 15s.
   */
  async extractFrameAt(videoPath: string, timestampSeconds: number, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .seekInput(Math.max(0, timestampSeconds))
        .outputOptions(['-frames:v 1', '-q:v 2'])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err: Error) =>
          reject(new Error(`FFmpeg falhou ao extrair frame em ${timestampSeconds}s: ${err.message}`)),
        )
        .run();
    });
  }

  /**
   * Remove o diretório de frames temporários de uma partida.
   * Chamado após a análise ser concluída (Task 4.3/4.4).
   */
  async cleanFrames(matchId: string): Promise<void> {
    const framesDir = this.getFramesDir(matchId);
    try {
      rmSync(framesDir, { recursive: true, force: true });
      this.logger.log(`Frames temporários removidos: match ${matchId}`);
    } catch {
      // Best-effort — não falha o fluxo de análise
    }
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private runExtraction(videoPath: string, outputDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions([
          `-vf fps=1/${SEGMENT_SECONDS}`, // 1 frame a cada SEGMENT_SECONDS
          '-q:v 2',                        // qualidade JPEG (1–31; menor = melhor)
          '-f image2',
        ])
        .output(join(outputDir, 'frame_%04d.jpg'))
        .on('progress', (p) => {
          if (p.percent != null) {
            this.logger.debug(`Progresso da extração: ${p.percent.toFixed(1)}%`);
          }
        })
        .on('end', () => resolve())
        .on('error', (err: Error) =>
          reject(new Error(`FFmpeg falhou durante extração de frames: ${err.message}`)),
        )
        .run();
    });
  }

  private getFramesDir(matchId: string): string {
    const uploadDir = this.config.get('UPLOAD_DIR', 'uploads');
    return join(process.cwd(), uploadDir, 'frames', matchId);
  }
}

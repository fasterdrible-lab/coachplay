import { Injectable, Logger } from '@nestjs/common';
import {
  GoogleGenAI,
  Type,
  MediaResolution,
  FileState,
  createUserContent,
  createPartFromUri,
} from '@google/genai';
import { SettingsService } from '../settings/settings.service';

const MODEL = 'gemini-2.5-flash';
// Preços por token (USD) — Gemini 2.5 Flash: $0.30/M input, $2.50/M output
const PRICE_IN_PER_TOKEN = 0.3 / 1_000_000;
const PRICE_OUT_PER_TOKEN = 2.5 / 1_000_000;

const CATEGORIES = ['ataque', 'defesa', 'passe', 'decisao', 'posicionamento', 'finalizacao'] as const;
const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

const FILE_POLL_INTERVAL_MS = 5_000;
const FILE_POLL_TIMEOUT_MS = 5 * 60 * 1000;

export class GeminiNotConfiguredError extends Error {
  constructor() {
    super('GEMINI_API_KEY não configurada');
    this.name = 'GeminiNotConfiguredError';
  }
}

export interface GeminiFinding {
  timestampSeconds: number;
  category: (typeof CATEGORIES)[number];
  severity: (typeof SEVERITIES)[number];
  description: string;
  suggestion: string;
}

export interface GeminiAnalysisResult {
  findings: GeminiFinding[];
  costEstimate: number;
}

@Injectable()
export class GeminiVisionService {
  private readonly logger = new Logger(GeminiVisionService.name);

  constructor(private readonly settings: SettingsService) {}

  /**
   * Manda o vídeo inteiro pro Gemini (ingestão nativa — sem re-amostrar frames) e pede
   * pra ele apontar os erros táticos de verdade, com timestamp exato de cada um.
   * Substitui a heurística fake de GameAnalysisService (posição no tempo + rotação fixa).
   */
  async analyzeVideo(videoPath: string, playerTeam?: string | null): Promise<GeminiAnalysisResult> {
    const apiKey = await this.settings.getGeminiKey();
    if (!apiKey) throw new GeminiNotConfiguredError();

    const ai = new GoogleGenAI({ apiKey });

    const uploaded = await ai.files.upload({ file: videoPath });
    if (!uploaded.name) throw new Error('Gemini: upload não retornou o nome do arquivo');
    const file = await this.waitUntilActive(ai, uploaded.name);
    if (!file.uri || !file.mimeType) {
      throw new Error('Gemini: arquivo processado sem URI/mimeType');
    }

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: createUserContent([
        createPartFromUri(file.uri, file.mimeType),
        this.buildPrompt(playerTeam),
      ]),
      config: {
        mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW,
        responseMimeType: 'application/json',
        responseSchema: this.buildResponseSchema(),
      },
    });

    const findings = this.parseFindings(response.text);
    const costEstimate = this.estimateCost(
      response.usageMetadata?.promptTokenCount,
      response.usageMetadata?.candidatesTokenCount,
    );

    this.logger.log(
      `Gemini: ${findings.length} erro(s) real(is) detectado(s) — custo ~US$${costEstimate.toFixed(4)}`,
    );

    return { findings, costEstimate };
  }

  private async waitUntilActive(ai: GoogleGenAI, fileName: string) {
    const startedAt = Date.now();
    let file = await ai.files.get({ name: fileName });

    while (file.state === FileState.PROCESSING) {
      if (Date.now() - startedAt > FILE_POLL_TIMEOUT_MS) {
        throw new Error('Gemini: tempo esgotado processando o upload do vídeo');
      }
      await new Promise((resolve) => setTimeout(resolve, FILE_POLL_INTERVAL_MS));
      file = await ai.files.get({ name: fileName });
    }

    if (file.state !== FileState.ACTIVE) {
      throw new Error(`Gemini: upload do vídeo falhou (estado ${file.state ?? 'desconhecido'})`);
    }

    return file;
  }

  private buildPrompt(playerTeam?: string | null): string {
    const teamHint = playerTeam?.trim()
      ? `\nO jogador que está gravando joga com: "${playerTeam.trim()}". Use essa informação (nome do\n` +
        `time/clube, cor de camisa, ou lado do campo, o que tiver sido informado) para identificar\n` +
        `com certeza qual time é o dele no vídeo antes de apontar qualquer erro. Se não conseguir\n` +
        `identificar o time com confiança a partir dessa descrição, diga isso na sua análise\n` +
        `mental mas ainda assim faça a melhor tentativa possível — não deixe de responder.\n`
      : `\nO vídeo não veio com nenhuma informação sobre qual time é o do jogador que está gravando —\n` +
        `use o contexto da partida (câmera, replays, gols comemorados) pra inferir isso com o\n` +
        `máximo de confiança possível antes de apontar erros.\n`;

    return `Você é um analista tático de EA FC (FIFA). Assista este vídeo de uma partida completa e
identifique os erros táticos mais importantes cometidos pelo jogador que está gravando (não
pelo adversário).
${teamHint}
Para cada erro, informe:
- timestampSeconds: o segundo exato do vídeo onde o erro acontece
- category: uma destas 6 opções exatas — ataque, defesa, passe, decisao, posicionamento, finalizacao
- severity: uma destas 4 opções exatas — low, medium, high, critical
- description: 1 frase curta em português descrevendo o que aconteceu
- suggestion: 1 frase curta em português com o que o jogador deveria ter feito

Liste só erros de verdade que você observou no vídeo — não invente pra preencher uma
quantidade. Se a partida foi bem jogada, retorne poucos erros ou nenhum.`;
  }

  private buildResponseSchema() {
    return {
      type: Type.OBJECT,
      properties: {
        errors: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              timestampSeconds: { type: Type.NUMBER },
              category: { type: Type.STRING, enum: [...CATEGORIES] },
              severity: { type: Type.STRING, enum: [...SEVERITIES] },
              description: { type: Type.STRING },
              suggestion: { type: Type.STRING },
            },
            required: ['timestampSeconds', 'category', 'severity', 'description', 'suggestion'],
          },
        },
      },
      required: ['errors'],
    };
  }

  private parseFindings(text: string | undefined): GeminiFinding[] {
    if (!text) throw new Error('Gemini: resposta vazia');

    let parsed: { errors?: unknown[] };
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      throw new Error(`Gemini: resposta não é JSON válido — ${(err as Error).message}`);
    }
    if (!Array.isArray(parsed.errors)) throw new Error('Gemini: resposta sem campo "errors"');

    const valid = parsed.errors.filter((e): e is GeminiFinding => this.isValidFinding(e));
    if (valid.length !== parsed.errors.length) {
      this.logger.warn(
        `Gemini: ${parsed.errors.length - valid.length} finding(s) descartado(s) por não bater com o schema`,
      );
    }

    return valid.map((f) => ({ ...f, timestampSeconds: Math.max(0, Math.round(f.timestampSeconds)) }));
  }

  private isValidFinding(value: unknown): value is GeminiFinding {
    if (typeof value !== 'object' || value === null) return false;
    const f = value as Record<string, unknown>;
    return (
      typeof f.timestampSeconds === 'number' &&
      typeof f.category === 'string' &&
      (CATEGORIES as readonly string[]).includes(f.category) &&
      typeof f.severity === 'string' &&
      (SEVERITIES as readonly string[]).includes(f.severity) &&
      typeof f.description === 'string' &&
      typeof f.suggestion === 'string'
    );
  }

  private estimateCost(inputTokens: number | undefined, outputTokens: number | undefined): number {
    return (inputTokens ?? 0) * PRICE_IN_PER_TOKEN + (outputTokens ?? 0) * PRICE_OUT_PER_TOKEN;
  }
}

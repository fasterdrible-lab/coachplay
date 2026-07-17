import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { AIAnalysis, AIAnalysisStatus, DetectedError, GameEvent } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { SettingsService } from '../settings/settings.service';

const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const OPENAI_MODEL = 'gpt-4o';
const DEEPSEEK_MODEL = 'deepseek-chat';
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const PROMPT_VERSION = '1.0.0';

// Preços por token (USD) — claude-sonnet-4-6: $3/M input, $15/M output
const CLAUDE_IN = 3.0 / 1_000_000;
const CLAUDE_OUT = 15.0 / 1_000_000;
// gpt-4o: ~$2.50/M input, $10/M output
const GPT4O_IN = 2.5 / 1_000_000;
const GPT4O_OUT = 10.0 / 1_000_000;
// deepseek-chat (cache miss): ~$0.27/M input, $1.10/M output
const DEEPSEEK_IN = 0.27 / 1_000_000;
const DEEPSEEK_OUT = 1.1 / 1_000_000;

interface AiResult {
  summary: string;
  inputTokens: number;
  outputTokens: number;
  rawResponse: string;
}

@Injectable()
export class AiCoachService {
  private readonly logger = new Logger(AiCoachService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async analyzeMatch(matchId: string): Promise<AIAnalysis> {
    const [gameEvents, detectedErrors] = await Promise.all([
      this.prisma.gameEvent.findMany({
        where: { matchId },
        orderBy: { timestampStart: 'asc' },
      }),
      this.prisma.detectedError.findMany({
        where: { matchId },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Cria ou reseta o registro para suporte a re-análise
    await this.prisma.aIAnalysis.upsert({
      where: { matchId },
      create: {
        matchId,
        modelUsed: ANTHROPIC_MODEL,
        promptVersion: PROMPT_VERSION,
        status: AIAnalysisStatus.processing,
      },
      update: {
        status: AIAnalysisStatus.processing,
        summary: null,
        costEstimate: null,
        rawResponse: null,
        promptVersion: PROMPT_VERSION,
      },
    });

    const prompt = this.buildPrompt(gameEvents, detectedErrors);

    const providers: Array<{
      model: string;
      call: () => Promise<AiResult>;
      priceIn: number;
      priceOut: number;
    }> = [
      { model: ANTHROPIC_MODEL, call: () => this.callClaude(prompt), priceIn: CLAUDE_IN, priceOut: CLAUDE_OUT },
      { model: OPENAI_MODEL, call: () => this.callGpt4o(prompt), priceIn: GPT4O_IN, priceOut: GPT4O_OUT },
      { model: DEEPSEEK_MODEL, call: () => this.callDeepSeek(prompt), priceIn: DEEPSEEK_IN, priceOut: DEEPSEEK_OUT },
    ];

    let result: AiResult | undefined;
    let modelUsed = '';
    let costEstimate = 0;
    let lastError: Error | undefined;

    for (const provider of providers) {
      try {
        result = await provider.call();
        modelUsed = provider.model;
        costEstimate = result.inputTokens * provider.priceIn + result.outputTokens * provider.priceOut;
        this.logger.log(`Match ${matchId}: análise concluída com ${provider.model}`);
        break;
      } catch (err) {
        lastError = err as Error;
        this.logger.warn(`Match ${matchId}: ${provider.model} falhou (${lastError.message})`);
      }
    }

    if (!result) {
      this.logger.error(`Match ${matchId}: todos os provedores de IA falharam — ${lastError?.message}`);
      await this.prisma.aIAnalysis.update({
        where: { matchId },
        data: { status: AIAnalysisStatus.failed },
      });
      throw lastError;
    }

    return this.prisma.aIAnalysis.update({
      where: { matchId },
      data: {
        modelUsed,
        summary: result.summary,
        costEstimate,
        rawResponse: result.rawResponse,
        status: AIAnalysisStatus.done,
      },
    });
  }

  private async callClaude(prompt: string): Promise<AiResult> {
    const anthropic = new Anthropic({ apiKey: await this.settings.getAnthropicKey() });
    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    return {
      summary: text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      rawResponse: text,
    };
  }

  private async callGpt4o(prompt: string): Promise<AiResult> {
    const openai = new OpenAI({ apiKey: await this.settings.getOpenAiKey() });
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
    });

    const text = response.choices[0]?.message?.content ?? '';

    return {
      summary: text,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
      rawResponse: text,
    };
  }

  private async callDeepSeek(prompt: string): Promise<AiResult> {
    // API do DeepSeek é compatível com o formato OpenAI — só troca a baseURL e o modelo.
    const deepseek = new OpenAI({ apiKey: await this.settings.getDeepSeekKey(), baseURL: DEEPSEEK_BASE_URL });
    const response = await deepseek.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
    });

    const text = response.choices[0]?.message?.content ?? '';

    return {
      summary: text,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
      rawResponse: text,
    };
  }

  private buildPrompt(gameEvents: GameEvent[], detectedErrors: DetectedError[]): string {
    const eventsText =
      gameEvents.length === 0
        ? 'Nenhum evento registrado.'
        : gameEvents
            .map(
              (e) => `[${e.timestampStart}s] ${e.category} — ${e.description ?? 'sem descrição'}`,
            )
            .join('\n');

    const errorsText =
      detectedErrors.length === 0
        ? 'Nenhum erro detectado.'
        : detectedErrors
            .map(
              (e) =>
                `[${e.severity.toUpperCase()}] ${e.category}: ${e.description}${e.suggestion ? ` → ${e.suggestion}` : ''}`,
            )
            .join('\n');

    return `Você é um coach especializado em EA FC (FIFA). Analise os dados desta partida e forneça um resumo tático conciso em português.

## Eventos da partida
${eventsText}

## Erros detectados
${errorsText}

Forneça:
1. Resumo geral da performance (2-3 frases)
2. Principal erro tático e como corrigi-lo
3. Pontos positivos observados
4. O que treinar antes da próxima partida

Seja objetivo e prático. Máximo 300 palavras.`;
  }
}

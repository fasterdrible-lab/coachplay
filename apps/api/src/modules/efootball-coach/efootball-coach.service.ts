import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { PrismaService } from '../../shared/database/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { buildSquadCoachPrompt } from './squad-coach-prompt.builder';
import { SquadCoachContext, SquadCoachExplanation } from './squad-coach.types';
import { buildBuildCoachPrompt } from './build-coach-prompt.builder';
import { BuildCoachContext, BuildCoachExplanation } from './build-coach.types';

/** Tarefa 21 (observabilidade) — identifica qual dos 2 pontos de chamada de IA do módulo eFootball
 * gerou a linha em `AiCallLog`. Um por método público desta classe, não por intent do Ask Coach
 * (que pode chamar `explainSquad`/`explainBuild` indiretamente) — o log fica no nível onde a
 * chamada de IA de fato acontece. */
export type AiCallFeature = 'squad_coach' | 'build_coach';

const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const OPENAI_MODEL = 'gpt-4o';
const DEEPSEEK_MODEL = 'deepseek-chat';
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const EXPLANATION_MAX_TOKENS = 220;

// Preços por token (USD) — mesmos valores/fonte de ai-coach.service.ts (módulo clássico), só
// duplicados aqui em vez de compartilhados: mesmo princípio de isolamento do resto do módulo
// eFootball (docs/efootball-architecture.md, risco 2) — nenhum dos dois módulos de IA depende do
// outro. Tarefa 20 (controle de custo de IA): antes desta tarefa, `response.usage` era descartado
// inteiramente — nenhuma chamada de IA do módulo eFootball tinha custo calculado.
const CLAUDE_IN = 3.0 / 1_000_000;
const CLAUDE_OUT = 15.0 / 1_000_000;
const GPT4O_IN = 2.5 / 1_000_000;
const GPT4O_OUT = 10.0 / 1_000_000;
const DEEPSEEK_IN = 0.27 / 1_000_000;
const DEEPSEEK_OUT = 1.1 / 1_000_000;
const GROQ_IN = 0.59 / 1_000_000;
const GROQ_OUT = 0.79 / 1_000_000;

interface ProviderCallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

interface CascadeResult {
  text: string;
  model: string;
  costEstimate: number;
}

/**
 * Coach de Elenco (Tarefa 10) + Coach de Build (Tarefa 14, Ask Coach) — cascata de provedores
 * isolada do AiCoachService "clássico" (módulo ai-coach, 100% EA FC hoje — ver
 * docs/efootball-architecture.md, risco 2: o pipeline de vídeo/narração de partida não deve ser
 * tocado por este módulo novo). Reaproveita só SettingsService (chaves de API), mesmo princípio
 * "explica, nunca decide" do AiCoachService.explainDecision para o tactical-engine — aqui a fonte
 * determinística é o squad-builder.engine (Tarefa 9) ou o player-build-engine (Tarefa 5), nunca o
 * tactical-engine.
 */
@Injectable()
export class EfootballCoachService {
  private readonly logger = new Logger(EfootballCoachService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async explainSquad(context: SquadCoachContext, userId: string): Promise<SquadCoachExplanation | null> {
    const result = await this.runCascade(buildSquadCoachPrompt(context), 'Coach de elenco', 'squad_coach', userId);
    return result ? { explanation: result.text, modelUsed: result.model, costEstimate: result.costEstimate } : null;
  }

  /** Narra o resultado do Player Build Engine (Tarefa 5) — usado pelo Ask Coach (Tarefa 14) na
   * intent BUILD_RECOMMENDATION. A IA nunca recebe acesso ao banco nem recalcula alocação, só o
   * `BuildCoachContext` já resolvido pelo chamador. */
  async explainBuild(context: BuildCoachContext, userId: string): Promise<BuildCoachExplanation | null> {
    const result = await this.runCascade(buildBuildCoachPrompt(context), 'Coach de build', 'build_coach', userId);
    return result ? { explanation: result.text, modelUsed: result.model, costEstimate: result.costEstimate } : null;
  }

  /** Loop de cascata compartilhado (Claude → GPT-4o → DeepSeek → Groq), genérico o bastante pra
   * qualquer prompt de texto — best-effort, nunca lança, `null` quando todos os provedores falham.
   * `costEstimate` (Tarefa 20) é sempre o custo só da chamada que teve sucesso — tentativas que
   * falharam antes de qualquer resposta não têm `usage` pra cobrar, mesmo princípio já usado em
   * `AiCoachService.analyzeMatch` (módulo clássico). `latencyMs` (Tarefa 21) mede o tempo total da
   * cascata (do prompt pronto até a resposta ou desistência), não só do provedor vencedor — é o
   * que importa pra performance percebida pelo usuário. Toda chamada — sucesso ou falha total —
   * grava uma linha em `AiCallLog`, best-effort (nunca derruba o fluxo principal). */
  private async runCascade(
    prompt: string,
    logLabel: string,
    feature: AiCallFeature,
    userId: string,
  ): Promise<CascadeResult | null> {
    const startedAt = Date.now();
    const providers: Array<{ model: string; priceIn: number; priceOut: number; call: () => Promise<ProviderCallResult> }> = [
      { model: ANTHROPIC_MODEL, priceIn: CLAUDE_IN, priceOut: CLAUDE_OUT, call: () => this.callClaude(prompt) },
      { model: OPENAI_MODEL, priceIn: GPT4O_IN, priceOut: GPT4O_OUT, call: () => this.callGpt4o(prompt) },
      { model: DEEPSEEK_MODEL, priceIn: DEEPSEEK_IN, priceOut: DEEPSEEK_OUT, call: () => this.callDeepSeek(prompt) },
      { model: GROQ_MODEL, priceIn: GROQ_IN, priceOut: GROQ_OUT, call: () => this.callGroq(prompt) },
    ];

    for (const provider of providers) {
      try {
        const result = await provider.call();
        if (result.text.trim()) {
          const costEstimate = result.inputTokens * provider.priceIn + result.outputTokens * provider.priceOut;
          const latencyMs = Date.now() - startedAt;
          this.logger.log(
            `${logLabel}: explicação gerada com ${provider.model} (custo estimado: US$ ${costEstimate.toFixed(6)}, ` +
              `${result.inputTokens} tokens de entrada, ${result.outputTokens} de saída, ${latencyMs}ms)`,
          );
          await this.logAiCall({ feature, userId, provider: provider.model, success: true, costEstimate, latencyMs });
          return { text: result.text.trim(), model: provider.model, costEstimate };
        }
      } catch (err) {
        this.logger.warn(`${logLabel}: ${provider.model} falhou (${(err as Error).message})`);
      }
    }

    const latencyMs = Date.now() - startedAt;
    this.logger.warn(`${logLabel}: todos os provedores de IA falharam`);
    await this.logAiCall({
      feature,
      userId,
      provider: null,
      success: false,
      costEstimate: 0,
      latencyMs,
      errorMessage: 'todos os provedores de IA falharam',
    });
    return null;
  }

  /** Tarefa 21 — histórico consultável (`AiCallLog`), fechando a lacuna que a Tarefa 20 deixou em
   * aberto (custo calculado e logado, mas nunca persistido). Best-effort, mesmo padrão de
   * `AuditLogsService.log()`: uma falha ao gravar nunca deve derrubar a resposta ao usuário. */
  private async logAiCall(entry: {
    feature: AiCallFeature;
    userId: string;
    provider: string | null;
    success: boolean;
    costEstimate: number;
    latencyMs: number;
    errorMessage?: string;
  }): Promise<void> {
    try {
      await this.prisma.aiCallLog.create({
        data: {
          feature: entry.feature,
          userId: entry.userId,
          provider: entry.provider,
          success: entry.success,
          costEstimate: entry.costEstimate,
          latencyMs: entry.latencyMs,
          errorMessage: entry.errorMessage,
        },
      });
    } catch (err) {
      this.logger.warn(`Falha ao gravar AiCallLog: ${(err as Error).message}`);
    }
  }

  private async callClaude(prompt: string): Promise<ProviderCallResult> {
    const anthropic = new Anthropic({ apiKey: await this.settings.getAnthropicKey() });
    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: EXPLANATION_MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    return { text, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
  }

  private async callGpt4o(prompt: string): Promise<ProviderCallResult> {
    const openai = new OpenAI({ apiKey: await this.settings.getOpenAiKey() });
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: EXPLANATION_MAX_TOKENS,
    });

    return {
      text: response.choices[0]?.message?.content ?? '',
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    };
  }

  private async callDeepSeek(prompt: string): Promise<ProviderCallResult> {
    const deepseek = new OpenAI({ apiKey: await this.settings.getDeepSeekKey(), baseURL: DEEPSEEK_BASE_URL });
    const response = await deepseek.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: EXPLANATION_MAX_TOKENS,
    });

    return {
      text: response.choices[0]?.message?.content ?? '',
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    };
  }

  private async callGroq(prompt: string): Promise<ProviderCallResult> {
    const groq = new OpenAI({ apiKey: await this.settings.getGroqKey(), baseURL: GROQ_BASE_URL });
    const response = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: EXPLANATION_MAX_TOKENS,
    });

    return {
      text: response.choices[0]?.message?.content ?? '',
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    };
  }
}

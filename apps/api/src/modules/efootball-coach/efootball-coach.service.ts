import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { SettingsService } from '../settings/settings.service';
import { buildSquadCoachPrompt } from './squad-coach-prompt.builder';
import { SquadCoachContext, SquadCoachExplanation } from './squad-coach.types';

const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const OPENAI_MODEL = 'gpt-4o';
const DEEPSEEK_MODEL = 'deepseek-chat';
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const SQUAD_EXPLANATION_MAX_TOKENS = 220;

/**
 * Coach de Elenco (Tarefa 10) — cascata de provedores isolada do AiCoachService "clássico"
 * (módulo ai-coach, 100% EA FC hoje — ver docs/efootball-architecture.md, risco 2: o pipeline de
 * vídeo/narração de partida não deve ser tocado por este módulo novo). Reaproveita só
 * SettingsService (chaves de API), mesmo princípio "explica, nunca decide" do
 * AiCoachService.explainDecision para o tactical-engine — aqui a fonte determinística é o
 * squad-builder.engine (Tarefa 9), não o tactical-engine.
 */
@Injectable()
export class EfootballCoachService {
  private readonly logger = new Logger(EfootballCoachService.name);

  constructor(private readonly settings: SettingsService) {}

  async explainSquad(context: SquadCoachContext): Promise<SquadCoachExplanation | null> {
    const prompt = buildSquadCoachPrompt(context);

    const providers: Array<{ model: string; call: () => Promise<string> }> = [
      { model: ANTHROPIC_MODEL, call: () => this.callClaude(prompt) },
      { model: OPENAI_MODEL, call: () => this.callGpt4o(prompt) },
      { model: DEEPSEEK_MODEL, call: () => this.callDeepSeek(prompt) },
      { model: GROQ_MODEL, call: () => this.callGroq(prompt) },
    ];

    for (const provider of providers) {
      try {
        const text = await provider.call();
        if (text.trim()) {
          this.logger.log(`Coach de elenco: explicação gerada com ${provider.model}`);
          return { explanation: text.trim(), modelUsed: provider.model };
        }
      } catch (err) {
        this.logger.warn(`Coach de elenco: ${provider.model} falhou (${(err as Error).message})`);
      }
    }

    this.logger.warn('Coach de elenco: todos os provedores de IA falharam');
    return null;
  }

  private async callClaude(prompt: string): Promise<string> {
    const anthropic = new Anthropic({ apiKey: await this.settings.getAnthropicKey() });
    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: SQUAD_EXPLANATION_MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    });

    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
  }

  private async callGpt4o(prompt: string): Promise<string> {
    const openai = new OpenAI({ apiKey: await this.settings.getOpenAiKey() });
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: SQUAD_EXPLANATION_MAX_TOKENS,
    });

    return response.choices[0]?.message?.content ?? '';
  }

  private async callDeepSeek(prompt: string): Promise<string> {
    const deepseek = new OpenAI({ apiKey: await this.settings.getDeepSeekKey(), baseURL: DEEPSEEK_BASE_URL });
    const response = await deepseek.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: SQUAD_EXPLANATION_MAX_TOKENS,
    });

    return response.choices[0]?.message?.content ?? '';
  }

  private async callGroq(prompt: string): Promise<string> {
    const groq = new OpenAI({ apiKey: await this.settings.getGroqKey(), baseURL: GROQ_BASE_URL });
    const response = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: SQUAD_EXPLANATION_MAX_TOKENS,
    });

    return response.choices[0]?.message?.content ?? '';
  }
}

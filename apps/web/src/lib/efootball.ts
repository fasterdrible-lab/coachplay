import { api } from './api';

export interface EfootballGame {
  id: string;
  provider: string;
  name: string;
  active: boolean;
}

let cachedGameId: string | null = null;

/**
 * Resolve o `gameId` do eFootball uma vez por sessão de navegação (só existe 1 jogo hoje —
 * `GameProvider.EFOOTBALL`, Tarefa 2) — evita toda tela do módulo eFootball repetir a mesma
 * chamada a `GET /games`.
 */
export async function getEfootballGameId(): Promise<string> {
  if (cachedGameId) return cachedGameId;

  const games = await api.get<EfootballGame[]>('/games');
  const game = games.find((g) => g.provider === 'EFOOTBALL') ?? games[0];
  if (!game) throw new Error('Nenhum jogo cadastrado no CoachPlay ainda.');

  cachedGameId = game.id;
  return cachedGameId;
}

export const LEARNING_LEVEL_LABELS: Record<string, string> = {
  BEGINNER: 'Iniciante',
  CASUAL: 'Casual',
  INTERMEDIATE: 'Intermediário',
  ADVANCED: 'Avançado',
  COMPETITIVE: 'Competitivo',
};

export const LEARNING_LEVELS = ['BEGINNER', 'CASUAL', 'INTERMEDIATE', 'ADVANCED', 'COMPETITIVE'] as const;

export const BUILD_STRATEGY_LABELS: Record<string, string> = {
  MAX_OVERALL: 'Overall máximo',
  BALANCED: 'Balanceada',
  DRIBBLER: 'Driblador',
  FINISHER: 'Finalizador',
  SPEED: 'Velocidade',
  PASSER: 'Passador',
  DEFENSIVE: 'Defensiva',
  POSITION_OPTIMIZED: 'Otimizada pra posição',
};

export const BUILD_STRATEGIES = [
  'MAX_OVERALL',
  'BALANCED',
  'DRIBBLER',
  'FINISHER',
  'SPEED',
  'PASSER',
  'DEFENSIVE',
  'POSITION_OPTIMIZED',
] as const;

/** Tarefa 20 (controle de custo de IA) — formata o `costEstimate` (USD) devolvido por
 * `EfootballCoachService` (Coach de Elenco/Coach de Build) e pelo Ask Coach. */
export function formatAiCost(costEstimate: number): string {
  if (costEstimate <= 0) return 'sem custo';
  return `~US$ ${costEstimate.toFixed(4)}`;
}

export const NEXT_BEST_ACTION_LABELS: Record<string, string> = {
  COMPLETE_ONBOARDING: 'Completar onboarding',
  ADD_PLAYERS: 'Adicionar jogadores',
  BUILD_SQUAD: 'Montar elenco',
  DO_LESSON: 'Fazer aula',
  ALL_CAUGHT_UP: 'Tudo em dia',
};

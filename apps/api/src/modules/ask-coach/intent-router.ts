import { normalizePlayerName } from '../players/player-name.util';
import { AskCoachIntent } from './ask-coach.types';

type KnownIntent = Exclude<AskCoachIntent, 'UNKNOWN'>;

/**
 * Intent Router (Tarefa 14) — 100% determinístico, sem IA na classificação: busca de palavra-chave
 * sobre o texto normalizado (minúsculas, sem acento — reaproveita `normalizePlayerName`, Tarefa 3).
 * A ordem de `INTENT_PRIORITY` resolve ambiguidade: intents com vocabulário mais específico
 * (BUILD_RECOMMENDATION, ECONOMY_ADVICE, SQUAD_ADVICE, LEARNING_RECOMMENDATION) são checados antes
 * de PLAYER_SEARCH, cujo vocabulário ("jogador") é o mais genérico dos cinco e por isso o mais
 * propenso a falso positivo em cima de qualquer outra pergunta sobre um jogador específico.
 */
const INTENT_KEYWORDS: Record<KnownIntent, string[]> = {
  BUILD_RECOMMENDATION: [
    'build',
    'evoluir',
    'evolucao',
    'pontos de progressao',
    'progressao',
    'como evoluir',
    'alocar pontos',
    'upar',
    'treinar meu jogador',
  ],
  ECONOMY_ADVICE: ['pack', 'moedas', 'coins', 'vale a pena comprar', 'gastar moeda', 'abrir pack'],
  SQUAD_ADVICE: [
    'escalacao',
    'escalar',
    'formacao',
    'time titular',
    'meu elenco',
    'meu time',
    'titular',
    'squad',
  ],
  LEARNING_RECOMMENDATION: [
    'aula',
    'aprender',
    'como jogar',
    'trilha',
    'modulo',
    'estudar',
    'academia',
    'dica de jogo',
  ],
  PLAYER_SEARCH: ['quem e', 'atributos de', 'overall de', 'carta de', 'stats de', 'informacoes sobre', 'jogador'],
};

const INTENT_PRIORITY: KnownIntent[] = [
  'BUILD_RECOMMENDATION',
  'ECONOMY_ADVICE',
  'SQUAD_ADVICE',
  'LEARNING_RECOMMENDATION',
  'PLAYER_SEARCH',
];

export function routeIntent(question: string): AskCoachIntent {
  const normalized = normalizePlayerName(question);

  for (const intent of INTENT_PRIORITY) {
    if (INTENT_KEYWORDS[intent].some((keyword) => normalized.includes(keyword))) {
      return intent;
    }
  }
  return 'UNKNOWN';
}

/** Frases de abertura comuns removidas antes de usar o resto como busca de jogador (Tarefa 3) —
 * heurística simples (não é NLP de verdade): na pior hipótese sobra texto de mais e a busca por
 * substring não encontra nada, o que já é tratado como resposta válida ("não encontrei"). */
const PLAYER_SEARCH_FILLER_PHRASES = [
  'quem e',
  'atributos de',
  'atributos do',
  'atributos da',
  'overall de',
  'overall do',
  'carta de',
  'carta do',
  'stats de',
  'stats do',
  'informacoes sobre',
  'me fale sobre',
  'fale sobre',
  'quero saber sobre',
  'o jogador',
  'a jogadora',
  'jogador',
  'jogadora',
];

export function extractPlayerSearchQuery(question: string): string {
  let remaining = question.trim();

  // Cada frase é removida no máximo 1x, na ordem declarada acima (mais específica primeiro) —
  // recalcula o texto normalizado a cada passo porque `remaining` muda a cada remoção.
  for (const phrase of PLAYER_SEARCH_FILLER_PHRASES) {
    const normalized = normalizePlayerName(remaining);
    const idx = normalized.indexOf(phrase);
    if (idx !== -1) {
      remaining = (remaining.slice(0, idx) + remaining.slice(idx + phrase.length)).trim();
    }
  }

  return remaining.replace(/[?!.]/g, '').trim();
}

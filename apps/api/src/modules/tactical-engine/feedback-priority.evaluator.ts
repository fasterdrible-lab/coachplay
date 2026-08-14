import { DecisionClassification } from './decision-classification';
import { FeedbackPriority, LastFeedbackDelivery } from './feedback-priority.type';

// Mapeamento de classificação (Fase 3) → prioridade de interrupção ao vivo (Tarefa 28).
// MAJOR_ERROR e ERROR pedem atenção imediata (algo deu errado, o jogador precisa saber agora).
// RISKY e EXCELLENT são "notáveis" mas não urgentes — um alerta ou um elogio, sem prioridade de
// interromper o jogo. ACCEPTABLE/GOOD são rotina: nenhuma decisão razoável gera feedback ao
// vivo (fica só no relatório pós-jogo, Fase 5) — interromper o jogador toda vez que ele faz algo
// "ok" tornaria o feedback ao vivo inútil por excesso.
const PRIORITY_BY_CLASSIFICATION: Record<DecisionClassification, FeedbackPriority> = {
  MAJOR_ERROR: 'CRITICAL',
  ERROR: 'HIGH',
  RISKY: 'MEDIUM',
  EXCELLENT: 'MEDIUM',
  GOOD: 'LOW',
  ACCEPTABLE: 'LOW',
};

export function computeFeedbackPriority(classification: DecisionClassification): FeedbackPriority {
  return PRIORITY_BY_CLASSIFICATION[classification];
}

// Cooldown mínimo (ms) entre entregas AO VIVO da mesma prioridade — quanto mais urgente, menor
// o cooldown (o jogador pode cometer vários erros graves em sequência e precisa saber de cada
// um); quanto mais rotineira, maior (evita interromper o fluxo do jogo por pouca coisa). LOW
// nunca é entregue (ver shouldDeliverLiveFeedback) — o valor aqui nunca é lido na prática, só
// existe para o Record cobrir as 4 prioridades.
const COOLDOWN_MS: Record<FeedbackPriority, number> = {
  CRITICAL: 15_000,
  HIGH: 30_000,
  MEDIUM: 60_000,
  LOW: Infinity,
};

/**
 * Decide se uma decisão de prioridade `priority` deve virar feedback AO VIVO agora (Tarefa 28),
 * dado quando foi a última entrega da sessão (`lastDelivery`, `null` se ainda não houve
 * nenhuma). Determinístico, sem estado próprio — quem chama é responsável por manter
 * `lastDelivery` entre chamadas (ver LastFeedbackDelivery).
 *
 * Regras: LOW nunca é entregue ao vivo (fica só no pós-jogo, Fase 5); sem entrega anterior,
 * qualquer prioridade elegível (MEDIUM+) é entregue imediatamente; o cooldown exigido é o MAIOR
 * entre o da prioridade atual e o da última entrega (uma entrega HIGH recente também segura a
 * próxima MEDIUM, não só a próxima HIGH); CRITICAL só respeita o próprio cooldown — nunca fica
 * "escondido" atrás do cooldown de um aviso menos urgente.
 */
export function shouldDeliverLiveFeedback(
  priority: FeedbackPriority,
  lastDelivery: LastFeedbackDelivery | null,
  nowMs: number,
): boolean {
  if (priority === 'LOW') return false;
  if (!lastDelivery) return true;

  const elapsed = nowMs - lastDelivery.atMs;
  if (priority === 'CRITICAL') return elapsed >= COOLDOWN_MS.CRITICAL;

  const requiredGap = Math.max(COOLDOWN_MS[priority], COOLDOWN_MS[lastDelivery.priority]);
  return elapsed >= requiredGap;
}

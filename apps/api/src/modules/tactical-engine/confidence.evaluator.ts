import { DecisionContext } from './decision-context.type';
import { EngineConfidence } from './confidence.type';

// Abaixo deste limiar (escala 0-1 de VirtualPlayer.confidence/TacticalGameState.confidence), o
// motor se recusa a produzir uma avaliação conclusiva — mesmo espírito de "sem confiança
// suficiente, não concluir" já aplicado em decision.evaluator.ts (candidata não encontrada) e
// tactical-pattern.detector.ts (amostra mínima). 0.5 é o ponto médio da escala: um sinal "mais
// provavelmente errado que certo" nunca deveria sustentar uma conclusão tática.
const MIN_CONFIDENCE_THRESHOLD = 0.5;

/**
 * Agrega os sinais de confiança relevantes para avaliar uma decisão em `context` (Tarefa 29):
 * confiança do snapshot inteiro (`gameState.confidence`), do portador da bola e, quando
 * informado, do alvo da ação (`targetPlayerId`). Usa o MENOR dos sinais disponíveis — nunca o
 * mais otimista — porque uma decisão só é tão confiável quanto o dado mais fraco que ela usa.
 * Sinais ausentes (jogador não encontrado) não são contados como 0 nem ignorados silenciosamente
 * quando faltam TODOS: nesse caso extremo, `score` é 0 (sem nenhum sinal, não há confiança).
 */
export function evaluateConfidence(context: DecisionContext, targetPlayerId?: string): EngineConfidence {
  const { gameState, ballCarrierId } = context;
  const ballCarrier = gameState.userPlayers.find((player) => player.trackingId === ballCarrierId);
  const target = targetPlayerId ? gameState.userPlayers.find((player) => player.trackingId === targetPlayerId) : undefined;

  const signals = [gameState.confidence, ballCarrier?.confidence, target?.confidence].filter(
    (value): value is number => value !== undefined,
  );

  const score = signals.length === 0 ? 0 : Math.min(...signals);
  return { score, sufficient: score >= MIN_CONFIDENCE_THRESHOLD };
}

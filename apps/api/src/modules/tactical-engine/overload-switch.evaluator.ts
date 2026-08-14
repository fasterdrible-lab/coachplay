import { PitchCoordinate } from './pitch-coordinate.type';
import { VirtualPlayer } from './tactical-game-state.type';
import { NumericalAdvantage } from './numerical-advantage.type';
import { SwitchOpportunity } from './switch-opportunity.type';
import { getAllPitchZones, getPitchZone } from './pitch-zone';
import { evaluateNumericalAdvantage, evaluateNumericalAdvantageAroundBall } from './numerical-advantage.evaluator';
import { clamp } from './geometry.util';

// Diferença mínima (usuário - adversário) para uma zona contar como oportunidade real de
// sobrecarga (Tarefa 20/princípio OVERLOAD) — 1 jogador a mais já é vantagem, mas não é
// necessariamente explorável com segurança; 2+ é o limiar usado no restante do motor para
// "vantagem clara" (mesmo espírito do cenário 3×2 documentado na Tarefa 10/Fase 2).
const OVERLOAD_MIN_DIFFERENCE = 2;

// Cada ponto de diferença a mais de superioridade numérica no lado oposto soma este tanto ao
// value do switch, centrado em 50 (lados equivalentes).
const SWITCH_VALUE_UNIT = 20;

/**
 * Zonas do campo onde o usuário tem superioridade numérica clara (Tarefa 20), ordenadas da
 * maior vantagem para a menor. Determinístico — reusa evaluateNumericalAdvantage (Fase 2,
 * Tarefa 10) por zona, sem heurística nova de contagem.
 */
export function detectOverloadOpportunities(
  userPlayers: VirtualPlayer[],
  opponentPlayers: VirtualPlayer[],
): NumericalAdvantage[] {
  return getAllPitchZones()
    .map((zone) => evaluateNumericalAdvantage(zone, userPlayers, opponentPlayers))
    .filter((advantage) => advantage.advantage === 'user' && advantage.difference >= OVERLOAD_MIN_DIFFERENCE)
    .sort((a, b) => b.difference - a.difference);
}

/**
 * Compara a superioridade numérica ao redor da bola com a do lado espelhado do campo (mesmo
 * terço, corredor oposto) — quantifica o valor de uma troca de lado (SWITCH_SIDE, ver
 * action-generator.ts) além do progressionValue geométrico já calculado por
 * passing-lanes.evaluator.ts. Só espelha o eixo x (corredor); o eixo y (terço) não muda, uma
 * troca de lado não avança nem recua a jogada.
 */
export function evaluateSwitchOpportunity(
  ball: PitchCoordinate,
  userPlayers: VirtualPlayer[],
  opponentPlayers: VirtualPlayer[],
): SwitchOpportunity {
  const mirroredBall: PitchCoordinate = { x: 1 - ball.x, y: ball.y };

  const currentSideAdvantage = evaluateNumericalAdvantageAroundBall(ball, userPlayers, opponentPlayers);
  const targetSideAdvantage = evaluateNumericalAdvantageAroundBall(mirroredBall, userPlayers, opponentPlayers);

  const value = clamp((targetSideAdvantage.difference - currentSideAdvantage.difference) * SWITCH_VALUE_UNIT + 50, 0, 100);

  return {
    currentChannel: getPitchZone(ball).channel,
    targetChannel: getPitchZone(mirroredBall).channel,
    currentSideAdvantage,
    targetSideAdvantage,
    value,
  };
}

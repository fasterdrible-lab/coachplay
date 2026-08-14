import { PitchCoordinate } from './pitch-coordinate.type';
import { VirtualPlayer } from './tactical-game-state.type';
import { DefensiveBalance } from './defensive-balance.type';
import { PitchChannel, getPitchZone } from './pitch-zone';
import { clamp, euclideanDistance } from './geometry.util';

// Raio dentro do qual um adversário à frente da bola é considerado "marcado" por um
// jogador do usuário posicionado atrás da bola.
const MARKING_RADIUS = 0.15;
// Corredores centrais — cobertura aqui protege a linha de passe mais perigosa (reta ao gol).
const CENTRAL_CHANNELS: ReadonlySet<PitchChannel> = new Set([
  PitchChannel.LEFT_HALF_SPACE,
  PitchChannel.CENTRAL_CHANNEL,
  PitchChannel.RIGHT_HALF_SPACE,
]);
// Jogadores centrais atrás da bola considerados cobertura completa (100%).
const FULL_CENTRAL_COVERAGE_COUNT = 2;

const WEIGHT_PLAYERS_BEHIND = 15;
const WEIGHT_CENTRAL_COVERAGE = 0.3;
const WEIGHT_WIDTH = 0.1;
const WEIGHT_FREE_OPPONENTS = 25;

/**
 * Avalia o risco deixado atrás da bola pelo time do usuário — quanto maior o score,
 * mais seguro contra um contra-ataque imediato.
 */
export function evaluateDefensiveBalance(
  ball: PitchCoordinate,
  userPlayers: VirtualPlayer[],
  opponentPlayers: VirtualPlayer[],
): DefensiveBalance {
  const behindBall = userPlayers.filter((player) => player.position.y < ball.y);
  const aheadOfBall = opponentPlayers.filter((player) => player.position.y > ball.y);

  const playersBehindBall = behindBall.length;

  const centralBehindBall = behindBall.filter((player) => CENTRAL_CHANNELS.has(getPitchZone(player.position).channel));
  const centralCoverage = clamp((centralBehindBall.length / FULL_CENTRAL_COVERAGE_COUNT) * 100, 0, 100);

  const defensiveWidth = behindBall.length > 0 ? spread(behindBall) * 100 : 0;

  const freeOpponents = aheadOfBall.filter(
    (opponent) => !behindBall.some((marker) => euclideanDistance(marker.position, opponent.position) <= MARKING_RADIUS),
  ).length;

  const difference = playersBehindBall - aheadOfBall.length;
  const advantage = difference > 0 ? 'user' : difference < 0 ? 'opponent' : 'neutral';

  const score = clamp(
    playersBehindBall * WEIGHT_PLAYERS_BEHIND +
      centralCoverage * WEIGHT_CENTRAL_COVERAGE +
      defensiveWidth * WEIGHT_WIDTH -
      freeOpponents * WEIGHT_FREE_OPPONENTS,
    0,
    100,
  );

  return { score, playersBehindBall, centralCoverage, defensiveWidth, freeOpponents, advantage };
}

function spread(players: VirtualPlayer[]): number {
  const xs = players.map((player) => player.position.x);
  return Math.max(...xs) - Math.min(...xs);
}

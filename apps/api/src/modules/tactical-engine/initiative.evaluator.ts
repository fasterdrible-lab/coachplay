import { PossessionState, VirtualPlayer } from './tactical-game-state.type';
import { InitiativeHolder, InitiativeState } from './initiative.type';
import { clamp } from './geometry.util';

// Ver docs/tactical-engine-domain.md (Tarefa 19) — princípio INITIATIVE traduzido: quem "dita
// o ritmo" combina posse da bola (metade do peso) com domínio territorial (a outra metade),
// não só posse — um time pode ter a bola e ainda estar preso na própria defesa.
const WEIGHT_POSSESSION = 0.5;
const WEIGHT_TERRITORY = 0.5;

// Ausência real de jogadores de um dos times no estado (não deveria acontecer com dados reais,
// mas fixtures de teste podem omitir) é tratada como posicionamento neutro (0.5), nunca como
// "time totalmente recuado" — evita inventar domínio territorial a partir de dado ausente.
const NEUTRAL_Y = 0.5;

const POSSESSION_FACTOR: Record<PossessionState, number> = {
  user: 100,
  opponent: 0,
  contested: 50,
  unknown: 50,
};

const HOLDER_THRESHOLDS: ReadonlyArray<{ upTo: number; holder: InitiativeHolder }> = [
  { upTo: 40, holder: 'opponent' },
  { upTo: 60, holder: 'neutral' },
  { upTo: 100, holder: 'user' },
];

/**
 * Avalia quem tem a iniciativa no instante do TacticalGameState — combinação de posse da bola
 * e domínio territorial (posicionamento médio avançado). Puramente geométrico/determinístico,
 * sem IA generativa. `possession === 'unknown'` não é tratado como erro (ver
 * docs/tactical-engine-domain.md, PossessionState) — reduz o peso da posse ao valor neutro (50),
 * mas o resultado continua sendo calculado normalmente a partir do posicionamento.
 */
export function evaluateInitiative(
  possession: PossessionState,
  userPlayers: VirtualPlayer[],
  opponentPlayers: VirtualPlayer[],
): InitiativeState {
  const possessionFactor = POSSESSION_FACTOR[possession];
  const territorialDominance = computeTerritorialDominance(userPlayers, opponentPlayers);

  const score = clamp(possessionFactor * WEIGHT_POSSESSION + territorialDominance * WEIGHT_TERRITORY, 0, 100);
  const holder = HOLDER_THRESHOLDS.find((threshold) => score <= threshold.upTo)!.holder;

  return { holder, score, territorialDominance, possessionFactor };
}

// y=0 é o fundo da própria defesa do usuário, y=1 o fundo do ataque (ver PitchCoordinate) —
// referencial ÚNICO para todo o campo, compartilhado pelos dois times (ver
// docs/tactical-engine-domain.md, PitchZone). Por isso a média das duas médias de y
// (usuário e adversário) já é, por si só, "a que altura do campo o jogo está acontecendo":
// se as duas médias estão altas (perto de 1), os dois times estão empurrados para o campo de
// ataque do usuário — ótimo domínio territorial para o usuário, mesmo que o adversário também
// esteja com posicionamento "avançado" nesse mesmo referencial (só que recuado perto do
// próprio gol). Se as duas médias estão baixas, o jogo acontece perto do gol do usuário —
// domínio do adversário. A diferença simples (avgUserY - avgOpponentY) foi descartada por não
// distinguir corretamente esse cenário (ex.: usuário recuado e adversário pressionando perto
// do gol do usuário dá diferença ~0, "neutro", quando na prática é domínio claro do adversário).
function computeTerritorialDominance(userPlayers: VirtualPlayer[], opponentPlayers: VirtualPlayer[]): number {
  const avgUserY = averageY(userPlayers);
  const avgOpponentY = averageY(opponentPlayers);

  return clamp(((avgUserY + avgOpponentY) / 2) * 100, 0, 100);
}

function averageY(players: VirtualPlayer[]): number {
  if (players.length === 0) return NEUTRAL_Y;
  return players.reduce((sum, player) => sum + player.position.y, 0) / players.length;
}

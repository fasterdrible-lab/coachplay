// Configuração central e versionada do Player Build Engine (Tarefa 5). Os pesos abaixo são o
// algoritmo PRÓPRIO do CoachPlay para decidir em quais atributos investir pontos de progressão
// — NUNCA a fórmula oficial de evolução do eFootball (que a Konami não publica) e nunca um valor
// vindo de IA. Os valores de atributo em si (base/máximo) sempre vêm de PlayerStat, importado via
// efootball-data-provider (Tarefa 4) a partir de fonte validada — o engine só decide COMO alocar
// pontos entre atributos já existentes, nunca inventa um valor de atributo.
// Alterar um peso aqui é uma mudança de produto (recalibra toda recomendação futura) — subir a
// versão quando isso acontecer.
export const PLAYER_BUILD_ENGINE_CONFIG_VERSION = '1.0.0';

/** Categorias de atributo reconhecidas pelo engine — nomenclatura genérica de futebol/eFootball,
 * usada só como identificador de peso. Os valores numéricos de cada carta vêm de PlayerStat. */
export const STAT_KEYS = [
  'offensive_awareness',
  'ball_control',
  'dribbling',
  'tight_possession',
  'low_pass',
  'lofted_pass',
  'finishing',
  'heading',
  'set_piece_taking',
  'curl',
  'speed',
  'acceleration',
  'kicking_power',
  'jumping',
  'physical_contact',
  'balance',
  'stamina',
  'defensive_awareness',
  'tackling',
  'aggression',
  'gk_awareness',
  'gk_catching',
  'gk_parrying',
  'gk_reflexes',
  'gk_reach',
] as const;

export type StatKey = (typeof STAT_KEYS)[number];

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

export type BuildStrategy = (typeof BUILD_STRATEGIES)[number];

export type PositionGroup = 'GK' | 'CB' | 'FB' | 'DM' | 'CM' | 'WF' | 'CF';

/** Mapeia o código de posição da carta/desejado para um dos 7 grupos táticos — usado pela
 * estratégia POSITION_OPTIMIZED e pelo cálculo de roleScore (qualquer estratégia). Posição
 * desconhecida lança erro explícito (mesma filosofia de pitch-zone.ts no tactical-engine: nunca
 * corrigir silenciosamente uma entrada inválida). */
const POSITION_GROUP_CODES: Record<PositionGroup, string[]> = {
  GK: ['GK'],
  CB: ['CB'],
  FB: ['LB', 'RB', 'LWB', 'RWB'],
  DM: ['DMF'],
  CM: ['CMF', 'AMF'],
  WF: ['LMF', 'RMF', 'LWF', 'RWF'],
  CF: ['SS', 'CF'],
};

export function resolvePositionGroup(position: string): PositionGroup {
  const upper = position.trim().toUpperCase();
  const entry = (Object.entries(POSITION_GROUP_CODES) as Array<[PositionGroup, string[]]>).find(
    ([, codes]) => codes.includes(upper),
  );
  if (!entry) {
    throw new Error(`Posição desconhecida pelo Player Build Engine: "${position}"`);
  }
  return entry[0];
}

/** Perfil de peso por grupo posicional — usado por POSITION_OPTIMIZED e por roleScore. */
export const POSITION_STAT_PROFILES: Record<PositionGroup, Partial<Record<StatKey, number>>> = {
  GK: { gk_reflexes: 3, gk_catching: 3, gk_parrying: 2, gk_reach: 2, gk_awareness: 3 },
  CB: { defensive_awareness: 3, heading: 2, tackling: 3, physical_contact: 2, jumping: 2, aggression: 1 },
  FB: { defensive_awareness: 2, speed: 2, stamina: 2, low_pass: 2, tackling: 2, acceleration: 1 },
  DM: { defensive_awareness: 3, tackling: 2, low_pass: 2, stamina: 2, ball_control: 1, aggression: 1 },
  CM: { low_pass: 2, offensive_awareness: 2, ball_control: 2, stamina: 2, dribbling: 1, defensive_awareness: 1 },
  WF: { dribbling: 3, acceleration: 2, speed: 2, ball_control: 2, tight_possession: 2, curl: 1 },
  CF: { finishing: 3, offensive_awareness: 2, kicking_power: 2, heading: 1, ball_control: 1, physical_contact: 1 },
};

/** Pesos das 7 estratégias que não dependem de posição — POSITION_OPTIMIZED usa
 * POSITION_STAT_PROFILES em tempo de cálculo (varia por posição desejada). */
export const STRATEGY_WEIGHTS: Record<Exclude<BuildStrategy, 'POSITION_OPTIMIZED'>, Partial<Record<StatKey, number>>> = {
  // Peso uniforme em TODOS os atributos — sem nenhuma noção de posição, maximiza o ganho bruto
  // de atributos (é exatamente por isso que pode divergir de POSITION_OPTIMIZED).
  MAX_OVERALL: Object.fromEntries(STAT_KEYS.map((key) => [key, 1])) as Record<StatKey, number>,
  // Peso uniforme, mas só nos atributos "de campo" mais genéricos — cresce de forma ampla sem se
  // concentrar tanto quanto POSITION_OPTIMIZED nem ser tão cego a papel quanto MAX_OVERALL.
  BALANCED: {
    offensive_awareness: 1,
    ball_control: 1,
    dribbling: 1,
    low_pass: 1,
    finishing: 1,
    speed: 1,
    stamina: 1,
    defensive_awareness: 1,
    physical_contact: 1,
    balance: 1,
  },
  DRIBBLER: { dribbling: 3, ball_control: 2, tight_possession: 2, balance: 2, acceleration: 1 },
  FINISHER: { finishing: 3, offensive_awareness: 2, kicking_power: 2, heading: 1, set_piece_taking: 1 },
  SPEED: { speed: 3, acceleration: 3, stamina: 1, balance: 1 },
  PASSER: { low_pass: 3, lofted_pass: 2, offensive_awareness: 2, curl: 1, ball_control: 1 },
  DEFENSIVE: { defensive_awareness: 3, tackling: 3, physical_contact: 1, heading: 1, aggression: 1, stamina: 1 },
};

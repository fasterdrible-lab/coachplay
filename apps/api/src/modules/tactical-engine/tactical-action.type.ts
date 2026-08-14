import { PitchZone } from './pitch-zone';

// Ver docs/tactical-engine-domain.md — AlternativeAction reusa este mesmo tipo (a
// distinção entre "ação real" e "alternativa" é posicional em DecisionEvaluation, não um
// tipo próprio). MVP: não tenta reproduzir todos os comandos do EA FC, só ações táticas.
export type TacticalActionType =
  | 'PASS'
  | 'CARRY'
  | 'HOLD'
  | 'RECYCLE'
  | 'SWITCH_SIDE'
  | 'PROGRESSIVE_PASS'
  | 'SAFE_PASS';

export interface TacticalAction {
  type: TacticalActionType;
  targetPlayerId?: string;
  targetZone?: PitchZone;
  estimatedRisk: number; // 0-100
  estimatedReward: number; // 0-100
}

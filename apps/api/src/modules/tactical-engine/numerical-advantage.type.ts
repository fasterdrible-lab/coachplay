import { PitchZone } from './pitch-zone';

// Ver docs/tactical-engine-domain.md, seção 3 (NumericalAdvantage).
export interface NumericalAdvantage {
  zone: PitchZone;
  userPlayers: number;
  opponentPlayers: number;
  difference: number; // userPlayers - opponentPlayers
  advantage: 'user' | 'opponent' | 'neutral';
}

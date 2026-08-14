import { TacticalGameState } from './tactical-game-state.type';

// Ver docs/tactical-engine-domain.md, seção 3 (DecisionContext). Só existe quando a posse é
// do usuário e o portador é identificável — caso contrário não há decisão a avaliar.
export interface DecisionContext {
  gameState: TacticalGameState;
  ballCarrierId: string;
}

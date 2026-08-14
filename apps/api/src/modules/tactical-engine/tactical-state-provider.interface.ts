import { TacticalGameState } from './tactical-game-state.type';

// Única costura entre o Tactical Engine e uma fonte de estado de partida.
// Ver docs/tactical-engine-domain.md, seção 5 e docs/tactical-engine-current-state.md, seção 2:
// hoje não existe nenhuma implementação real (nenhum pipeline extrai posição de
// jogadores/bola) — só implementações de teste (fixtures). O motor nunca importa
// game-analysis/capture-sessions diretamente; consome exclusivamente esta interface.
export interface TacticalStateProvider {
  getGameState(matchId: string, timestampMs: number): Promise<TacticalGameState | null>;
}

// Ver docs/tactical-engine-domain.md, seção 3 (DefensiveBalance). `score` é o
// DefensiveSafetyScore citado no plano original.
export interface DefensiveBalance {
  score: number; // 0 (exposto a contra-ataque) a 100 (seguro)
  playersBehindBall: number;
  centralCoverage: number; // 0-100 — cobertura central atrás da bola
  defensiveWidth: number; // 0-100 — dispersão lateral dos jogadores atrás da bola
  freeOpponents: number; // adversários à frente da bola sem nenhum marcador por perto
  advantage: 'user' | 'opponent' | 'neutral'; // playersBehindBall vs. adversários à frente
}

import { Module } from '@nestjs/common';
import { TacticalSnapshotsService } from './tactical-snapshots.service';
import { TacticalPatternsService } from './tactical-patterns.service';
import { TacticalProfilesService } from './tactical-profiles.service';
import { TacticalEngineFeatureFlagService } from './tactical-engine-feature-flag.service';

// Fase 1 (Fundação): persistência do TacticalGameState. Fases 2-3 (avaliadores geométricos e
// motor de decisões) são funções puras consumidas diretamente pelos arquivos que precisam
// delas — não são providers Nest, não há estado/injeção envolvidos. Fase 4 (princípios
// estratégicos) introduz os dois primeiros providers desde a Fase 1: TacticalPatternsService e
// TacticalProfilesService persistem dados que precisam ser lidos entre partidas (ao contrário
// dos avaliadores, que operam só sobre o TacticalGameState do instante). Fase 7 (robustez)
// adiciona TacticalEngineFeatureFlagService (Tarefa 35, ver ConfigService/TACTICAL_ENGINE_ENABLED)
// — consumido por AiCoachModule para gatear os dois pontos de entrada em texto (explainDecision,
// deliverLiveTacticalFeedback). Ver docs/tactical-engine-domain.md.
@Module({
  providers: [TacticalSnapshotsService, TacticalPatternsService, TacticalProfilesService, TacticalEngineFeatureFlagService],
  exports: [TacticalSnapshotsService, TacticalPatternsService, TacticalProfilesService, TacticalEngineFeatureFlagService],
})
export class TacticalEngineModule {}

# Tactical Engine — Referência de API

**Escopo:** referência da API **pública em TypeScript** do módulo `tactical-engine`
(`apps/api/src/modules/tactical-engine/`) — Fase 7, Tarefa 37. Não existe nenhum endpoint HTTP
ainda (ver `docs/tactical-engine-domain.md`, seção 5, e as notas de "próximo passo" em cada
entrada do `CHANGELOG.md`): tudo aqui é consumido por **import direto de TypeScript**, hoje só
por `apps/api/src/modules/ai-coach/ai-coach.service.ts`. Quando um controller for adicionado, os
`Promise`/tipos abaixo são o contrato que ele deve expor — este documento existe para que isso
não exija redesenhar nada.

Convenção do módulo: **função pura → arquivo próprio + `.type.ts`** (sem estado, sem Prisma, sem
IA); só os quatro serviços da seção 8 são providers NestJS injetáveis. Ver `docs/ARCHITECTURE.md`
para o mapa completo de arquivos.

---

## 1. Fundação (Fase 1)

| Export | Arquivo | Assinatura |
|---|---|---|
| `PitchCoordinate`, `isValidPitchCoordinate` | `pitch-coordinate.type.ts` | `{ x: number; y: number }`, validador |
| `getPitchZone` | `pitch-zone.ts` | `(position: PitchCoordinate) => PitchZone` — lança se fora de `[0,1]` |
| `invertPitchSide`, `pitchZoneEquals`, `getAllPitchZones`, `getNeighboringZones` | `pitch-zone.ts` | utilitários de zona |
| `TacticalGameState`, `VirtualPlayer`, `PossessionState`, `TacticalTeam` | `tactical-game-state.type.ts` | entrada única do motor |
| `TacticalStateProvider` | `tactical-state-provider.interface.ts` | `{ getGameState(matchId, timestampMs): Promise<TacticalGameState \| null> }` — **sem implementação real** (Tarefa 39, ver seção 9) |

## 2. Inteligência espacial (Fase 2)

| Export | Arquivo | Retorna |
|---|---|---|
| `evaluatePassingLanes` | `passing-lanes.evaluator.ts` | `PassingLane[]` |
| `evaluatePressure` | `pressure.evaluator.ts` | `PressureState` |
| `evaluateSpace` | `space.evaluator.ts` | `SpaceRegion[]` |
| `evaluateNumericalAdvantage`, `evaluateNumericalAdvantageAroundBall` | `numerical-advantage.evaluator.ts` | `NumericalAdvantage` |
| `evaluateDefensiveBalance` | `defensive-balance.evaluator.ts` | `DefensiveBalance` (`score` = `DefensiveSafetyScore`) |

## 3. Motor de decisões (Fase 3)

| Export | Arquivo | Retorna |
|---|---|---|
| `generateActions` | `action-generator.ts` | `TacticalAction[]` — candidatas do portador da bola |
| `calculateDecisionScore` | `decision-score.calculator.ts` | `DecisionScore` (ver `docs/tactical-engine-scoring.md`) |
| `classifyDecisionScore` | `decision-classification.ts` | `DecisionClassification` |
| `evaluateDecision` | `decision.evaluator.ts` | `DecisionEvaluation \| null` — **ponto de entrada principal** |
| `buildDecisionTree` | `decision-tree.evaluator.ts` | `DecisionTreeNode[]` |
| `detectTacticalSequences` | `tactical-sequence.detector.ts` | `TacticalSequence[]` |

## 4. Princípios estratégicos (Fase 4)

| Export | Arquivo | Retorna |
|---|---|---|
| `STRATEGIC_PRINCIPLE_CATALOG`, `getStrategicPrinciple`, `getAllStrategicPrinciples` | `strategic-principle.type.ts` | catálogo estático (8 princípios) |
| `evaluateInitiative` | `initiative.evaluator.ts` | `InitiativeState` |
| `detectOverloadOpportunities`, `evaluateSwitchOpportunity` | `overload-switch.evaluator.ts` | `NumericalAdvantage[]` / `SwitchOpportunity` |
| `evaluatePrincipleAdherence` | `principle-adherence.evaluator.ts` | `PrincipleAdherence[]` (8 itens, ordem estável) |
| `splitPrincipleAdherence` | `principle-adherence.type.ts` | `{ followed, violated }` |
| `detectTacticalPatterns` | `tactical-pattern.detector.ts` | `TacticalPattern[]` — entre partidas |
| `buildStrategicProfile` | `strategic-profile.builder.ts` | `StrategicProfile` |

Persistência (providers Nest): `TacticalPatternsService.{upsertPatterns, findByUser}`,
`TacticalProfilesService.{upsert, findByUser}` — ver seção 8.

## 5. Coach (Fase 5)

| Export | Arquivo | Retorna |
|---|---|---|
| `buildTacticalMatchReport` | `tactical-match-report.builder.ts` | `TacticalMatchReport` |
| `buildTacticalTimeline` | `tactical-timeline.builder.ts` | `TacticalTimelineEntry[]` |
| `buildDecisionDetail` | `decision-detail.builder.ts` | `DecisionDetail` |
| `TacticalDecisionFeedback` | `tactical-decision-feedback.type.ts` | tipo — produzido por `AiCoachService.explainDecision()` |

Todos os três builders recebem `EvaluatedDecisionRecord[]` (`evaluated-decision-record.type.ts`)
— quem monta esse array (avaliação + julgamento de princípios por instante) é responsabilidade
do chamador; ver `tactical-engine.integration.spec.ts` para um exemplo completo do encadeamento.

## 6. Tempo real (Fase 6)

| Export | Arquivo | Retorna |
|---|---|---|
| `computeFeedbackPriority` | `feedback-priority.evaluator.ts` | `FeedbackPriority` (`LOW`\|`MEDIUM`\|`HIGH`\|`CRITICAL`) |
| `shouldDeliverLiveFeedback` | `feedback-priority.evaluator.ts` | `boolean` — dado `LastFeedbackDelivery \| null` + `nowMs` |

## 7. Robustez (Fase 7)

| Export | Arquivo | Retorna |
|---|---|---|
| `evaluateConfidence` | `confidence.evaluator.ts` | `EngineConfidence` (Tarefa 29) |
| `buildVirtualPlayer`, `buildDecisionContext`, e os cenários nomeados (`pressuredCentralPassFixture`, `safeRecyclingFixture`, `counterAttackThreeVsTwoFixture`, `centralOverloadFixture`, `lowConfidenceStateFixture`, `fullSquadFixture`) | `tactical-fixtures.ts` | dataset de teste (Tarefa 34) — **não é API de produção**, só consumida por specs |
| `TacticalEngineFeatureFlagService.isEnabled()` | `tactical-engine-feature-flag.service.ts` | `boolean`, lê `TACTICAL_ENGINE_ENABLED` (Tarefa 35) |

## 8. Providers NestJS (injetáveis via `TacticalEngineModule`)

Os únicos quatro exports do módulo com estado/efeito colateral (Prisma ou `ConfigService`):

| Serviço | Métodos | Uso |
|---|---|---|
| `TacticalSnapshotsService` | `save(state)`, `findByMatch(matchId)` | persiste `TacticalGameState` (Fase 1) |
| `TacticalPatternsService` | `upsertPatterns(userId, patterns)`, `findByUser(userId)` | persiste `TacticalPattern` (Fase 4) |
| `TacticalProfilesService` | `upsert(userId, profile)`, `findByUser(userId)` | persiste `StrategicProfile` (Fase 4) |
| `TacticalEngineFeatureFlagService` | `isEnabled()` | feature flag (Fase 7) |

## 9. Consumido hoje só por `ai-coach`

`AiCoachModule` importa `TacticalEngineModule` e usa, em `AiCoachService`:

- `explainDecision(evaluation, principles)` — Fase 5, ver seção 5 acima + `docs/tactical-engine-scoring.md`, seção 6
- `deliverLiveTacticalFeedback(evaluation, principles, matchId, feedbackLevel, lastDelivery)` — Fase 6

Ambos gateados por `TacticalEngineFeatureFlagService.isEnabled()` (desabilitado por padrão).
**Nenhum outro módulo do projeto importa `tactical-engine`** — a direção da dependência é sempre
`ai-coach` → `tactical-engine`, nunca o contrário (ver `docs/tactical-engine-domain.md`, seção 5).

`TacticalStateProvider` (seção 1) continua sem implementação real — é a única costura pensada
para uma futura fonte de dados de visão computacional. Até lá, todo consumo do motor (inclusive
os dois métodos acima) depende de quem chama montar o `TacticalGameState`/`DecisionContext` à
mão (hoje, só fixtures de teste — ver `tactical-fixtures.ts`).

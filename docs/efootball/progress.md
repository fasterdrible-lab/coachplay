# Progresso — `progress` (Tarefa 16)

> `GET /progress/me` — agrega, num único snapshot, o que cada engine do módulo eFootball já
> persistiu sobre o usuário. Camada fina de leitura: nunca recalcula nada dos motores, só
> conta/lê.

## Métricas agregadas

```
GET /progress/me
  → {
      computedAt, formulaVersion,
      metrics: {
        learning:      { level, onboardingCompletedAt, lessonsCompleted, lessonsTotal, percent }
        roster:        { playersOwned, favoritePlayers, buildsSaved }
        squads:        { squadsSaved }
        economy:       { evaluationsCount, recommendedCount }
        matchAnalysis: { totalAnalyzed, worstCategory, avgOverallScore }
      }
    }
```

| Métrica | Fonte | Tarefa |
|---|---|---|
| `learning.level` / `onboardingCompletedAt` | `LearningService.getProfile` | 12 / 13 |
| `learning.lessonsCompleted/Total/percent` | `Lesson`/`UserLessonProgress` — **todas as trilhas do jogo**, não só a do nível atual do usuário | 12 |
| `roster.playersOwned/favoritePlayers` | `UserPlayer.count` | 8 |
| `roster.buildsSaved` | `UserPlayerBuild.count` | 8 |
| `squads.squadsSaved` | `UserSquad.count` | 9 |
| `economy.evaluationsCount/recommendedCount` | `EconomyRecommendation.count` | 11 |
| `matchAnalysis.*` | `ReportsService.getSummary` — mesmo resumo já reaproveitado pela integração da Tarefa 15 | 15 |

## Por que `lessonsTotal` cobre todas as trilhas, não só a do nível atual

Diferente de `LearningService.getProgress(pathId)` (Tarefa 12, progresso de UMA trilha
específica), o Progresso agrega a Academia inteira — reflete melhor "quanto da Academia esse
usuário já percorreu no total", já que a Tarefa 15 pode recomendar aulas de módulos fora da
trilha do nível atual (ver `docs/efootball/match-analysis-integration.md`).

## Persistência — `UserProgressSnapshot`

Uma linha por `(userId, gameId)`, sempre sobrescrita no cálculo mais recente — mesmo padrão do
`TacticalProfile` (Tactical Engine, Fase 4): sem histórico de snapshots anteriores, cada leitura
recalcula e grava por cima. `formulaVersion` (`PROGRESS_FORMULA_VERSION`) versiona a fórmula de
agregação, mesmo padrão de `DECISION_SCORE_CONFIG_VERSION`/`PLAYER_BUILD_ENGINE_CONFIG_VERSION` —
mudar quais métricas entram, ou como são calculadas, é mudança de produto e sobe a versão.

## Segurança

Toda contagem é filtrada por `currentUser.id` — nunca aceita um `userId` vindo do cliente, mesmo
padrão de todo o módulo eFootball desde a Tarefa 8.

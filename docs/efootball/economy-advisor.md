# Economy / Coins Advisor (Tarefa 11)

> Responde "Tenho 900 moedas. Vale tentar esse pack?" — 100% determinístico, sem IA. Regra dura:
> nunca inventar probabilidade de pack. Sem probabilidade verificada, a recomendação é sempre
> `INSUFFICIENT_DATA`.

## Modelos

```
Pack               — custo, moeda (coins/gp), fonte/data de verificação das odds
PackTargetPlayer    — jogador-alvo do pack; probability é sempre null até vir de fonte validada
EconomyRecommendation — 1 linha por avaliação pedida (trilha de auditoria, nunca recalculada)
```

## Motor (`economy-advisor.engine.ts`)

```
evaluatePack(input) → { recommendation, teamNeedScore, duplicateRisk, expectedValue, coinRisk,
                         recommendationScore, reasons }
```

- **teamNeedScore**/**duplicateRisk**: não dependem de odds — calculados por presença/ausência
  (`ownedPlayerCardIds`, `weakPositionGroups`), sempre computáveis.
- **hasOdds**/**validOdds**: se NENHUM alvo tem probabilidade → `INSUFFICIENT_DATA` ("pack sem
  odds"). Se QUALQUER probabilidade estiver fora de [0,1] → `INSUFFICIENT_DATA` ("odds
  inválidas") — um dado parcialmente corrompido invalida o pack inteiro, nunca ignora
  silenciosamente o alvo ruim e segue com o resto.
- **expectedValue**: só calculado com odds válidas — soma de `probability × (overallBase/99)`
  por alvo conhecido. Aproximação própria do CoachPlay (mesmo espírito de `overall.util.ts`),
  nunca a probabilidade real do jogo.
- **coinRisk**: `packCost / userCoins` (1 se `userCoins <= 0`). Sem moedas suficientes
  (`userCoins < packCost`) força `NOT_RECOMMENDED` independente do resto.
- **recommendationScore**: `(0.4×teamNeed + 0.3×min(1,expectedValue) + 0.3×(1-coinRisk)) ×
  (1-duplicateRisk)`, limiares versionados (`economy-advisor.config.ts`): `>= 0.6` RECOMMENDED,
  `>= 0.35` NEUTRAL, senão NOT_RECOMMENDED.

## "needs" — reaproveita o Squad Builder (Tarefa 9)

`EconomyAdvisorService.evaluate()` chama `SquadBuilderService.getWeakPositionGroups(userSquadId,
user)` (novo método, Tarefa 9 — reexecuta `buildSquad` sem chamar IA) quando `userSquadId` é
informado. Sem `userSquadId`, nenhuma necessidade é assumida (`weakPositionGroups: []`) — nunca
infere carência de elenco sem um elenco real pra comparar.

## Endpoint

```
POST /economy-advisor/evaluate   { packId, userCoins, userSquadId? }
```

Persiste `EconomyRecommendation` a cada avaliação (histórico de auditoria).

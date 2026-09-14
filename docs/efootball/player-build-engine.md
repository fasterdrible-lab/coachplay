# Player Build Engine + Comparador de Builds (Tarefas 5–6)

> Motor 100% determinístico — nenhuma chamada de IA no caminho de cálculo. Segue o mesmo
> princípio já usado pelo Tactical Engine: motor calcula, IA só explica (fica para a Tarefa 10).

## `player-build-engine` (Tarefa 5)

Entrada: `playerCard` + `stats` (sempre vindos de `PlayerStat`, nunca inventados) + `level` +
`position` + `strategy` + `availableProgressionPoints` (+ `desiredRole`/`userStyle`, repassados
sem uso algorítmico, só para o futuro AI Coach narrar).

```
allocatePoints (allocation.engine.ts)
  round-robin ponderado: a cada ponto, aloca para o atributo com menor razão
  (alocado+1)/peso, empate por ordem alfabética — determinístico, nunca excede headroom
  (maxValue - baseValue) nem o orçamento total.
```

8 estratégias (`player-build-engine.config.ts`, versionado —
`PLAYER_BUILD_ENGINE_CONFIG_VERSION`):

| Estratégia | Peso |
|---|---|
| `MAX_OVERALL` | uniforme em TODOS os atributos — sem noção de posição |
| `BALANCED` | uniforme só nos atributos genéricos de campo |
| `DRIBBLER` | dribbling, ball_control, tight_possession, balance, acceleration |
| `FINISHER` | finishing, offensive_awareness, kicking_power, heading, set_piece_taking |
| `SPEED` | speed, acceleration, stamina, balance |
| `PASSER` | low_pass, lofted_pass, offensive_awareness, curl, ball_control |
| `DEFENSIVE` | defensive_awareness, tackling, physical_contact, heading, aggression, stamina |
| `POSITION_OPTIMIZED` | perfil do grupo posicional (`POSITION_STAT_PROFILES`), resolvido a partir de `position` |

7 grupos posicionais (`resolvePositionGroup`): `GK`, `CB`, `FB` (LB/RB), `DM` (DMF), `CM`
(CMF/AMF), `WF` (LMF/RMF/LWF/RWF), `CF` (SS/CF). Posição desconhecida lança erro explícito (nunca
corrige silenciosamente — mesma filosofia de `pitch-zone.ts` no tactical-engine).

`roleScore` (0-100) é sempre calculado contra o perfil da posição alvo, **independente da
estratégia escolhida** — é isso que garante `MAX_OVERALL != POSITION_OPTIMIZED` na prática: a
mesma carta pode ganhar mais atributos brutos com `MAX_OVERALL` e ainda assim pontuar pior em
`roleScore` do que com `POSITION_OPTIMIZED`.

Saída: `recommendedAllocation`, `expectedAttributes`, `roleScore`, `explanationData`
(`prioritizedStats`, `topGains`, `engineVersion` — dados estruturados para o AI Coach consumir).

## Comparador — `player-builds` (Tarefa 6)

`POST /player-builds/compare` — entrada `cardId`, `position`, `buildA`/`buildB` (cada um:
`allocation` + `availableProgressionPoints`, já definidos pelo cliente, não gerados aqui).

```
assertPositionCompatible → applyAllocation(A) → applyAllocation(B) → compareAttributes → advantages/disadvantages
```

Validações (`build-comparator.errors.ts`):
- `IncompatiblePositionError` — posição pedida não pertence a nenhuma posição da carta
- `PointsExceededError` — soma da alocação > `availableProgressionPoints`
- `InvalidBuildError` — atributo inexistente na carta, alocação negativa/não-inteira, ou
  alocação que ultrapassa `maxValue`

`overall` de cada build é uma **aproximação própria do CoachPlay**
(`player-build-engine/overall.util.ts`: `overallBase` + média do ganho de atributos, capado em
99) — a Konami não publica a fórmula oficial, então isso nunca é apresentado como o número exato
que o jogo mostraria.

`advantages`/`disadvantages` são frases curtas geradas deterministicamente (nunca por IA) —
comparam overall, roleScore e cada atributo entre B e A. A narrativa mais rica ("a Build CoachPlay
tem overall menor, porém atributos mais adequados à função") é responsabilidade do AI Coach
(Tarefas 10/14), que consome estes fatos prontos e nunca os recalcula.

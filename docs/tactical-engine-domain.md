# Tactical Engine — Linguagem Ubíqua e Domínio Estratégico

**Escopo:** define o vocabulário e as entidades do subdomínio `tactical-engine`. Este documento
é a fonte de verdade para nomes de tipos, campos e conceitos usados no código — qualquer
divergência entre código e este documento deve ser corrigida em um dos dois lugares.

Pré-requisito: ver [`tactical-engine-current-state.md`](tactical-engine-current-state.md) — o
motor descrito aqui é desenvolvido e testado contra estados sintéticos/fixtures; nenhuma fonte
real de posições de jogadores/bola existe hoje no projeto.

---

## 1. Por que "Tactical Engine" (não "Decision Intelligence")

Nome escolhido: **Tactical Engine**. Módulo: `apps/api/src/modules/tactical-engine/`.
Motivo: nomeia o que o módulo *faz* (avalia táticas a partir de um estado de jogo), evitando o
termo genérico "Decision Intelligence" que não diferencia este módulo de qualquer sistema de
decisão de negócio.

---

## 2. Nomenclatura de jogadores — evitar ambiguidade

O projeto já usa `User` para a conta autenticada (Prisma `User` model, com `role`, `email`,
etc. — nada a ver com futebol). O domínio tático precisa de nomes que não colidam com isso:

| Termo | Significado |
|---|---|
| `User` (já existe, `@prisma/client`) | Conta autenticada no Coach Play — dono da partida, nunca um jogador de futebol dentro do jogo. |
| `ControlledPlayer` | O jogador virtual (dentro do EA FC) que o usuário está controlando/comanda no instante do snapshot. Pode ser `undefined` quando não identificável com confiança. |
| `VirtualPlayer` | Qualquer jogador virtual em campo, do time do usuário ou adversário — termo genérico usado nas interfaces de baixo nível (`TacticalPlayer`, ver Tarefa 5). |
| `OpponentPlayer` | Jogador virtual do time adversário — usado quando o código precisa diferenciar claramente de `ControlledPlayer`/time do usuário. |

Regra: nenhum tipo do `tactical-engine` deve usar `Player` sozinho sem qualificador — sempre
`ControlledPlayer` / `VirtualPlayer` / `OpponentPlayer`, para que um leitor nunca precise
adivinhar se é o humano (`User`) ou uma entidade virtual em campo.

---

## 3. Entidades e conceitos

Cada entidade abaixo é um **tipo TypeScript determinístico** (sem IA generativa envolvida no
cálculo) até a fronteira com `ai-coach`, onde dados estruturados viram texto (ver seção 6).

### `PitchCoordinate`
- **Responsabilidade:** posição normalizada e independente de resolução de vídeo.
- **Atributos:** `x: number` (0.0–1.0, esquerda→direita do ponto de vista do time do usuário),
  `y: number` (0.0–1.0, fundo da própria defesa→fundo do ataque).
- **Regras:** valores fora de `[0, 1]` são inválidos — quem produz a coordenada (o futuro
  `TacticalStateProvider`) é responsável por normalizar/clampar antes de entregar ao motor; o
  motor não corrige silenciosamente coordenadas fora de faixa (falha explícita, ver Tarefa 3).
- **Limites:** não representa altura (eixo Z) — bola no ar e bola no chão são a mesma coordenada
  no MVP.

### `PitchZone`
- **Responsabilidade:** classificação categórica de uma `PitchCoordinate` em uma região do campo.
- **Atributos:** combinação de terço (`DEFENSIVE_THIRD` / `MIDDLE_THIRD` / `ATTACKING_THIRD`) e
  corredor (`LEFT_CHANNEL` / `LEFT_HALF_SPACE` / `CENTRAL_CHANNEL` / `RIGHT_HALF_SPACE` /
  `RIGHT_CHANNEL`) — 15 zonas possíveis.
- **Relações:** derivada de `PitchCoordinate` via função pura `getPitchZone()` (Tarefa 3) —
  nunca armazenada de forma independente da coordenada que a gerou.
- **Regras:** terços e corredores são sempre relativos ao **ataque do time do usuário** (ver
  `PossessionState`/inversão de lado, Tarefa 3) — a mesma jogada vista pelo adversário teria
  zonas espelhadas.

### `PlayerPosition`
- **Responsabilidade:** liga um `VirtualPlayer` a uma `PitchCoordinate` em um instante.
- **Atributos:** `trackingId`, `team` (`'user' | 'opponent'`), `position: PitchCoordinate`,
  `role?: string` (posição tática, ex. `'CB'`, `'ST'` — opcional, MVP não exige identificação
  nominal do atleta), `confidence: number`.
- **Limites:** `trackingId` é um identificador de rastreamento **por sessão/partida**, não uma
  identidade persistente de atleta entre partidas (fora de escopo — ver Tarefa 40, "não
  implementar reconhecimento de atletas reais").

### `BallPosition`
- **Responsabilidade:** posição da bola em um instante.
- **Atributos:** `position: PitchCoordinate | null` (`null` quando não localizável com confiança
  suficiente — nunca inferida/inventada), `confidence: number`.

### `PossessionState`
- **Responsabilidade:** quem controla a bola no instante do snapshot.
- **Valores:** `'user' | 'opponent' | 'contested' | 'unknown'`.
- **Regras:** `'unknown'` é um valor de primeira classe, não um caso de erro — qualquer avaliação
  tática que dependa de posse deve se recusar a concluir (ver Tarefa 30, anti-falso-positivo)
  quando `possession === 'unknown'`.

### `DecisionContext`
- **Responsabilidade:** o "instante de decisão" — um `TacticalGameState` (Tarefa 5) mais o
  `ControlledPlayer` identificado como portador da bola, servindo de entrada para geração de
  `TacticalAction`s candidatas.
- **Atributos:** `gameState: TacticalGameState`, `ballCarrierId: string`.
- **Regras:** só existe quando `possession === 'user'` e o portador é identificável — caso
  contrário não há decisão do usuário a avaliar.

### `PlayerDecision`
- **Responsabilidade:** a ação que o `ControlledPlayer` de fato executou, inferida a partir da
  transição entre dois `TacticalGameState` consecutivos (não observada diretamente — ver
  limitação na seção 2 de `tactical-engine-current-state.md`).
- **Atributos:** `action: TacticalAction`, `confidence: number`.
- **Regras:** se a ação real não puder ser inferida com confiança suficiente, não existe
  `PlayerDecision` para aquele instante — nenhuma avaliação é gerada (Tarefa 15/30).

### `AlternativeAction`
- **Responsabilidade:** uma `TacticalAction` candidata que o `ControlledPlayer` **não** escolheu,
  gerada pelo `ActionGenerator` (Tarefa 12) a partir do mesmo `DecisionContext`.
- **Atributos:** igual a `TacticalAction` — a distinção entre "real" e "alternativa" é posicional
  (qual campo do `DecisionEvaluation` a referencia), não um tipo próprio.

### `DecisionEvaluation`
- **Responsabilidade:** compara a decisão real com a melhor alternativa disponível.
- **Atributos:** `actualAction`, `actualScore: DecisionScore`, `bestAlternative?`,
  `bestAlternativeScore?: DecisionScore`, `scoreDifference: number`,
  `classification: DecisionClassification`.
- **Regras:** ver Tarefa 15 — sem confiança suficiente na ação real, não gerar avaliação
  conclusiva (o campo `bestAlternative` pode existir mesmo sem `actualAction` confiável, mas
  nesse caso `classification` não deve ser emitida como fato).

### `DecisionScore`
- **Responsabilidade:** nota 0–100 de uma `TacticalAction`, decomposta em 6 componentes
  ponderados (ver `docs/tactical-engine-scoring.md`, Tarefa 38, para a fórmula completa).
- **Atributos:** `total`, `possessionSafety`, `progression`, `spaceCreation`,
  `defensiveBalance`, `futureOptions`, `pressureManagement` — todos 0–100.
- **Regras:** pesos vivem em configuração central versionada (Tarefa 13), nunca espalhados pelo
  código.

### `PassingLane`
- **Responsabilidade:** avaliação geométrica de uma linha de passe candidata entre dois
  `VirtualPlayer` do mesmo time.
- **Atributos:** `fromPlayerId`, `toPlayerId`, `distance`, `obstructionRisk`, `pressureRisk`,
  `progressionValue`, `score`.
- **Regras:** puramente geométrico e determinístico (Tarefa 7) — nunca usa IA generativa.

### `PressureState`
- **Responsabilidade:** classificação da pressão adversária sobre o portador da bola.
- **Atributos:** `level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'`, `nearestOpponentDistance`,
  `opponentsWithinRadius`, `score`.

### `SpaceRegion`
- **Responsabilidade:** célula de um grid do campo com indicadores de ocupação/espaço livre.
- **Atributos:** `zone: PitchZone`, `occupation`, `pressure`, `freeSpace`, `goalProximity`.

### `NumericalAdvantage`
- **Responsabilidade:** comparação de jogadores de cada time em uma `PitchZone`.
- **Atributos:** `zone`, `userPlayers: number`, `opponentPlayers: number`, `difference: number`,
  `advantage: 'user' | 'opponent' | 'neutral'`.

### `DefensiveBalance`
- **Responsabilidade:** risco deixado atrás da bola pelo time do usuário.
- **Atributos:** score consolidado 0–100 (`DefensiveSafetyScore`) + indicadores que o compõem
  (jogadores atrás da bola, cobertura central, largura defensiva, adversários livres).

### `TacticalSequence`
- **Responsabilidade:** cadeia de `DecisionEvaluation`/`TacticalGameState` consecutivos que forma
  um padrão reconhecível (ex. "circulação sob pressão", "mudança de corredor").
- **Regras:** só sequências relevantes são persistidas (Tarefa 17) — não é 1:1 com snapshots.

### `TacticalPattern`
- **Responsabilidade:** recorrência de um mesmo tipo de decisão/erro através de múltiplas
  partidas do mesmo usuário.
- **Atributos:** `pattern`, `frequency`, `confidence`, `severity`, `firstDetectedAt`,
  `lastDetectedAt`.
- **Nota:** já existe uma referência a `TacticalPattern` na tabela de módulos do `AGENT.md`
  (linha do `game-analysis`, listada como entidade principal) — hoje **não implementada em
  lugar nenhum do código** (busca confirma zero ocorrências fora da própria linha do
  `AGENT.md`). O `tactical-engine` passa a ser o dono real deste conceito; `AGENT.md` deve ser
  atualizado quando a Tarefa 21 for implementada, para apontar para o módulo correto.

---

## 4. O que este domínio explicitamente não cobre (ver Tarefa 40)

Reconhecimento de atletas reais, simulação física do jogo, busca combinatória profunda, RL,
modelo de visão próprio, leitura de memória/protocolo do EA FC, automação de controle. Ver seção
correspondente no prompt original — reafirmado aqui como parte do domínio (o que o domínio
**não** modela é tão parte da linguagem ubíqua quanto o que modela).

---

## 5. Fronteira com módulos existentes

O `tactical-engine` **não** importa nada de `game-analysis` ou `capture-sessions` diretamente —
consome exclusivamente `TacticalGameState` (Tarefa 5) através de uma interface
`TacticalStateProvider` (Tarefa 39, adiantada aqui como decisão de fronteira, não só como
tarefa futura). Isso é decisão herdada do achado da auditoria (seção 2 do documento de estado
atual): hoje não há implementação real desse provider — só fixtures de teste.

O `tactical-engine` **nunca** chama `@anthropic-ai/sdk`/`openai` diretamente — produção de texto
fica inteiramente em `ai-coach`, que consome as saídas estruturadas do motor (`DecisionEvaluation`,
`DecisionScore`, princípios identificados) como entrada de prompt.

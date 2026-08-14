# Tactical Engine — Estado Atual da Arquitetura (Auditoria)

**Data:** 2026-08-13
**Escopo:** Levantamento pré-implementação do Tactical Engine / Decision Intelligence.
**Este documento não altera comportamento da aplicação.**

---

## 1. Arquitetura atual

Coach Play é um monolito modular NestJS (`apps/api`) + Next.js (`apps/web`), com dois
capturadores de tela adicionais (`apps/desktop` Electron e `apps/extension` Chrome MV3). Módulos
relevantes para este levantamento:

```
apps/api/src/modules/
├── matches/            Match, MatchVideo — CRUD + upload de vídeo
├── video-capture/      FFmpeg (extração de frames) + fila BullMQ "video-processing"
├── game-analysis/      GameAnalysisService.analyzeMatch() — ver seção 2
├── capture-sessions/   Captura em tempo real (Remote Play) — ver seção 3
├── ai-coach/           AiCoachService — Claude → GPT-4o → DeepSeek (cascata)
└── reports/            ReportsService — agrega DetectedError em scores 0–10
```

Dois pipelines de análise **completamente separados** existem hoje:

### Pipeline A — Análise pós-jogo (upload de vídeo)

```
Upload de vídeo (matches.service.ts)
  → fila "video-processing" (video-processing.worker.ts)
  → FFmpeg extrai 1 frame a cada 30s (video-capture.service.ts)
  → GameAnalysisService.analyzeMatch(matchId, framePaths)
  → AiCoachService.analyzeMatch(matchId)
  → ReportsService.generateReport(matchId)
  → match.status = 'analyzed'
```

### Pipeline B — Captura em tempo real (Remote Play, Fase 2)

```
apps/desktop | apps/extension  → captura tela → POST /capture-sessions/:id/frames
  → fila "capture-frame-analysis" (capture-frame-analysis.worker.ts)
  → GameStateDetectorService.detect() — diff de pixels frame atual × anterior
  → EventDetectorService.detectCandidate() — pico de motion após atividade sustentada
  → GameEvent persistido (se confiança ≥ EVENT_MIN_CONFIDENCE)
  → AiCoachService.generateEventFeedback() (se confiança ≥ FEEDBACK_MIN_CONFIDENCE)
  → CoachFeedback persistido
```

`ai-coach` é o único módulo que fala com IA generativa (Claude/GPT-4o/DeepSeek, cascata com
fallback). Ele nunca calcula nada geométrico ou tático — só recebe texto já pronto
(`GameEvent`/`DetectedError`) e devolve texto.

`reports` não calcula nada tático — soma penalidades por severidade de `DetectedError`,
agrupadas em 4 baldes fixos (`ATTACK_CATS`/`DEFENSE_CATS`/`PASSING_CATS`/`DECISION_CATS`) definidos
por `category` string, e converte em nota 0–10 por uma fórmula linear fixa em código
(`calculateScores`, sem configuração externa).

---

## 2. Achado crítico — `game-analysis` é 100% sintético, não há visão computacional

`GameAnalysisService.analyzeMatch()` (`apps/api/src/modules/game-analysis/game-analysis.service.ts`)
**não analisa o conteúdo dos frames**. O próprio código documenta isso:

```ts
/**
 * TODO (Task 4.4): substituir lógica de detecção por análise multimodal
 *                  via Claude Sonnet 4.6 (frames enviados como imagens).
 */
```

O que ele faz hoje, de fato:
- Categoria do evento = função determinística da **posição do frame na lista** (`index / total`),
  distribuída por faixas fixas de progresso (`PHASE_CATEGORIES`) — não olha o conteúdo da imagem.
- Erro = 1 a cada 3 "eventos de risco" (categorias `defesa`/`decisao`/`posicionamento`), severidade
  cíclica `low → medium → high → low...` — não há avaliação real do que aconteceu na jogada.
- `confidence: 0.5` fixo em todo evento gerado por este caminho (não é uma medição, é uma constante).

Ou seja: **não existe, em nenhum lugar do código, extração de posição de jogadores, posição da
bola, posse, ou qualquer estado espacial da partida.** O pipeline de upload gera dados
tática-e-visualmente arbitrários só para exercitar o fluxo de ponta a ponta (fila → análise →
IA → relatório).

O pipeline de captura em tempo real (Pipeline B, `capture-sessions`) é mais honesto sobre suas
limitações — o comentário em `game-state-detector.service.ts` é explícito: *"Não há reconhecimento
de HUD/cores específicas do EA FC"* — mas também não vai além de diff de pixels agregado (motion
score escalar por frame). Ele **não localiza bola, jogadores nem zonas do campo**; só classifica
`menu` vs `match_running` e detecta "pico de movimento" sem nenhuma semântica sobre o que mudou.

**Consequência direta para o Tactical Engine:** hoje não existe nenhuma fonte de dados real capaz
de alimentar um `TacticalGameState` (posições normalizadas de bola/jogadores, posse, etc.) como
descrito no domínio pretendido. Qualquer implementação do motor precisa ser desenvolvida e testada
contra **estados sintéticos/fixtures**, com o consumo de dados reais isolado atrás de uma interface
(`TacticalStateProvider`, Tarefa 39 do prompt original) que hoje não tem nenhuma implementação
real por trás — só poderá ser preenchida quando (e se) um pipeline de tracking visual for
construído. Isso não é um bloqueio para o MVP determinístico do motor (scoring geométrico sobre
`TacticalGameState` já é testável com fixtures), mas é um bloqueio real para "ver o motor
funcionando com uma partida real" — isso depende de um projeto de visão computacional que não
existe hoje e está fora do escopo das primeiras fases.

---

## 3. Como frames, timestamps e eventos são armazenados hoje

| Conceito | Pipeline A (upload) | Pipeline B (captura tempo real) |
|---|---|---|
| Frame | Arquivo `.jpg` em disco (`UPLOAD_DIR/frames/<matchId>/`), **apagado após análise** (`cleanFrames`) | `FrameSample` (Prisma) — persiste `framePath`, `timestampMs`, `motionScore`, `gameState`, `confidenceScore` |
| Unidade de timestamp | **Segundos** (`GameEvent.timestampStart`, quando `captureSessionId == null`) | **Milissegundos** (`GameEvent.timestampStart`, quando `captureSessionId != null`) |
| Evento | `GameEvent` (1 por frame, categoria sintética) | `GameEvent` (só quando `EventDetectorService` acha um "pico", `eventType: 'motion_spike'`) |
| Erro | `DetectedError` — 1 a cada 3 eventos de risco (sintético) | Não gerado — Pipeline B não cria `DetectedError`, só `CoachFeedback` |
| Confiança | Constante `0.5` em todo evento | Calculada (`GameStateDetectorService`/`EventDetectorService`), 0.35–0.95 |

**Risco importante já documentado no schema:** a coluna `game_events.timestamp_start` guarda
unidades diferentes (segundos vs. milissegundos) dependendo da origem, sem flag por linha — só
inferível por `captureSessionId` ser nulo ou não. Qualquer novo código que leia `GameEvent`
(inclusive o Tactical Engine, se vier a consumir eventos existentes) precisa respeitar essa
distinção. Recomendação: o novo módulo não deve depender de `GameEvent.timestampStart` como fonte
de tempo — deve usar seu próprio campo explícito (`timestampMs`) desde o primeiro schema novo.

Frames do Pipeline A são efêmeros (apagados por `cleanFrames` após a análise) — não há como, hoje,
reprocessar um vídeo já analisado sem repetir a extração. Frames do Pipeline B persistem em
`FrameSample`, mas sem uma política de retenção/expurgo (aviso explícito na Tarefa 6 do prompt
original é pertinente: evitar crescimento ilimitado de `tactical_snapshots`).

---

## 4. Pontos de integração viáveis para o Tactical Engine

| De | Para | Como |
|---|---|---|
| `game-analysis` (Pipeline A) ou `capture-frame-analysis.worker` (Pipeline B) | `tactical-engine` | Ponto de entrada natural: onde hoje eventos sintéticos/heurísticos são gerados, o novo módulo poderia receber um `TacticalGameState` (quando existir uma fonte real) e devolver `DecisionEvaluation`. Não deve ser injetado nesses fluxos ainda — ver Tarefa 35 (feature flag) e riscos abaixo. |
| `tactical-engine` | `ai-coach` | `AiCoachService` já tem o padrão certo para isso: métodos dedicados por tipo de entrada (`analyzeMatch` para pós-jogo, `generateEventFeedback` para tempo real) com prompts especializados. Um terceiro método (`explainDecision(evaluation: DecisionEvaluation)`) seguiria o mesmo padrão sem alterar os dois existentes. |
| `tactical-engine` | `reports` | `ReportsService.persistReport` já calcula scores a partir de `DetectedError[]`; poderia futuramente incorporar `decisionScore` agregado do Tactical Engine sem quebrar a assinatura pública (`MatchReport` já tem a coluna `decisionScore`, hoje calculada só a partir de erros sintéticos de categoria `decisao`/`posicionamento`). |
| `capture-sessions` | `tactical-engine` | Fonte mais promissora de "instante da partida" (`FrameSample.timestampMs` já existe, na unidade certa) — mas hoje carrega só `motionScore` escalar, não posições. |
| `matches` | `tactical-engine` | `Match.id` é a chave de particionamento natural para `tactical_snapshots.match_id`, seguindo o mesmo padrão de índice (`user_id`, `match_id`, `status`, `created_at`) já obrigatório no projeto (`AGENT.md`). |

---

## 5. Riscos técnicos

1. **Maior risco: expectativa vs. realidade dos dados.** O prompt de especificação do Tactical
   Engine assume implicitamente que existe (ou existirá em breve) um `TacticalGameState` com
   posições reais de bola e jogadores. Hoje isso não existe. Construir 40 tarefas de motor tático
   sem deixar essa lacuna explícita arrisca produzir um sistema elegante que nunca roda contra
   dados reais. Mitigação: desenvolver o motor inteiro (Fases 1–4 do prompt) contra fixtures
   determinísticas (Tarefa 34), com o `TacticalStateProvider` (Tarefa 39) como única costura para
   uma futura fonte real — nunca acoplar o motor a nenhum detalhe do pipeline de captura atual.

2. **Inconsistência de unidade de tempo em `GameEvent.timestampStart`** (seg. 3) — se o Tactical
   Engine vier a correlacionar seus snapshots com `GameEvent` existentes, precisa tratar as duas
   unidades explicitamente ou (preferível) não depender de `GameEvent` para tempo.

3. **Volume de dados.** `tactical_snapshots`/`tactical_players` (Tarefa 6) armazenados por partida,
   a uma cadência de amostragem alta, podem crescer rápido — o projeto já roda em VPS
   compartilhada (não dedicada, ver `docs/CURRENT_STATE.md`) com backup via `pg_dump` simples
   (`deploy/backup/backup-postgres.sh`). Sem uma estratégia de retenção/agregação desde o início,
   o backup e o Postgres da VPS sofrem primeiro.

4. **`ai-coach` já é o módulo mais caro do sistema** (chaves de IA, custo por chamada — marcado como
   arquivo de risco no `AGENT.md`). Qualquer novo consumo de IA generativa pelo Tactical Engine deve
   reusar o padrão de cascata + custo estimado já existente, nunca introduzir uma chamada de IA para
   cálculo de score (o prompt original já proíbe isso explicitamente — Tarefa 23).

5. **Nenhum módulo hoje segue de fato a estrutura Clean Architecture descrita em**
   `docs/ARCHITECTURE.md` **(`domain/application/infrastructure/presentation/published-language`)** —
   na prática, todo módulo é `*.controller.ts` + `*.service.ts` + `*.module.ts` + `dto/` flat, sem
   as subpastas documentadas. Se o Tactical Engine for o primeiro módulo a seguir a estrutura em
   camadas pedida pela Tarefa 4 do prompt original, ele ficará estruturalmente inconsistente com o
   resto do código (mais rigoroso do que os módulos vizinhos) — decisão de trade-off explícita a
   confirmar com o usuário antes da Tarefa 4 (ver seção 6).

6. **Duplicação de responsabilidade com `reports`.** `ReportsService.calculateScores` já produz um
   `decisionScore` (0–10) a partir de erros sintéticos. O novo `DecisionScore` (0–100) do Tactical
   Engine é conceitualmente diferente (por decisão individual, não por partida) mas semanticamente
   parecido o bastante para confundir o usuário final se as duas notas aparecerem juntas sem
   diferenciação clara na UI/relatório.

---

## 6. Dependências

- **Prisma/PostgreSQL** — novas tabelas (`tactical_snapshots`, `tactical_players`, e demais das
  Tarefas 6/16/17/21/22) seguem o padrão já estabelecido (índices em `match_id`, `created_at`,
  soft delete não aplicável a dados derivados/analíticos — mas retenção/expurgo, sim).
- **Nenhuma nova dependência de infraestrutura é necessária para as Fases 1–4** (domínio,
  geometria, scoring) — é lógica determinística pura em TypeScript, sem novas libs.
- **BullMQ/Redis** — reutilizável se o Tactical Engine vier a rodar como consumidor assíncrono
  (ex.: processar snapshot após persistência), seguindo o padrão das filas `video-processing` e
  `capture-frame-analysis` já existentes.
- **`@anthropic-ai/sdk` / `openai`** — reuso indireto, só via `AiCoachService`, nunca uma
  dependência direta do `tactical-engine`.
- **Feature flag (Tarefa 35)** — projeto não tem hoje nenhum mecanismo de feature flag; precisará
  ser criado (ex.: variável de ambiente `TACTICAL_ENGINE_ENABLED` lida via `ConfigService`, já
  usado em todo o resto do projeto — não requer lib nova).

---

## 7. Proposta de implementação (alto nível)

Seguir o prompt original tarefa a tarefa, mas com dois ajustes em relação ao texto literal, para
refletir a realidade encontrada nesta auditoria:

1. **Tratar `TacticalStateProvider` como a fronteira principal desde a Tarefa 5**, não só na
   Tarefa 39 — o motor nunca deve importar nada de `game-analysis`/`capture-sessions` diretamente.
   Isso os desacopla do "achado crítico" da seção 2: o motor pode ficar pronto e testado bem antes
   de qualquer pipeline de visão computacional real existir.
2. **Adotar a estrutura de módulo flat já usada pelos demais módulos** (`*.service.ts` no nível do
   módulo, sem `domain/application/infrastructure/presentation/`), a menos que o usuário prefira
   usar o Tactical Engine como o primeiro módulo a migrar para a estrutura em camadas documentada
   (mas nunca implementada) em `docs/ARCHITECTURE.md`. **Decisão a confirmar com o usuário** antes
   da Tarefa 4.
3. Prosseguir por fases, sempre com testes passando antes de avançar (regra do próprio prompt
   original), começando pela Fase 1 (Tarefas 1–6: já concluída a 1; 2–6 pendentes).

Nenhuma alteração de comportamento foi feita nesta tarefa.

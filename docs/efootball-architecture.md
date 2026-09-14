# Auditoria — Módulo eFootball (Tarefa 1)

> Auditoria pré-implementação do novo domínio eFootball dentro do Coach Play, feita ANTES de
> qualquer alteração de código, seguindo o mesmo padrão já usado em
> [`docs/tactical-engine-current-state.md`](tactical-engine-current-state.md) para o Tactical Engine.
> Fonte: leitura direta do código (`apps/api`, `apps/web`, `apps/desktop`, `apps/extension`,
> `packages/shared`, `apps/api/prisma/schema.prisma`) + `docs/ARCHITECTURE.md` + `docs/CURRENT_STATE.md`.

**Progresso (2026-09-14):** Tarefas 1–8 de 24 concluídas (auditoria, domínio Game, Players/
PlayerCards, pipeline de importação, Player Build Engine, comparador de builds, Player Scanner,
Meus Jogadores).
Documentação técnica de cada módulo em [`docs/efootball/`](efootball/): 
[`data-model.md`](efootball/data-model.md), [`player-build-engine.md`](efootball/player-build-engine.md),
[`player-scanner.md`](efootball/player-scanner.md). Checklist completo em
[`docs/TASKS.md`](TASKS.md#módulo-efootball-em-andamento).

---

## 1. Arquitetura encontrada

### 1.1 Visão geral

Monolito modular (NestJS + Next.js + Prisma + PostgreSQL + Redis/BullMQ), documentado em
[`docs/ARCHITECTURE.md`](ARCHITECTURE.md). Quatro apps no monorepo (`npm workspaces`):

```
apps/api        NestJS — porta 3001, 13 módulos de domínio
apps/web        Next.js 14 (App Router) — porta 3000
apps/desktop    Electron — captura de tela do Xbox Remote Play (app nativo)
apps/extension  Chrome MV3 — captura via tabCapture/offscreen (aba do navegador)
packages/shared apenas 1 tipo compartilhado hoje (AuthUser)
```

**Divergência entre documentação e código real:** `docs/ARCHITECTURE.md` descreve uma estrutura
em camadas (`domain/application/infrastructure/presentation/published-language`) como padrão de
módulo. Nenhum módulo real segue isso — todos (`auth`, `matches`, `ai-coach`, `tactical-engine`
etc.) usam estrutura **flat**: `<module>.module.ts` + `<module>.service.ts` +
`<module>.controller.ts` + `dto/` no mesmo diretório. `docs/CURRENT_STATE.md` já registra essa
divergência como decisão confirmada com o usuário (ver Fase 1 do Tactical Engine). **O módulo
eFootball deve seguir a estrutura flat real, não a documentada.**

### 1.2 Achado crítico — produto hoje é mono-jogo, não multi-jogo

Não existe nenhuma abstração de "jogo" no sistema. `EA FC`/`EA Sports FC` está hardcoded em:

- `apps/api/src/modules/game-analysis/gemini-vision.service.ts` — prompt do Gemini pressupõe EA FC
- `apps/api/src/modules/ai-coach/ai-coach.service.ts` — prompt de narração pressupõe EA FC
- `apps/api/src/modules/capture-sessions/game-state-detector.service.ts` — heurística de estado
- `apps/api/src/modules/tactical-engine/tactical-action.type.ts` — vocabulário de ações
- `apps/web/src/app/layout.tsx`, `.../login/page.tsx`, `apps/web/public/manual.html` — copy de produto
- `apps/desktop/src/renderer/components/ConsentScreen.tsx`, `apps/desktop/README.md`
- `apps/extension/src/popup/popup.ts`
- `AGENT.md` — "Coach Play é uma plataforma SaaS de análise de partidas de EA FC"

No schema, `Match.gameMode` é `String?` livre (não enum) e `Match.platform` é `String` com default
`"xbox"` — não há coluna `game`/`gameId` em nenhuma tabela. Ou seja: o **banco** já é
suficientemente neutro para introduzir um `gameId`, mas o **produto** (prompts de IA, textos de
tela, heurísticas de captura) é 100% EA FC hoje. Isso confirma a necessidade da Tarefa 2
(`GameProvider`), mas também expõe um risco não listado no prompt original: o pipeline de
Match/GameEvent/AI Coach/Tactical Engine existente **não pode ser reaproveitado como está** para
partidas de eFootball sem introduzir a dimensão `game` nesses três pontos (prompts de IA,
heurística de captura, vocabulário tático) — ver seção 4.

### 1.3 Autenticação, usuários, planos, permissões

| Componente | Onde | Padrão |
|---|---|---|
| Auth | `modules/auth` | JWT access (15min) + refresh opaco em cookie httpOnly (7d), argon2, rate-limit, bloqueio após 10 tentativas |
| Guards globais | `shared/guards` (`JwtAuthGuard`, `RolesGuard`) + `ThrottlerGuard` | registrados via `APP_GUARD` em `app.module.ts`, ordem: Throttler → Jwt → Roles |
| `@Public()` / `@Roles()` / `@CurrentUser()` | `shared/decorators` | decorators usados em todos os controllers |
| Usuários | `modules/users` | `UserRole` enum (`admin`/`player_free`/`player_pro`/`player_premium`/`support`), soft delete, `assertCanAccess()` para ownership |
| Planos | `modules/plans` | `Plan`/`Subscription`/`UsageLog`, `AnalysisLimitGuard` (HTTP 402 no limite mensal) |
| Auditoria | `modules/audit-logs` (`@Global`) | `AuditLogsService.log()` best-effort, usado por auth/matches/video-capture |

**100% reaproveitável sem alteração.** Os novos endpoints do módulo eFootball devem usar os mesmos
guards/decorators e o mesmo padrão `assertOwner()`/`assertCanAccess()` já usado em
`MatchesService`/`UsersService` (crítico para a Tarefa 19 — segurança/IDOR).

### 1.4 Banco de dados (Prisma) — estado atual

11 modelos centrais (`User`, `UserPreferences`, `Plan`, `Subscription`, `Match`, `MatchVideo`,
`GameEvent`, `DetectedError`, `AIAnalysis`, `MatchReport`, `UsageLog`) + auditoria/auth
(`AuditLog`, `RefreshToken`, `PasswordResetToken`, `AppSetting`) + captura
(`CaptureSession`, `FrameSample`, `VideoSegment`, `CoachFeedback`) + Tactical Engine
(`TacticalSnapshot`, `TacticalPlayer`, `TacticalPattern`, `TacticalProfile`). Todas as tabelas
usam `cuid()` como PK, `snake_case` via `@map`, e a maioria tem índice em `userId`/`matchId` +
campos de auditoria (`createdAt`/`updatedAt`, `deletedAt` onde há soft delete). Uma migration por
mudança incremental de schema (`prisma/migrations/`), sem squashing.

### 1.5 AI Coach — padrão de cascata de provedores (reaproveitável como padrão de código)

`AiCoachService` (e `GameAnalysisService`/`GeminiVisionService`) já implementam exatamente o
princípio pedido nas Tarefas 10/20 do prompt ("IA explica, motor decide"):

- Nunca decide o resultado — só narra em texto o que um motor determinístico
  (`tactical-engine`, `GameAnalysisService`) já calculou.
- Cascata de fallback entre provedores: Claude Sonnet 4.6 → GPT-4o → DeepSeek → Groq (best-effort,
  retorna `null`/erro controlado se todos falharem — nunca derruba o fluxo).
- Chave de API resolvida por chamada via `SettingsService` (painel admin tem prioridade sobre env
  var) — permite trocar de provedor sem restart.
- `TacticalEngineFeatureFlagService` — feature flag via `ConfigService`, desabilitada por padrão,
  gateia pontos de entrada que ainda não foram validados contra dados reais.

**Este é o padrão a copiar** para `AI Coach` do eFootball (Ask Coach, Coach de Elenco, Economy
Advisor) e para a feature flag do `GameProvider`/eFootball em si (ver seção 5 — riscos).

### 1.6 Tactical Engine — referência de "motor determinístico + IA só explica"

`modules/tactical-engine` é a prova de conceito mais próxima do que as Tarefas 5 (Player Build
Engine), 9 (Squad Builder) e 11 (Economy Advisor) pedem: avaliadores geométricos puros (funções,
não providers Nest, exceto os 3 serviços de persistência) produzindo uma pontuação 0–100 e uma
classificação, consumidos por `AiCoachService.explainDecision()` só para gerar o texto. Direção de
dependência sempre `ai-coach → tactical-engine`, nunca o contrário. **Adotar o mesmo padrão**: os
engines novos (`player-build-engine`, `squad-builder`, `economy-advisor`) devem ser funções puras
determinísticas importadas diretamente, com um único serviço fino de persistência quando
necessário, nunca chamando SDK de IA.

### 1.7 Pipeline de análise de partida (Match → GameEvent → AI Coach → Report)

Fluxo completo em `docs/ARCHITECTURE.md` (seção "Fluxo de análise de partida"). Resumo relevante
para a Tarefa 15 (integração com Match Analysis): upload de vídeo → BullMQ (`video-processing`) →
`GeminiVisionService` (vídeo inteiro → Gemini 2.5 Flash → erros reais com timestamp) → persiste
`GameEvent`/`DetectedError` → fila `ai-analysis` → `AiCoachService` narra → `ReportsModule` gera
`MatchReport`. **Achado da auditoria do Tactical Engine, ainda válido:** não existe detecção real
de posição de jogadores/bola em nenhum lugar do projeto — `GameAnalysisService`/`GeminiVisionService`
funcionam por vídeo completo (sem coordenadas), e `capture-sessions` só faz diff de pixels agregado.
Isso limita o que a Tarefa 15 (recomendação de aula a partir de padrão de erro) pode inferir hoje:
dá para agregar por `DetectedError.category`/`errorType` (já persistidos, já teem volume real), mas
não por posicionamento tático fino — isso segue bloqueado pela mesma lacuna que já bloqueia o
Tactical Engine.

### 1.8 Frontend — padrão de tela e navegação

`apps/web` usa App Router com grupos de rota `(auth)`/`(dashboard)`/`(admin)`, guarda client-side
em cada `layout.tsx` de grupo, `Sidebar` (`components/layout/sidebar.tsx`) com array `NavItem[]`
condicional por `user.role`. Identidade visual "Dark Luxury UI" (`ink`/`gold`/`violet`, Tailwind,
Sora+Inter, glassmorphism) documentada em `docs/ARCHITECTURE.md`. **A Tarefa 18 (menu novo) deve
estender o array `mainNav` existente em `sidebar.tsx`**, não criar um sistema de navegação
paralelo.

### 1.9 Observabilidade e custo de IA

Já existe: `AIAnalysis.costEstimate` calculado a partir de tokens (preço por modelo hardcoded em
`ai-coach.service.ts`), `AuditLog` genérico. **Não existe** hoje: uma tabela dedicada a
log de chamada de IA por provedor/latência (a Tarefa 21 pede `llm_cost`/`llm_latency` como
métrica — atualmente só há custo agregado em `AIAnalysis`, não histórico por chamada).

---

## 2. Componentes reutilizados (sem alteração de contrato)

| Componente existente | Uso no módulo eFootball |
|---|---|
| `JwtAuthGuard`, `RolesGuard`, `ThrottlerGuard`, `@Public`, `@Roles`, `@CurrentUser` | Todos os novos controllers |
| `AuthUser` (`shared/types`), `assertOwner`/`assertCanAccess` (padrão de `MatchesService`) | `UserPlayer`, `UserSquad`, `UserPlayerBuild` (ownership — Tarefa 19) |
| `PrismaService`/`PrismaModule` | Todos os novos módulos |
| `AuditLogsService` (`@Global`) | Scanner, builds, packs (trilha de auditoria) |
| `SettingsService` (chave de IA por painel > env var) | Ask Coach, Coach de Elenco, Economy Advisor |
| Cascata de provedores de `AiCoachService` (Claude→GPT-4o→DeepSeek→Groq, best-effort) | Base para o novo serviço de explicação do eFootball — **não estender o `AiCoachService` atual diretamente** (ele é 100% EA FC hoje); replicar o padrão em um serviço novo, ver seção 4 |
| `TacticalEngineFeatureFlagService` (padrão) | Feature flag `EFOOTBALL_ENABLED`/`GameProvider` ativo |
| `UsageLog`/`PlansService.registerAnalysisUsage` (padrão) | Se builds/scans entrarem em algum limite de plano futuramente |
| `Sidebar`/`NavItem[]`, grupo de rota `(dashboard)`, guarda de layout | Tarefa 18 (frontend) |
| Paleta/tema Dark Luxury UI, componentes `Button`/`Input` próprios | Todas as telas novas |
| Multer + `diskStorage` (`matches.controller.ts`, upload de vídeo) | Base para upload de screenshot do Player Scanner (Tarefa 7) — mesmo padrão de `fileFilter`/limite de tamanho |
| Estrutura de teste (Jest + ts-jest, `rootDir: src`, `testRegex: .spec.ts$`) | Todos os testes novos do backend |

---

## 3. Módulos novos propostos (mapeados às Tarefas 2–17 do prompt)

Todos seguindo a estrutura flat real (`<module>.module.ts`/`.service.ts`/`.controller.ts`/`dto/`),
registrados em `app.module.ts`, mesmo padrão dos 13 módulos existentes.

```
apps/api/src/modules/
├── games/                  (Tarefa 2)  Game, GameProvider, GameVersion, GameDataSource
├── players/                (Tarefa 3)  Player, PlayerCard, busca/filtros
├── efootball-data-provider/(Tarefa 4)  fetch/normalize/validate/version/import
├── player-build-engine/    (Tarefa 5)  motor determinístico (função pura, sem provider de IA)
├── player-builds/          (Tarefa 6)  endpoint de comparação (usa player-build-engine)
├── player-scanner/         (Tarefa 7)  upload + pré-processamento + confidence score
├── user-players/           (Tarefa 8)  UserPlayer/UserPlayerBuild ("Meu Elenco")
├── squad-builder/          (Tarefa 9)  UserSquad/SquadPlayer/Formation (motor determinístico)
├── economy-advisor/        (Tarefa 11) recomendação de pack/Coins (motor determinístico)
├── learning/                (Tarefa 12) LearningPath/Module/Lesson/Exercise/Progress
├── efootball-coach/         (Tarefas 10, 14) Ask Coach + Intent Router + explicações (usa IA, best-effort)
└── recommendation-engine/   (Tarefa 17) nextBestAction (motor determinístico)
```

Observação de nomenclatura: usar prefixo `efootball-` só nos módulos cujo nome genérico colidiria
com conceito futuro multi-jogo (`efootball-data-provider`, `efootball-coach`); os demais
(`games`, `players`, `player-build-engine` etc.) já nascem genéricos por dentro e recebem
`gameId`/`GameProvider` como discriminador — não recebem o nome do jogo no path, conforme
Princípio 3 do prompt ("não inserir lógica de eFootball espalhada").

---

## 4. Novas tabelas (schema) — mapeamento Prisma

Convenção a seguir (igual ao restante do schema): `cuid()`, `snake_case` via `@map`, índices em
toda FK usada em filtro, timestamps padrão. Nomes abaixo já normalizados ao estilo do projeto.

```prisma
// Domínio de jogo (Tarefa 2)
model Game            { id, code (@unique, ex. "EFOOTBALL"), name, active, ... }
model GameVersion      { id, gameId, label, releasedAt, ... }
model GameDataSource    { id, gameId, name, kind, baseUrl?, active, ... }

// Jogadores/cartas (Tarefa 3) — Player = atleta; PlayerCard = versão específica (nunca fundir)
model Player            { id, gameId, externalId, name, normalizedName (@@index p/ busca), nationality, preferredFoot, height, ... }
model PlayerCard        { id, playerId, externalId, cardType, version, overallBase, maxLevel, position, imageUrl, releaseDate, active, dataVersion, source, sourceVersion, validFrom, validUntil, lastVerifiedAt, ... }
model PlayerPosition    { id, playerCardId, position, isPrimary }         // se 1 carta cobre >1 posição
model PlayerStat        { id, playerCardId, statKey, baseValue, maxValue }
model PlayerSkill       { id, playerCardId, skillKey }
model PlayerPlayStyle   { id, playerCardId, playStyleKey, tier? }

// Pipeline de importação (Tarefa 4)
model DataImportRun     { id, gameDataSourceId, sourceVersion, importedAt, checksum, recordCount, status, errorDetail?, ... }
model DataImportChange  { id, dataImportRunId, entityType, entityId, changeType (created/updated/removed), diff (Json), ... }

// Builds (Tarefas 5–6)
model PlayerBuild        { id, playerCardId, strategy, level, position, allocation (Json), computedAttributes (Json), roleScore, engineVersion, createdBy (userId?), ... }
                          // builds "de sistema" (sem userId) vs. builds salvas por um usuário ficam em UserPlayerBuild (Tarefa 8)

// Scanner (Tarefa 7)
model CardScan           { id, userId, imageUrl, status, confidenceScore?, matchedPlayerCardId?, rawExtraction (Json)?, reviewedAt?, ... }

// Elenco do usuário (Tarefa 8)
model UserPlayer         { id, userId, playerCardId, currentLevel, favoritePosition?, userNotes?, ... ; @@unique([userId, playerCardId]) }
model UserPlayerBuild    { id, userPlayerId, strategy, level, position, allocation (Json), computedAttributes (Json), roleScore, isActive, ... }

// Elenco/formação (Tarefa 9)
model Formation           { id, gameId, code (ex. "4-3-3"), name, active }
model FormationPosition   { id, formationId, slot, position, x, y }        // coordenadas normalizadas, mesmo espírito de PitchCoordinate do tactical-engine
model UserSquad            { id, userId, gameId, name, formationId?, isDefault, ... }
model SquadPlayer          { id, userSquadId, userPlayerId, slot?, isStarting, isBench }

// Economia (Tarefa 11) — nunca inventar probabilidade; sem dado verificado → INSUFFICIENT_DATA
model Pack                 { id, gameId, externalId, name, cost, currency (coins/gp), oddsSource?, oddsVerifiedAt?, active, ... }
model PackTargetPlayer      { id, packId, playerCardId, probability? }      // probability nulo se não verificado
model EconomyRecommendation { id, userId, packId, recommendation (RECOMMENDED/NEUTRAL/NOT_RECOMMENDED/INSUFFICIENT_DATA), score?, explanation?, createdAt }

// Academia (Tarefa 12)
model LearningPath          { id, gameId, level (BEGINNER..COMPETITIVE), title, ... }
model LearningModule        { id, learningPathId, title, order }
model Lesson                { id, learningModuleId, title, content, order }
model Exercise              { id, lessonId, prompt, kind, answerKey (Json)? }
model UserLessonProgress    { id, userId, lessonId, status, completedAt?, ... ; @@unique([userId, lessonId]) }
model UserLearningProfile   { userId (@id), level, goals (Json), updatedAt }

// Progresso/recomendação (Tarefas 16–17)
model UserProgressSnapshot  { id, userId, gameId, computedAt, metrics (Json), formulaVersion }
model LearningRecommendation{ id, userId, reason, lessonId?, createdAt, dismissedAt? }
```

Estratégia de `gameId`: em vez de repetir `game = "efootball"` como string solta em cada tabela
(o prompt pede explicitamente para evitar isso), toda tabela de domínio de jogo referencia
`Game.id` via FK — segue o mesmo padrão já usado no schema atual (`Match.userId` → `User`, nunca
uma coluna de tipo texto solta identificando a entidade pai).

**Reuso vs. tabela nova:** `Match`, `GameEvent`, `DetectedError`, `MatchReport`,
`TacticalSnapshot`/`TacticalPlayer` **não precisam de tabela nova** para a Tarefa 15 — já têm
`matchId` e podem ganhar um `gameId` opcional (nullable, migration aditiva) quando o
multi-jogo entrar em produção; enquanto só eFootball existir como segundo jogo sem pipeline de
vídeo próprio (ver seção 5, risco 3), isso pode ficar para uma fase posterior sem bloquear as
Tarefas 2–14.

---

## 5. Novas APIs (visão consolidada por tarefa)

```
GET    /games                                   (Tarefa 2)
GET    /players?query=&position=&cardType=       (Tarefa 3)
GET    /players/:id
GET    /player-cards/:id
POST   /player-builds                            (Tarefa 5)
POST   /player-builds/compare                    (Tarefa 6)
POST   /player-scanner/scan                       (Tarefa 7, multipart)
GET    /user-players                              (Tarefa 8)
POST   /user-players
PATCH  /user-players/:id
DELETE /user-players/:id
GET    /user-squads                               (Tarefa 9)
POST   /user-squads
POST   /user-squads/:id/auto-build
GET    /economy-advisor/evaluate?packId=          (Tarefa 11)
GET    /learning/paths                            (Tarefa 12)
POST   /learning/lessons/:id/complete
POST   /onboarding/efootball                      (Tarefa 13)
POST   /ask-coach                                 (Tarefa 14)
GET    /progress/me                               (Tarefa 16)
GET    /recommendations/next-best-action          (Tarefa 17)
```

Todas atrás de `JwtAuthGuard` (padrão global já existente); leitura de catálogo (`/games`,
`/players`, `/learning/paths`) pode ser `@Public()` ou autenticada dependendo de decisão de
produto — a auditoria não assume isso, fica em aberto para a Tarefa 2.

---

## 6. Riscos identificados

1. **Fonte de dados do eFootball (Tarefa 4).** O prompt exige nunca inventar atributos/overall/
   custos via IA generativa, e sim uma fonte oficial/validada. O projeto **não tem hoje nenhuma
   integração de dados de jogo externa** — todo dado hoje vem do próprio vídeo do usuário. Definir
   a fonte concreta (scraping de um site específico, dataset comunitário, entrada manual
   curada) é uma decisão de produto/legal que bloqueia a Tarefa 4 e, por consequência, as Tarefas
   3, 5–11. Risco de ToS/licenciamento se a fonte escolhida for scraping de um site que proíbe.
2. **Prompts de IA hardcoded para EA FC (seção 1.2).** `AiCoachService`, `GeminiVisionService`,
   `game-state-detector.service.ts` e `tactical-action.type.ts` pressupõem EA FC. Nenhuma Tarefa do
   prompt pede migrar esse pipeline para eFootball — o novo módulo (Ask Coach, Coach de Elenco)
   deve ser **aditivo e isolado**, sem tocar nesses arquivos, até uma decisão explícita de
   suportar análise de vídeo de partidas de eFootball (fora do escopo das 24 tarefas atuais, que
   cobrem elenco/build/economia/aprendizado, não visão computacional de eFootball).
3. **Tarefa 15 (integração com Match Analysis) depende de dados que já faltam hoje.** Conforme
   seção 1.7, não existe detecção de posição de jogador/bola em produção — só agregação por
   categoria de erro é viável agora com dados reais; correlação fina tipo "zagueiro sai de posição
   com frequência" continua bloqueada pela mesma lacuna documentada em
   `docs/tactical-engine-current-state.md`.
4. **`test:e2e` está quebrado por ausência de configuração, não é regressão desta auditoria.**
   `apps/api/package.json` define `"test:e2e": "jest --config ./test/jest-e2e.json"`, mas o
   diretório `apps/api/test/` nunca existiu no repositório (confirmado: `git log` sem histórico
   para o caminho). Ou seja, o critério de aceite da Tarefa 1 ("todos os testes existentes
   continuam passando") não pode incluir `test:e2e` porque ele nunca funcionou — ver resultado na
   seção 7. Recomendação: não tratar isso como bloqueio; se algum teste e2e for necessário para o
   módulo eFootball, criar `apps/api/test/jest-e2e.json` do zero (não há nada para regredir).
5. **Player Scanner (Tarefa 7) é o único ponto do módulo que processa imagem enviada pelo
   usuário.** Mesmo padrão de risco já mitigado no upload de vídeo (`multer` + `fileFilter` +
   limite de tamanho, Tarefa 3.2 do MVP original) — reaproveitar, não reinventar. Adicionar aos
   testes de segurança da Tarefa 19 (upload malicioso, MIME inválido, nome de arquivo malicioso),
   já é um padrão coberto pela Tarefa 7.3 histórica (ver `docs/CURRENT_STATE.md`).
6. **Escopo dos 24 tarefas é grande o suficiente para justificar migrations incrementais, não uma
   única migration monolítica.** Seguir o padrão do projeto (uma migration por Tarefa/conjunto de
   tabelas relacionado, nunca squash) evita repetir o gap encontrado na Fase 7 original ("não
   existiam migrations do Prisma" — bug de deploy documentado em `docs/CURRENT_STATE.md`).
7. **Ausência de observabilidade por chamada de IA (seção 1.9)** é pré-existente, mas a Tarefa 21
   pede explicitamente `llm_cost`/`llm_latency` por feature — vai exigir uma tabela nova
   (`AiCallLog` ou similar) que hoje não existe; não é regressão, é gap novo a preencher.

---

## 7. Dependências entre tarefas (ordem real, não apenas a ordem do prompt)

O prompt já define execução estritamente sequencial (Tarefa 1 → 2 → 3 ...). Esta seção documenta
**por que** essa ordem é a correta do ponto de vista de dependência técnica, e onde há folga:

```
Tarefa 2 (GameProvider)         bloqueia TODAS as demais — toda tabela nova referencia Game.id
Tarefa 3 (Players/PlayerCard)   bloqueia 5, 6, 7, 8, 9, 11 (todas referenciam PlayerCard)
Tarefa 4 (Data pipeline)        bloqueia 3 em produção (schema pode existir, dado real não)
Tarefa 5 (Build Engine)         bloqueia 6 (compare usa o engine) e 8 (UserPlayerBuild usa o engine)
Tarefa 7 (Scanner)              independente de 5/6 — só depende de 3 (busca por PlayerCard)
Tarefa 8 (Meu Elenco)           bloqueia 9 (Squad Builder lê UserPlayer)
Tarefa 9 (Squad Builder)        bloqueia 10 (Coach de Elenco explica o resultado do engine)
Tarefa 11 (Economy Advisor)     depende de 8/9 (teamNeedScore) — independente de 12+
Tarefa 12 (Academia)            independente de 3–11 (conteúdo próprio) — mas 15 e 17 a usam
Tarefa 13 (Onboarding)          depende de 12 (aponta trilha inicial)
Tarefa 14 (Ask Coach)           depende de 3, 5, 9, 11, 12 (Intent Router chama cada um)
Tarefa 15 (Match Analysis)      depende de 12 (recomenda aula) — bloqueada em parte, ver risco 3
Tarefa 16/17 (Progresso/Reco)   dependem de tudo anterior (agregam dados de todos os engines)
Tarefa 18 (Frontend)            pode começar em paralelo desde a Tarefa 2 (telas vazias) mas cada
                                  tela real depende do backend correspondente
Tarefa 19 (Segurança)           transversal — aplicar em cada tarefa, não só ao final
Tarefa 20 (Custo de IA)         transversal — todo ponto que chama IA (10, 14) já nasce seguindo o
                                  padrão da seção 1.5
```

Confirma que a ordem prescrita no prompt (1→24) já respeita essas dependências; a única folga real
é a Tarefa 18 (frontend), que pode ter scaffolding (menu, rotas vazias) adiantado sem violar "não
executar várias tarefas simultaneamente", desde que nenhuma tela real seja implementada antes do
backend que ela consome.

---

## 8. Resultado dos testes de baseline (antes de qualquer alteração)

Comandos executados nesta ordem, no estado atual do repositório (branch `main`, working tree com
1 alteração pré-existente e não relacionada em `.vscode/settings.json`):

| Comando | Resultado |
|---|---|
| `npm run build:api` | ✅ PASS — `prisma generate` + `nest build` sem erros |
| `npm run build:web` | ✅ PASS — `next build`, 18 rotas, build otimizado sem erros |
| `npm run build:desktop` | ✅ PASS — `tsc` + `esbuild`, bundle gerado |
| `npm run build:extension` | ✅ PASS — `tsc` + `esbuild` (4 bundles) + assets copiados |
| `npm run test:api` | ✅ PASS — **50 suites / 347 testes** |
| `npm run test:desktop` | ✅ PASS — 2 suites / 15 testes |
| `npm run test:extension` | ✅ PASS — 9 suites / 51 testes |
| `npm run test:e2e` | ❌ FAIL — pré-existente, sem relação com esta auditoria (ver risco 4, seção 6): `apps/api/test/jest-e2e.json` nunca existiu no repositório |

Nenhum arquivo de código foi alterado para chegar a este resultado — é o estado real do
repositório antes da Tarefa 2.

---

## Checkpoint

```
TAREFA 1 CONCLUÍDA

Arquivos criados:
- docs/efootball-architecture.md

Arquivos modificados:
- (nenhum)

Testes criados:
- (nenhum — Tarefa 1 é auditoria, sem código novo)

Testes executados:
- npm run build:api / build:web / build:desktop / build:extension
- npm run test:api / test:desktop / test:extension / test:e2e

Resultado:
PASS (build:api, build:web, build:desktop, build:extension, test:api, test:desktop, test:extension)
FAIL (test:e2e — pré-existente, config nunca existiu no repositório, não é regressão)

Cobertura:
- test:api: 50 suites / 347 testes, todos passando
- test:desktop: 2 suites / 15 testes
- test:extension: 9 suites / 51 testes

Problemas encontrados:
- test:e2e sem configuração (apps/api/test/ nunca existiu)
- Produto hoje é mono-jogo: prompts de IA e heurísticas de captura hardcoded para EA FC
- Nenhuma fonte de dados de eFootball integrada ainda (bloqueia Tarefa 4 em produção)

Correções realizadas:
- (nenhuma — fora do escopo da Tarefa 1; problemas documentados para as tarefas correspondentes)

Pode avançar:
SIM
```

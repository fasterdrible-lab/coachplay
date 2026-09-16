# Changelog — Coach Play

## [0.75.0] — 2026-09-15

### Added
- **Base Oficial de Documentação do eFootball — Tarefa 6 (Detector de alterações).**
  - `DocumentChange` (Prisma, migration `20260915220000_add_document_change`) — uma linha por
    mudança detectada entre duas `GameDocumentVersion`, sempre `reviewStatus: PENDING` ao nascer
  - Novo módulo `documentation-diff`: `content-diff.util.ts` (puro, sem I/O) faz diff por LCS —
    primeiro linha-a-linha (cada linha = 1 "seção"), depois palavra-a-palavra dentro de linhas
    pareadas por similaridade — classificando em `TEXT_ADDED`/`TEXT_REMOVED`/`TEXT_MODIFIED`/
    `SECTION_ADDED`/`SECTION_REMOVED`
  - **Todas as fixtures pedidas pela tarefa confirmadas em teste**: nenhuma alteração (zero
    mudanças), uma frase alterada, uma seção removida, nova regra, e a mudança de número exigida
    explicitamente ("5 habilidades" → "6 habilidades" detectada como `TEXT_MODIFIED`)
  - `POST/GET /documentation-diff` — `@Roles('admin')`, disparo manual; nada aprova/rejeita
    automaticamente (isso é ação humana, Tarefa 8)

### Fixed
- **`htmlToPlainText()` (Tarefa 4) não separava elementos de bloco** —
  `sanitizeHtml(html, {allowedTags:[]})` concatenava `<p>A</p><p>B</p>` em `"AB"`, sem nenhum
  separador, o que teria tornado a detecção de seção da Tarefa 6 impossível em conteúdo real.
  Corrigido: quebra de linha inserida após cada elemento de bloco (`p`/`div`/`h1`–`h6`/`li`/`tr`/
  `blockquote`/`section`/`article`) e após `<br>`, antes de remover as tags — cada bloco vira
  exatamente 1 linha. Descoberto e corrigido durante a Tarefa 6, não uma tarefa própria.
  - 20 novos testes (11 `content-diff.util` + 7 `documentation-diff.service` + 2 correção do
    normalizador em `html-sanitizer.util`) — **103 suites / 796 testes na API (era 101 suites /
    776 testes)**

## [0.74.0] — 2026-09-15

### Added
- **Base Oficial de Documentação do eFootball — Tarefa 5 (Versionamento de documentos).**
  - `GameDocumentVersion` (Prisma, migration `20260915210000_add_game_document_version`) —
    histórico **imutável** por documento; `GameDocument` (Tarefa 3) continua guardando só o
    estado atual
  - Novo módulo `game-document-versions` (`GameDocumentVersionsService`) — `recordVersion()` numera
    sequencialmente por `documentId` (`@@unique([documentId, versionNumber])` trava no banco),
    `findAllForDocument()`/`findVersion()` pra consulta
  - `GameDocumentsService.registerDocument()` (Tarefa 3) passa a gravar uma versão automaticamente
    sempre que `changed: true`: v1 com `changeDetected:false` no cadastro inicial, vN+1 com
    `changeDetected:true` a cada alteração real — **documento idêntico (mesmo `contentHash`)
    continua sem gravar versão nova**, confirmado em teste de cenário completo (A → A repetido →
    B → C: histórico final tem exatamente 3 versões, não 4)
  - `GET /game-documents/:id/versions` e `GET /game-documents/:id/versions/:versionNumber` —
    `@Roles('admin')`, 404 explícito tanto pro documento quanto pra versão inexistente
  - 8 novos testes (7 em `game-document-versions.service.spec.ts` + 1 cenário end-to-end em
    `game-documents.service.spec.ts` com Prisma falso stateful, reproduzindo literalmente a
    sequência pedida pela tarefa) — **101 suites / 776 testes na API (era 100 suites / 768
    testes)**

## [0.73.0] — 2026-09-15

### Added
- **Base Oficial de Documentação do eFootball — Tarefa 4 (Coletor de documentação).**
  - Novo módulo `documentation-ingestion`: `DocumentFetcherService` (fetch) + `html-sanitizer.util`
    (sanitize/normalize) + `DocumentationIngestionService` (orquestração), delegando
    hash/comparação/armazenamento inteiramente ao `GameDocumentsService` da Tarefa 3 — sem duplicar
    aquela lógica
  - `DocumentFetcherService`: timeout (`AbortController`), retry limitado só pra falhas
    transitórias (rede/timeout/5xx — nunca 4xx), user-agent configurável, limite de tamanho
    aplicado tanto por `Content-Length` quanto durante o streaming do corpo (nunca confia só no
    header), redirecionamentos seguidos manualmente com **SSRF + allowlist de domínio
    revalidados em cada salto** (não só na URL inicial), limite de redirecionamentos contra loop
  - Reaproveita `checkSourceUrlSafety`/`isDomainAllowed`/`parseAllowedDomains` da Tarefa 2 —
    nenhuma allowlist paralela
  - Sanitização real via `sanitize-html` (parser HTML de verdade, não regex) — pinado em
    `2.12.1` porque a partir da `2.13` a dependência `htmlparser2` virou ESM-only e quebra o
    `ts-jest` do projeto
  - `DocumentationIngestionService.ingest()`: HTML vazio ou que normaliza pra texto vazio lança
    `BadRequestException` explícita antes de tocar o banco — nunca cria um `GameDocument` fantasma
  - **Resultado exigido pela tarefa confirmado em teste**: documento idêntico (mesmo
    `contentHash`) não cria versão desnecessária — `registerDocument()` retorna `changed:false`
  - `POST /documentation-ingestion` — `@Roles('admin')`, disparo manual (agendamento automático é
    a Tarefa 21, fora de escopo aqui)
  - Novas env vars com defaults sensatos: `DOCUMENTATION_FETCH_TIMEOUT_MS`,
    `DOCUMENTATION_FETCH_MAX_RETRIES`, `DOCUMENTATION_FETCH_RETRY_DELAY_MS`,
    `DOCUMENTATION_FETCH_MAX_REDIRECTS`, `DOCUMENTATION_FETCH_MAX_BYTES`,
    `DOCUMENTATION_FETCH_USER_AGENT`
  - 30 novos testes (11 sanitização, 13 fetcher — cobrindo todos os cenários mockados pedidos:
    200/404/500/timeout/redirect/redirect loop/HTML vazio/conteúdo enorme —, 6 orquestração —
    HTML alterado/HTML idêntico entre eles) — **100 suites / 768 testes na API (era 97 suites /
    738 testes)**

## [0.72.0] — 2026-09-15

### Added
- **Base Oficial de Documentação do eFootball — Tarefa 3 (Registro de documentos).**
  - `GameDocument` (Prisma, migration `20260915200000_add_game_document`) — representa o **estado
    atual** de cada documento capturado por `DocumentationSource`; histórico de versões fica para
    a Tarefa 5, propositalmente fora de escopo aqui
  - `registerDocument()` faz **upsert por `(gameId, url)`** em vez de distinguir criar/atualizar
    como operações separadas — o mesmo consumidor (hoje manual; Tarefa 4 em diante, o coletor
    automático) sempre chama o mesmo método; o serviço decide `isNew`/`changed` sozinho
  - `contentHash` (sha256 do `normalizedContent`) **sempre derivado no servidor**, nunca aceito do
    cliente — mesmo princípio do `domain` derivado de `url` na Tarefa 2
  - Reaproveita `DocumentationSourcesService.findOne` da Tarefa 2 e valida que a fonte pertence ao
    mesmo jogo do documento — impede mistura entre jogos
  - `POST`/`GET`/`PATCH /game-documents` — `@Roles('admin')`, mesmo padrão dos módulos anteriores
  - 14 novos testes (`content-hash.util.spec.ts`, `game-documents.service.spec.ts` — documento
    válido, documento duplicado, mesma URL com conteúdo alterado, documento sem source, source de
    outro jogo, tipo inválido, versão nova, jogo inexistente, filtros de `findAll`) — **97 suites
    / 738 testes na API (era 95 suites / 724 testes)**
  - Regressão completa: `tsc --noEmit` limpo, `nest build` limpo, `test:e2e` 8/8 PASS (módulo
    eFootball clássico intacto) — ver `docs/efootball/game-documents.md`

## [0.71.0] — 2026-09-15

### Added
- **Base Oficial de Documentação do eFootball — Tarefa 2 (Modelo de fonte).** Primeiro módulo de
  código do novo prompt (32 tarefas, separado do módulo eFootball de 24 já fechado — ver
  `docs/efootball/documentation-architecture.md`, Tarefa 1).
  - `DocumentationSource` (Prisma, migration `20260915190000_add_documentation_source`) —
    ancorada em `Game.id`; `domain` sempre derivado de `url` no service, nunca aceito direto do
    cliente (fecharia um jeito de burlar o allowlist)
  - `POST`/`GET`/`PATCH /documentation-sources` — `@Roles('admin')`, mesmo padrão de
    `SettingsController`
  - **Núcleo de proteção contra SSRF já nesta tarefa** (não esperando a Tarefa 25, conforme
    recomendado na auditoria): `url-safety.util.ts` bloqueia por design qualquer protocolo que
    não seja `https:`, hosts de loopback, qualquer IPv4 privado/reservado (RFC 1918 + link-local,
    incluindo `169.254.169.254` — alvo clássico de SSRF pra metadata de nuvem) e **qualquer
    literal de IP**, público ou privado — fonte de documentação sempre por nome de domínio
  - **Allowlist de domínio deny-by-default**: `DOCUMENTATION_SOURCE_ALLOWED_DOMAINS` (nova env
    var, `.env.example`) — sem configuração, nenhum domínio é autorizado, mesmo que passe na
    checagem de SSRF. Este código nunca assume/adivinha um domínio real da Konami ou de qualquer
    fonte comunitária (mesmo risco 1 do audit original do módulo eFootball, agora aplicado a
    documentação em vez de carta)
  - `trustLevel: AUTHORITATIVE` exclusivo de `sourceType: OFFICIAL` — `trust-level.util.ts`
    lança erro explícito (nunca corrige silenciosamente) se qualquer outro tipo tentar, seja na
    criação ou numa atualização posterior
  - **Decisão de não-reaproveitamento registrada**: `GameDataSource` (existente, usado pelo
    pipeline de Player/PlayerCard) não foi estendido pra virar `DocumentationSource` — enum
    fechado incompatível, sem os campos exigidos, amarrado a um relacionamento de registros
    estruturados. `GameVersion` (existente, nunca usado) será reaproveitado como `GameRelease`
    quando a Tarefa 13 deste prompt chegar, em vez de duplicar — decisão já registrada na Tarefa 1
  - 42 novos testes (`url-safety.util.spec.ts`, `allowed-domains.util.spec.ts`,
    `trust-level.util.spec.ts`, `documentation-sources.service.spec.ts`) — 95 suites na API
    (era 91/682)

## [0.70.0] — 2026-09-15

### Added
- **Módulo eFootball — Tarefa 24 (Documentação final). Fecha o roadmap original de 24 tarefas
  (24/24 concluídas).** Novo [`docs/efootball/README.md`](../docs/efootball/README.md) — ponto
  de entrada único do módulo, substituindo a necessidade de garimpar 19 documentos técnicos
  espalhados + o audit doc pra entender o estado atual:
  - **Referência de API completa** — todos os ~35 endpoints HTTP do módulo (Tarefas 2–21),
    agrupados por domínio, com método/rota/descrição/rate limit onde se aplica — primeira vez
    que existe uma lista única e definitiva (a "visão consolidada por tarefa" da seção 5 do
    audit doc foi escrita progressivamente ao longo de 24 tarefas e nunca fechada como
    referência limpa)
  - **Mapa dos 19 documentos técnicos** (`docs/efootball/*.md`) — 1 linha por documento, o que
    cada um cobre
  - **Modelo de dados consolidado** — todas as tabelas Prisma novas, por tarefa; confirmação de
    que nenhuma coluna do MVP original (EA FC) foi alterada ou removida (só 3 campos de relação
    inversa aditivos em `model User`, exigidos pelo Prisma para as FKs das tabelas novas)
  - **Limitações conhecidas consolidadas numa tabela única** — antes espalhadas em rodapés de
    "fora de escopo" em 8 documentos diferentes (fonte de dados de jogadores, seed de packs,
    gap de posição/bola, cap de gasto de IA, retenção de `AiCallLog`, cobertura e2e parcial,
    migrations não validadas contra Postgres real, frontend enxuto)
  - **Próximos passos fora do roadmap original** — mesmo padrão de fechamento já usado pelo
    Tactical Engine ao final de suas 39 tarefas: decisões de produto novas, não tarefas já
    planejadas

## [0.69.0] — 2026-09-15

### Notes
- **Módulo eFootball — Tarefa 23 (Regressão).** Nenhuma mudança de código — validação de ponta a
  ponta do monorepo inteiro após as Tarefas 1–22, confirmando "aditivo e isolado" na prática, não
  só na intenção documentada.
  - **Os 4 alvos de build do monorepo, limpos**: `build:api` (`prisma generate` + `nest build`),
    `build:web` (Next 14, lint + `tsc` + 25 rotas geradas), `build:desktop` (Electron,
    `tsc` + esbuild), `build:extension` (Chrome MV3, `tsc` + 4 bundles esbuild)
  - **Os 4 alvos de teste do monorepo, verdes**: `test:api` (91 suites / 682 testes),
    `test:e2e` (1 suite / 8 testes, novo desde a Tarefa 22), `test:desktop` (2 suites / 15
    testes), `test:extension` (9 suites / 51 testes) — **756 testes no total, zero falhas**
  - **Confirmado via `git diff --stat` contra `ai-coach`/`game-analysis`/`capture-sessions`/
    `tactical-engine`/`matches`/`auth`/`plans`/`reports` (backend) e `matches`/`dashboard`/
    `evolution` (frontend) + `apps/desktop`/`apps/extension` inteiros: zero linhas alteradas**
    em qualquer um — nenhuma das 22 tarefas anteriores tocou o pipeline clássico de EA FC ou os
    outros clientes do monorepo, exatamente como `docs/efootball-architecture.md` (risco 2)
    exigia desde a auditoria original
  - **Cadeia de migrations verificada**: 5 migrations novas desta sessão
    (`add_onboarding_completed_at` → `add_user_progress_snapshot` → `add_learning_recommendation`
    → `add_ai_call_log`, mais a já existente `add_learning` como base), timestamps sequenciais
    sem colisão, `prisma generate` validou o schema a cada uma
  - **Limitação que segue sem solução nesta tarefa** (mesma de toda a sessão): sem Docker
    disponível neste ambiente, nenhuma migration foi de fato aplicada contra um Postgres real —
    a validação ficou em `prisma generate` (sintaxe do schema) + os fakes de `PrismaService` nos
    testes (semântica dos services). Ver `docs/efootball/regression.md` pra detalhamento completo

## [0.68.0] — 2026-09-15

### Added / Fixed
- **Módulo eFootball — Tarefa 22 (Testes E2E).** Fecha o risco 4 documentado desde a Tarefa 1 da
  auditoria original (`docs/efootball-architecture.md`): `apps/api/test/` nunca existiu no
  repositório — `npm run test:e2e` sempre falhou por ausência de configuração, não por
  regressão. Criado do zero.
  - `apps/api/test/jest-e2e.json` (padrão do template oficial do Nest CLI)
  - `apps/api/test/efootball-recommendation-flow.e2e-spec.ts` — diferente dos
    `*.controller.integration.spec.ts` já existentes (1 módulo por vez, service inteiro
    mockado), este sobe uma aplicação Nest real encadeando **módulos reais** (`OnboardingModule`
    → `RecommendationsModule`, que importa `ProgressModule`, que importa `LearningModule` +
    `ReportsModule` + `GamesModule` — todos com as classes de serviço verdadeiras, unidas pelo
    container de DI de verdade). Só `PrismaService` (fake em memória fiel ao schema) e
    `ReportsService` (Match Analysis, fora do escopo deste fluxo) são substituídos — prova que a
    fiação real entre módulos funciona, algo que teste unitário com `new XService(...)` não
    verifica
  - 8 passos, todos via HTTP real (`fetch` contra `app.listen(0)`, mesmo padrão de
    `games.controller.integration.spec.ts`): usuário novo → `COMPLETE_ONBOARDING` →
    `POST /onboarding/efootball` → `ADD_PLAYERS` → `BUILD_SQUAD` → `DO_LESSON` (aula real vinda
    da Academia, cross-módulo) → dispensar → confirma `dismissed: true` persistido → conclui a
    aula → confirma `ALL_CAUGHT_UP` com `dismissedAt` limpo automaticamente
  - **Achado ao rodar o primeiro `nest build` depois de `apps/api/test/` passar a existir**:
    sem `tsconfig.build.json`, o build de produção sempre compilou TODO `*.spec.ts` de `src/`
    pra dentro de `dist/` (91 arquivos, confirmado — condição pré-existente desde a Fase 1,
    nunca notada porque `dist/src/main.js` funcionava normalmente apesar do lixo extra); o novo
    `test/*.e2e-spec.ts` teria se somado a isso. Corrigido com `apps/api/tsconfig.build.json`
    (conteúdo padrão do template oficial do Nest CLI — `exclude: ["node_modules", "test", "dist",
    "**/*spec.ts"]`) — `dist/` agora contém só código de produção
  - Validado: `npm run test:e2e` (8/8), suíte unitária completa sem regressão (91 suites/682
    testes), `nest build` limpo (`dist/` sem nenhum `.spec.js`/`.e2e-spec.js`)

## [0.67.0] — 2026-09-15

### Added
- **Módulo eFootball — Tarefa 21 (Observabilidade).** Fecha a lacuna explicitamente deixada em
  aberto pela Tarefa 20: custo calculado e logado por chamada, mas nunca persistido — sem
  histórico consultável. `AiCallLog` (Prisma, migration `20260915180000_add_ai_call_log`) — 1
  linha por chamada a `EfootballCoachService.runCascade()` (Coach de Elenco/Tarefa 10, Coach de
  Build/Tarefa 14), sucesso OU falha total, com `feature`/`provider`/`success`/`costEstimate`/
  `latencyMs`/`errorMessage`/`userId`.
  - Gravação best-effort (mesmo padrão de `AuditLogsService.log()`) — uma falha ao gravar
    `AiCallLog` nunca derruba a resposta ao usuário, só loga um aviso
  - `latencyMs` mede o tempo total da cascata (do prompt pronto até resposta ou desistência), não
    só do provedor vencedor — é o que importa pra performance percebida pelo usuário
  - `explainSquad()`/`explainBuild()` agora recebem `userId` explicitamente (antes não sabiam
    quem fez a chamada) — `SquadBuilderService.explainSquad` e `AskCoachService.handleBuildRecommendation`
    (que ganhou `currentUser` como parâmetro novo) passam `currentUser.id` adiante
  - `GET /admin/efootball-ai-usage` (novo, `@Roles('admin')`) — agregado geral (total de
    chamadas, taxa de falha, custo total, latência média) + quebra por `feature` + as 20 chamadas
    mais recentes. Endpoint separado de `GET /admin/usage` (100% EA FC, `AIAnalysis`/`Match`) —
    nenhuma mudança no endpoint clássico
  - Frontend: nova seção "eFootball — Custo de IA" em `(admin)/admin/usage/page.tsx`, ao lado da
    seção clássica já existente — completa o ciclo observabilidade de ponta a ponta (log →
    persistência → agregação → visibilidade admin)
  - 6 novos testes (`efootball-coach.service.spec.ts` +4, `admin.service.spec.ts` +2, incluindo
    "falha ao gravar AiCallLog nunca derruba a resposta") — 91 suites na API (era 91/676, sem
    suíte nova, só testes a mais)

## [0.66.0] — 2026-09-15

### Added
- **Módulo eFootball — Tarefa 20 (Controle de custo de IA).** `EfootballCoachService`
  (único ponto do módulo que chama IA generativa — Coach de Elenco/Tarefa 10, Coach de
  Build/Tarefa 14) descartava `response.usage` inteiramente: nenhuma chamada de IA do módulo
  eFootball tinha custo calculado, ao contrário do `AiCoachService` clássico
  (`AIAnalysis.costEstimate`, calculado desde a Fase 4 original). Fechado usando exatamente o
  mesmo padrão de preço-por-token já validado em `ai-coach.service.ts` (duplicado, não
  compartilhado — mesmo isolamento entre os dois módulos de IA documentado desde a Tarefa 10).
  - `SquadCoachExplanation`/`BuildCoachExplanation` ganharam `costEstimate: number` (USD) — a
    cascata de provedores (Claude → GPT-4o → DeepSeek → Groq) agora lê `input_tokens`/
    `output_tokens` (Anthropic) ou `prompt_tokens`/`completion_tokens` (SDK `openai`, reusado por
    GPT-4o/DeepSeek/Groq) e calcula o custo só da chamada que teve sucesso — tentativas que
    falharam antes de qualquer resposta nunca são cobradas (mesmo princípio do módulo clássico)
  - `AskCoachAnswer` (Tarefa 14) ganhou `costEstimate: number`, sempre `0` nas 3 intents
    determinísticas (`PLAYER_SEARCH`/`ECONOMY_ADVICE`/`LEARNING_RECOMMENDATION`) e em `UNKNOWN` —
    só `BUILD_RECOMMENDATION`/`SQUAD_ADVICE` podem devolver um valor > 0, herdado da explicação de
    IA quando ela tem sucesso
  - Log estruturado por chamada (`this.logger.log`, custo + contagem de tokens de entrada/saída)
    — visibilidade imediata via log antes de qualquer tabela dedicada existir (essa parte fica
    pra Tarefa 21 — observabilidade, que já estava reservada pra um `AiCallLog`
    `llm_cost`/`llm_latency` por chamada, histórico que este changelog não tenta antecipar)
  - Frontend: `formatAiCost()` (novo, `lib/efootball.ts`) exibido ao lado do `modelUsed` já
    mostrado em `squads/[id]/page.tsx` (Coach de Elenco) e `ask-coach/page.tsx` (chat) — visão
    "controle" no sentido literal: o usuário agora vê o custo estimado de cada resposta de IA
  - 1 novo teste (custo zero quando o provedor não devolve `usage`) + assertions de custo
    adicionadas aos testes existentes de cascata/fallback — 91 suites na API (era 91/675, sem
    suíte nova, só 1 teste a mais)

## [0.65.0] — 2026-09-15

### Added / Fixed
- **Módulo eFootball — Tarefa 19 (Segurança).** Transversal, como já documentado ("aplicar em
  cada tarefa, não só ao final") — auditoria dos 15 módulos das Tarefas 2–18 (controllers, DTOs,
  ownership, upload). Achados e correções:
  - **Sem rate limit dedicado em 3 endpoints caros** (2 chamam IA generativa, 1 é
    CPU-pesado) — mesmo padrão já usado em `POST /matches/:id/video` (Task 7.3, "endpoint caro
    (I/O de disco + fila)"), nunca replicado pro módulo eFootball. Adicionado `@Throttle`:
    `POST /ask-coach` (15/min — Tarefa 14, 2 das 5 intents chamam IA), `GET
    /squad-builder/squads/:id/explain` (10/min — Tarefa 10, sempre chama IA), `POST
    /player-scanner/scan` (10/min — Tarefa 7, sharp + OCR/matching por chamada)
  - **`AskCoachDto.question` sem limite de tamanho** — texto livre do usuário vai direto pro
    prompt de IA em 2 das 5 intents, sem nenhum cap antes disso. Adicionado `@MaxLength(500)`
  - **`gameId` como query param solto (`@Query('gameId') gameId: string`), sem validação, em 2
    lugares** (`GET /squad-builder/formations`, `GET /squad-builder/squads`,
    `GET /economy-advisor/packs`) — omitir o parâmetro fazia o Prisma ignorar o filtro
    (`gameId: undefined`) e devolver dados de TODOS os jogos em vez de rejeitar a requisição. Sem
    impacto real hoje (só existe 1 `Game`), mas vira vazamento de dados entre jogos assim que um
    segundo jogo existir. Corrigido com DTOs dedicados (`GameIdQueryDto`, `ListPacksQueryDto`,
    `@IsNotEmpty()`) — omitir `gameId` agora é HTTP 400
  - **Player Scanner (Tarefa 7) nunca teve teste dedicado pro filtro de upload** — risco 5 já
    apontado na auditoria (`docs/efootball-architecture.md`): "mesmo padrão de risco já mitigado
    no upload de vídeo... reaproveitar, não reinventar". `videoFileFilter` tem
    `video.config.spec.ts` desde a Task 7.2; `imageFileFilter` não tinha equivalente. Novo
    `image.config.spec.ts` — aceita PNG/JPEG/WEBP, rejeita formatos inválidos/perigosos
    (`video/mp4`, `application/pdf`, `text/html`, `image/svg+xml` — SVG pode carregar script
    embutido, `application/octet-stream`)
  - **Auditoria confirmou, sem necessidade de mudança**: ownership (IDOR) já corretamente
    implementado e testado nos 3 únicos recursos do módulo endereçados por id e pertencentes a um
    usuário (`UserPlayer`/Tarefa 8, `UserSquad`/Tarefa 9, `LearningRecommendation`/Tarefa 17 —
    todos com `ForbiddenException` + teste "usuário diferente"); mass-assignment bloqueado
    globalmente (`ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`, já existente
    desde a Fase 1, cobre todos os DTOs novos); nenhuma query SQL crua em módulo nenhum (só
    Prisma parametrizado); upload do Player Scanner usa `memoryStorage()` (nunca grava em disco
    com nome vindo do cliente — estruturalmente imune a path traversal, mais seguro que o upload
    de vídeo baseado em `diskStorage`); nenhuma resposta expõe campo sensível (`passwordHash` ou
    equivalente)
  - 8 novos testes (`image.config.spec.ts`) — 91 suites na API (era 90/667)

## [0.64.0] — 2026-09-15

### Added
- **Módulo eFootball — Tarefa 18 (Frontend).** Telas reais pra todos os 15 engines de backend das
  Tarefas 2–17, seguindo a folga já documentada em `docs/efootball-architecture.md` ("Tarefa 18
  pode começar em paralelo... mas cada tela real depende do backend correspondente" — agora todo
  o backend existe). Escopo combinado com o usuário: fluxo completo, UI funcional/enxuta
  reaproveitando os componentes `Button`/`Input` e o padrão visual Dark Luxury UI já existentes,
  sem investir em polimento visual nesta rodada.
  - `Sidebar` (`components/layout/sidebar.tsx`) ganhou a seção "eFootball" (`efootballNav`) —
    estende o array `mainNav` existente, não um sistema de navegação paralelo, exatamente como
    `docs/efootball-architecture.md` (seção 1.8) instruía
  - **10 rotas novas** em `(dashboard)/efootball/`: `page.tsx` (dashboard — Progresso + Recomendação
    adaptativa + atalhos), `onboarding/`, `academy/` + `academy/[pathId]/` (trilhas e aulas),
    `players/` + `players/[id]/` (Meus Jogadores, busca por nome, Player Scanner via upload,
    Player Build Engine), `squads/` + `squads/[id]/` (Squad Builder + Coach de Elenco),
    `economy/` (Economy Advisor), `ask-coach/` (chat-lite com Ask Coach)
  - **2 gaps de backend encontrados e corrigidos ao construir as telas** (nenhum dos dois muda
    comportamento de nenhuma Tarefa já fechada, só preenche uma lacuna que impedia a tela
    correspondente de existir):
    - `PlayerBuildEngineService.generateBuild()` (Tarefa 5) nunca tinha endpoint HTTP — só
      `POST /player-builds/compare` (Tarefa 6) existia, que compara 2 builds já definidas mas não
      gera nenhuma. Adicionado `POST /player-builds/generate` — pré-visualização pura (não
      persiste nada); o usuário decide se salva via `POST /user-players/:id/builds` (Tarefa 8)
    - Não existia nenhuma leitura de `Pack` (Tarefa 11) — o cliente não tinha como descobrir um
      `packId` válido pra `POST /economy-advisor/evaluate`. Adicionado
      `GET /economy-advisor/packs?gameId=` (leitura simples, sem lógica do motor)
  - 2 novos testes (`player-builds.service.spec.ts`, `economy-advisor.service.spec.ts`) — 90
    suites na API (era 90/665, sem suíte nova, só 2 testes a mais)
  - Validação: `npm run build:web` (Next 14, lint + `tsc` + geração estática das 25 rotas) sem
    erros; servidor de dev subido e as 10 rotas novas testadas via `curl` (todas retornam 307 —
    mesmo redirecionamento de sessão do resto do `(dashboard)`, nenhum erro 500). **Sem Docker
    disponível nesta sessão** (Postgres/Redis não sobem), não foi possível validar as telas
    autenticadas contra dados reais — falta correr o fluxo completo (login → onboarding → adicionar
    jogador → montar elenco → avaliar pack → Ask Coach) num navegador de verdade contra a API viva,
    igual foi feito manualmente em rodadas anteriores (ex.: Capture Sessions, CHANGELOG 0.34.0/0.38.x)

## [0.63.0] — 2026-09-15

### Added
- **Módulo eFootball — Tarefa 17 (Recomendação adaptativa).** `GET /recommendations/next-best-action`
  — cadeia de prioridade 100% determinística (`computeNextBestAction`, `next-best-action.util.ts`)
  que decide a UMA próxima ação mais valiosa pro usuário fazer, reaproveitando sinais de todos os
  engines anteriores em vez de recalculá-los: onboarding pendente (Tarefa 13) → elenco vazio
  (Tarefa 8) → nenhum squad salvo (Tarefa 9) → aula informada pelo Match Analysis (Tarefa 15) →
  próxima aula sequencial da Academia (Tarefa 12) → "em dia".
  - `RecommendationsService` reaproveita `ProgressService.getMyProgress()` (Tarefa 16) pros 3
    primeiros sinais — nunca reconta o que o Progresso já contou — e só consulta a Academia
    (`LearningService.getMatchInformedRecommendation`/`listPaths`/`getPath`) quando as 3
    condições de maior prioridade já estão satisfeitas, evitando consulta cujo resultado a cadeia
    descartaria de qualquer forma
  - `findNextUnlockedLesson` extraído de dentro do `AskCoachService` (Tarefa 14) pro módulo
    `learning` (`next-lesson.util.ts`, agora com `lessonId` no retorno) — reusado por Ask Coach e
    pela Recomendação adaptativa, sem duplicar a lógica de "primeira aula desbloqueada e pendente"
  - `LearningRecommendation` (Prisma, migration `20260915160000_add_learning_recommendation`) —
    1 linha por usuário, sempre sobrescrita quando a ação computada muda; preserva `dismissedAt`
    quando a ação recomendada é a mesma de antes. Ganhou um campo `type` além do esboço original
    de `docs/efootball-architecture.md` (só tinha `reason`/`lessonId`) — mesmo motivo da Tarefa 13
    ter adicionado `onboardingCompletedAt` ao `UserLearningProfile`: torna a linha
    auto-descritiva em vez de exigir comparar texto de `reason`
  - `POST /recommendations/:id/dismiss` (novo, além do único endpoint listado no plano original)
    — marca a recomendação atual como dispensada; a mesma ação computada não volta a aparecer
    "não dispensada" até o estado subjacente realmente mudar (ex.: usuário finalmente adiciona um
    jogador) — a cadeia de prioridade então recalcula uma ação diferente e `dismissedAt` é limpo
  - 19 novos testes (`next-best-action.util.spec.ts`, `recommendations.service.spec.ts`,
    `next-lesson.util.spec.ts`) — 90 suites na API (era 87/646)

## [0.62.0] — 2026-09-15

### Added
- **Módulo eFootball — Tarefa 16 (Progresso).** `GET /progress/me` — agrega, num único snapshot,
  métricas de todos os engines já implementados: Academia (nível, `onboardingCompletedAt` da
  Tarefa 13, aulas concluídas/total e `%` em TODAS as trilhas do jogo, não só a do nível atual),
  Meus Jogadores (jogadores no elenco, favoritos, builds salvas), Squad Builder (elencos salvos),
  Economy Advisor (avaliações feitas, quantas vieram `RECOMMENDED`) e o mesmo resumo de Match
  Analysis já usado na integração da Tarefa 15 (`totalAnalyzed`/`worstCategory`/`avgOverallScore`).
  - `UserProgressSnapshot` (Prisma, migration `20260915140000_add_user_progress_snapshot`) — uma
    linha por `(userId, gameId)`, sempre sobrescrita no cálculo mais recente (mesmo padrão do
    `TacticalProfile`, Tactical Engine Fase 4: sem histórico de snapshots anteriores).
    `formulaVersion` (`PROGRESS_FORMULA_VERSION`) versiona a fórmula de agregação, mesmo padrão
    de `DECISION_SCORE_CONFIG_VERSION`/`PLAYER_BUILD_ENGINE_CONFIG_VERSION`
  - `ProgressService` nunca recalcula nada dos motores — só conta/lê o que cada um já persistiu
    (contagens diretas via Prisma + `LearningService.getProfile`/`ReportsService.getSummary`
    reaproveitados), mesmo princípio de "camada fina de leitura" do `StrategicProfileBuilder`
  - 5 novos testes (`progress.service.spec.ts`) — 87 suites na API (era 86/641)

## [0.61.0] — 2026-09-15

### Added
- **Módulo eFootball — Tarefa 15 (integração com Match Analysis).** A recomendação de aula da
  Academia (`LEARNING_RECOMMENDATION`, Ask Coach/Tarefa 14) passa a considerar a categoria de
  erro mais frequente das partidas REAIS já analisadas pelo pipeline de vídeo existente
  (`ReportsService.getSummary().worstCategory` — EA FC hoje, único jogo com análise de vídeo em
  produção) antes de cair na próxima aula "em sequência" da trilha do nível atual.
  - **Escopo deliberadamente limitado à agregação por categoria já existente**
    (`attack`/`defense`/`passing`/`decision`) — nunca uma correlação fina (ex.: "zagueiro sai de
    posição com frequência"), que exigiria detecção real de posição de jogador/bola. Essa fonte
    não existe em nenhum lugar do projeto hoje (`docs/tactical-engine-current-state.md`,
    `docs/efootball-architecture.md` risco 3) — reafirmado aqui, não resolvido
  - `LearningService.getMatchInformedRecommendation()` (novo) + `match-analysis-recommendation.util.ts`
    (mapa puro `attack→Finalização`, `defense→Defesa`, `passing→Passe`, `decision→Movimentação`)
    — busca o módulo correspondente no catálogo da Academia (qualquer nível, não só o do perfil
    do usuário) e recomenda sua primeira aula **só se já estiver desbloqueada e ainda não
    concluída** — nunca fura a ordem sequencial de desbloqueio garantida pela Tarefa 12
  - Sem partida analisada ainda (`worstCategory: null`), categoria sem módulo mapeado, módulo
    inexistente pro jogo, ou aula bloqueada/já concluída: `null`, sem exceção — `AskCoachService`
    cai automaticamente para o comportamento anterior (próxima aula da trilha do nível atual)
  - 11 novos testes (`match-analysis-recommendation.util.spec.ts` + novos casos em
    `learning.service.spec.ts` e `ask-coach.service.spec.ts`) — 86 suites na API (era 85/630)

## [0.60.0] — 2026-09-15

### Added
- **Módulo eFootball — Tarefa 14 (Ask Coach / Intent Router).** `POST /ask-coach` — pergunta em
  texto livre, classificada por um Intent Router 100% determinístico (`intent-router.ts`, busca de
  palavra-chave sobre texto normalizado, sem IA na classificação) num dos 5 intents conhecidos, que
  então chama o motor determinístico correspondente: `PLAYER_SEARCH` (Tarefa 3),
  `BUILD_RECOMMENDATION` (Tarefa 5), `SQUAD_ADVICE` (Tarefa 9), `ECONOMY_ADVICE` (Tarefa 11),
  `LEARNING_RECOMMENDATION` (Tarefa 12) — `UNKNOWN` para perguntas fora do vocabulário reconhecido.
  - **Regra de custo/dados (Tarefa 20 adiantada aqui por necessidade):** só as 2 intents cujo
    resultado é narrativo (`SQUAD_ADVICE`, `BUILD_RECOMMENDATION`) chamam IA generativa — e só pra
    explicar em texto um resultado já calculado pelo motor, nunca pra recalcular ou inventar dado
    de jogo. `PLAYER_SEARCH`/`ECONOMY_ADVICE`/`LEARNING_RECOMMENDATION` já têm resposta
    determinística suficiente e nunca chamam IA; `UNKNOWN` responde com um texto fixo em vez de
    deixar uma IA generativa "adivinhar" sobre mecânica de jogo sem fonte validada
  - `EfootballCoachService` (Tarefa 10) ganhou `explainBuild()` — primeira narração de IA do
    Player Build Engine (Tarefa 5; até aqui só `explanationData` estruturado existia, sem nenhum
    consumidor de texto). Cascata Claude → GPT-4o → DeepSeek → Groq extraída para um método
    privado `runCascade()` compartilhado com `explainSquad()` (refatoração sem mudança de
    comportamento, coberta pelos testes existentes)
  - Campos "slot" opcionais no corpo (`userSquadId`, `packId`, `userCoins`, `playerCardId`,
    `level`, `availableProgressionPoints`, `strategy`) — preenchidos pelo frontend quando a
    pergunta parte de uma tela específica (ex.: usuário pergunta "vale a pena?" já na tela de um
    pack aberto), nunca inferidos a partir do texto da pergunta em si. Sem os slots necessários
    pra uma intent, a resposta é uma pergunta de esclarecimento determinística (sem chamar o
    motor nem a IA) em vez de adivinhar `packId`/`availableProgressionPoints`
  - `SQUAD_ADVICE` sem `userSquadId` explícito usa o elenco padrão do usuário
    (`isDefault: true`, senão o mais recente); sem nenhum elenco salvo, orienta a montar um no
    Squad Builder em vez de chamar IA sem dado nenhum
  - Build/Squad advice com IA indisponível (todos os provedores falharam) caem pra uma resposta
    determinística construída com os mesmos fatos do motor — o endpoint nunca retorna vazio
  - 25 novos testes (`intent-router.spec.ts`, `ask-coach.service.spec.ts`, 3 novos em
    `efootball-coach.service.spec.ts` para `explainBuild`) — 85 suites na API (era 83/605)

## [0.59.0] — 2026-09-15

### Added
- **Módulo eFootball — Tarefa 13 (Onboarding).** `POST /onboarding/efootball` — primeiro contato
  do usuário com o módulo: registra o nível autodeclarado (mesmo enum `LearningLevel` do
  `UserLearningProfile`, Tarefa 12) e objetivos opcionais, e já resolve a trilha inicial
  correspondente (`LearningPath` para `(gameId eFootball, level)`) numa única chamada — evita o
  cliente encadear `PATCH /learning/profile` + `GET /learning/paths`.
  - `UserLearningProfile.onboardingCompletedAt` (schema + migration `20260915120000_add_onboarding_completed_at`)
    — preenchido só na primeira vez; refazer o onboarding depois (usuário reavalia o próprio
    nível) atualiza nível/objetivos sem perder a data original de conclusão
  - `GamesService.findByProvider('EFOOTBALL')` (já existente desde a Tarefa 2) resolve o `Game`
    internamente — o endpoint não recebe `gameId` do cliente, já que `/onboarding/efootball` é
    específico do eFootball
  - `GET /learning/profile` (Tarefa 12) passa a incluir `onboardingCompletedAt` também no valor
    padrão (perfil ainda não criado) — frontend decide se mostra a tela de onboarding sem
    endpoint novo
  - Sem trilha cadastrada para o nível informado, `recommendedPath` volta `null` em vez de lançar
    erro — o perfil ainda é salvo normalmente
  - 4 novos testes (`onboarding.service.spec.ts`): trilha inicial correta por nível, data de
    conclusão preservada ao refazer o onboarding, isolamento entre usuários, nível sem trilha
    cadastrada
  - 83 suites na API (era 82/601)

## [0.58.0] — 2026-09-14

### Added
- **Módulo eFootball — Tarefa 12 (Academia CoachPlay).** `LearningPath`/`LearningModule`/
  `Lesson`/`Exercise`/`UserLessonProgress`/`UserLearningProfile` — trilhas de aprendizado por
  nível (`BEGINNER`/`CASUAL`/`INTERMEDIATE`/`ADVANCED`/`COMPETITIVE`), sem IA. Conteúdo inicial
  com os 12 tópicos exigidos (Fundamentos, Passe, Finalização, Defesa, Drible, Movimentação,
  Formações, Estilos de jogo, Progressão de jogadores, Skills, Montagem de elenco, Economia),
  distribuídos por complexidade crescente entre as 5 trilhas — texto didático conceitual
  próprio do CoachPlay, nunca uma alegação de mecânica exata do jogo.
  - Desbloqueio sequencial determinístico (`learning-progress.util.ts`): 1ª aula de cada trilha
    sempre liberada; as demais exigem a aula anterior (ordem canônica módulo→aula) concluída
  - `completeLesson()` idempotente — concluir de novo uma aula já concluída ("repetir aula")
    nunca duplica `UserLessonProgress`, só atualiza `completedAt`/`attempts`
  - Todo método filtra sempre por `currentUser.id`, nunca aceita userId do cliente — progresso
    de um usuário nunca visível/afetável por outro
  - `GET /learning/paths`, `GET /learning/paths/:id` (com unlocked/completed por aula),
    `GET /learning/paths/:id/progress`, `POST /learning/lessons/:id/complete`,
    `GET`/`PATCH /learning/profile`
  - Seed idempotente: 5 trilhas / 12 módulos / 12 aulas
  - 16 novos testes cobrindo os 6 critérios exigidos: concluir aula, repetir aula, desbloquear
    aula seguinte, progresso, alteração de nível, usuário diferente
  - 82 suites na API (era 80/585)

## [0.57.0] — 2026-09-14

### Added
- **Módulo eFootball — Tarefa 11 (Economy/Coins Advisor).** `Pack`/`PackTargetPlayer`/
  `EconomyRecommendation` — motor 100% determinístico que responde "vale tentar esse pack?", sem
  IA. Regra dura: nunca inventa probabilidade de pack — sem odds verificadas (`probability` nulo
  em todos os alvos, ou qualquer valor fora de 0–1), a recomendação é sempre
  `INSUFFICIENT_DATA`, nunca um palpite.
  - `teamNeedScore`/`duplicateRisk` não dependem de odds (sempre computáveis); `expectedValue`
    (aproximação própria do CoachPlay, overallBase-based) e `recommendationScore` exigem odds
    válidas
  - `coinRisk` força `NOT_RECOMMENDED` quando o usuário não tem moedas suficientes,
    independente do resto do cálculo
  - "needs" reaproveita o Squad Builder — novo `SquadBuilderService.getWeakPositionGroups()`
    (reexecuta o motor da Tarefa 9 sem chamar IA); sem `userSquadId` informado, nenhuma
    necessidade é assumida
  - `POST /economy-advisor/evaluate`
  - 15 novos testes cobrindo os 6 cenários exigidos: sem Coins, já possui os principais
    jogadores, necessidade alta vs. baixa (comparativo), pack sem odds, odds inválidas
  - 80 suites na API (era 78/570)

## [0.56.0] — 2026-09-14

### Added
- **Módulo eFootball — Tarefa 10 (Coach de Elenco).** Primeira integração de IA generativa do
  módulo eFootball — módulo novo e isolado (`efootball-coach`), não uma extensão do
  `AiCoachService` clássico (100% EA FC hoje, não deve ser tocado). Mesma cascata de provedores
  (Claude Sonnet 4.6 → GPT-4o → DeepSeek → Groq, best-effort, `null` se todos falharem) e reusa
  `SettingsService` para as chaves.
  - `SquadBuilderService.explainSquad()` reexecuta o motor determinístico (Tarefa 9) contra o
    elenco atual, resolve nomes/composição por grupo posicional e monta um contexto 100%
    resolvido — a IA nunca consulta o banco nem escolhe jogador, só narra o resultado já pronto
  - `GET /squad-builder/squads/:id/explain`
  - 14 novos testes: prompt builder (valida contexto enviado — formação/jogador/posição fraca
    corretos, nenhuma informação fora do contexto), cascata de fallback (Claude→GPT-4o→
    DeepSeek→Groq→null), integração com o Squad Builder
  - 78 suites na API (era 76/556)

## [0.55.0] — 2026-09-14

### Added
- **Módulo eFootball — Tarefa 9 (Squad Builder).** `Formation`/`FormationPosition`/`UserSquad`/
  `SquadPlayer` — motor determinístico que monta a escalação titular a partir do elenco
  (`UserPlayer`) e de uma formação, sem IA. 6 formações no catálogo (`4-3-3`/`4-2-3-1`/`4-2-1-3`/
  `4-4-2`/`3-4-3`/`3-5-2`), cada uma com exatamente 11 slots e exatamente 1 slot GK — invariante
  do catálogo que garante estruturalmente que o motor nunca escala mais de 11 jogadores nem 2
  goleiros simultaneamente.
  - `positionCompatibility` reaproveita `resolvePositionGroup` do `player-build-engine`
    (Tarefa 5): 1 = posição exata, 0.7 = mesmo grupo posicional, 0 = incompatível (nunca escala
    um zagueiro no gol, por exemplo)
  - `buildSquad`: slot a slot, escolhe o candidato disponível de maior score
    (compatibilidade × overall), nunca reaproveita jogador já escalado; `weakPositions`
    (vaga vazia ou preenchida fora de posição) e `alternatives` (próximos candidatos por slot)
  - `POST /squad-builder/generate` (preview) e `POST /squad-builder/squads` (gera e persiste)
  - 52 novos testes cobrindo os cenários exigidos: 11/18/30 jogadores, jogadores duplicados,
    sem goleiro, sem lateral, excesso de atacantes, e os 2 guardas de segurança (nunca 12
    jogadores, nunca 2 goleiros) validados contra as 6 formações
  - 76 suites na API (era 72/504)

## [0.54.0] — 2026-09-14

### Added
- **Módulo eFootball — Tarefa 8 (Meus Jogadores).** `UserPlayer`/`UserPlayerBuild` — "Meu
  Elenco": jogador adiciona uma carta ao elenco (por pesquisa, scanner ou manualmente — todos
  convergem para um `playerCardId`, a origem é só a UI, não um campo persistido), nunca duplica
  a mesma carta (`@@unique([userId, playerCardId])`), edita nível/posição favorita/notas,
  marca favorito, salva builds (snapshot do resultado do Player Build Engine ou de uma alocação
  manual) e troca qual build está ativa. Filtros de `GET /user-players`: posição, tipo/raridade
  (mapeados para `PlayerCard.cardType`, não existe campo de raridade separado), faixa de overall,
  nível, favoritos.
  - Segurança: `assertOwner()` (mesmo padrão de `MatchesService`) em todos os endpoints — usuário
    nunca acessa/edita/remove elenco de outro usuário, testado explicitamente
  - 14 novos testes (72 suites na API, era 71/490)

## [0.53.0] — 2026-09-14

### Added
- **Módulo eFootball — Tarefas 1 a 7 do novo subdomínio multi-jogo.** Início da transformação do
  Coach Play numa plataforma de treinamento para futebol virtual, começando pelo eFootball.
  Auditoria completa e progresso em `docs/efootball-architecture.md`; documentação técnica por
  módulo em `docs/efootball/`.
  - **Tarefa 2** — Domínio `Game`: `Game`/`GameVersion`/`GameDataSource` (enum `GameProvider`,
    hoje só `EFOOTBALL`), `GamesService`/`GamesController` (`GET /games`), seed idempotente
  - **Tarefa 3** — Banco de jogadores: `Player`/`PlayerCard` (nunca funde versões diferentes de
    uma carta) + `PlayerPosition`/`PlayerStat`/`PlayerSkill`/`PlayerPlayStyle`/`CardVersion`;
    busca por nome/apelido via `normalizedName` (substring, sem acento, sem IA — "Kvara" encontra
    "Khvicha Kvaratskhelia")
  - **Tarefa 4** — Pipeline `efootball-data-provider`: fetch→normalize→validate (Zod)→version
    (checksum sha256 estável)→import; detecta jogador novo/carta nova/atributo alterado/carta
    removida; `DataImportRun`/`DataImportChange` como trilha de auditoria; nenhuma fonte real de
    dados integrada ainda (só fixture, decisão de produto/legal em aberto)
  - **Tarefa 5** — `player-build-engine`: motor 100% determinístico (sem IA no cálculo), 8
    estratégias (`MAX_OVERALL`/`BALANCED`/`DRIBBLER`/`FINISHER`/`SPEED`/`PASSER`/`DEFENSIVE`/
    `POSITION_OPTIMIZED`), alocação de pontos por round-robin ponderado, `roleScore` por posição
  - **Tarefa 6** — `player-builds`: `POST /player-builds/compare` — compara 2 builds já
    definidas, `overall` como aproximação própria do CoachPlay (nunca a fórmula oficial da
    Konami), `advantages`/`disadvantages` gerados deterministicamente
  - **Tarefa 7** — `player-scanner`: identifica carta a partir de screenshot — pré-processamento
    real via `sharp`, normalização, busca e scoring por similaridade de texto (Levenshtein),
    limiares de confiança (>0.90 automático / 0.60–0.90 confirmar / <0.60 nova imagem); nenhum
    motor de OCR real integrado ainda (`CardImageExtractor` como costura, mesmo padrão do
    `TacticalStateProvider`) — nunca pede pra uma IA generativa "adivinhar" a carta
  - 143 novos testes (71 suites na API, era 50/347 testes antes da Tarefa 2)

## [0.51.0] — 2026-08-27

### Added
- **Campo "time que você jogou" para o Gemini identificar o lado certo antes de apontar erros.**
  Sem contexto nenhum, o Gemini (0.49.0) não tem como saber qual dos dois times no vídeo é o do
  jogador que pediu a análise — risco real de atribuir um erro do adversário ao usuário.
  - `Match.playerTeam` (schema + migration) — campo de texto livre e opcional (nome do
    time/clube ou descrição da camisa/lado do campo)
  - `CreateMatchDto`/`matches.service.ts` — aceita e persiste o campo
  - `VideoProcessingWorker` → `GameAnalysisService` → `GeminiVisionService` — repassa
    `playerTeam` até o prompt, que instrui o Gemini a usar essa informação para identificar o
    time antes de apontar qualquer erro
  - Frontend: campo com explicação do porquê preencher em "Nova Partida"; tela de análise
    (`matches/[id]/page.tsx`) mostra o time informado como chip no cabeçalho

## [0.50.0] — 2026-08-27

### Fixed
- **Lista de partidas e tela de análise não se atualizavam sozinhas durante o processamento.** A
  análise roda em background (BullMQ), mas as duas telas só buscavam os dados uma vez ao montar
  — quem ficava olhando uma partida "Aguardando"/"Processando" via o status desatualizado até dar
  F5 manualmente. Adicionado polling de 8s enquanto o status não for terminal (`analyzed`/
  `failed`), tanto em `/matches` (lista) quanto em `/matches/:id` (detalhe) — o polling da lista
  não mostra spinner (`showSpinner: false`), o do detalhe reaproveita o mesmo fetch do
  carregamento inicial (`fetchMatch`/`fetchMatches` extraídos para `useCallback`)

## [0.49.0] — 2026-08-27

### Added
- **Substituída a detecção fake de erros por análise real de vídeo via Gemini** — fecha o TODO
  documentado desde o CHANGELOG 0.47.0. `GameAnalysisService` gerava eventos/erros por posição no
  tempo (categoria distribuída por fase da partida, severidade em rotação fixa a cada 3º evento,
  `confidence: 0.5` fixo) sem olhar o conteúdo do vídeo — os frames de erro adicionados na 0.48.0
  mostravam o timestamp certo, mas nunca a jogada real por trás dele. Agora o vídeo inteiro é
  enviado ao Gemini (único dos 5 provedores de IA do projeto com ingestão nativa de vídeo — Claude
  e GPT-4o só aceitam imagem estática), que aponta os erros de verdade com timestamp exato,
  categoria e severidade reais.
  - `GeminiVisionService` (novo, `apps/api/src/modules/game-analysis/gemini-vision.service.ts`) —
    `analyzeVideo()`: sobe o vídeo via File API do Gemini (`ai.files.upload`), aguarda o
    processamento (`waitUntilActive`, polling de 5s, timeout 5min), chama `gemini-2.5-flash` com
    `MediaResolution.MEDIA_RESOLUTION_LOW` (mais barato, suficiente para posicionamento tático) e
    `responseSchema` estruturado restrito ao vocabulário de `category`/`severity` que
    `reports.service.ts` já usa para o cálculo de score — nunca deixa o modelo inventar uma
    categoria fora do enum. Prompt instrui explicitamente a não inventar erros para preencher uma
    quantidade ("se a partida foi bem jogada, retorne poucos erros ou nenhum")
  - Custo estimado por token (`PRICE_IN_PER_TOKEN`/`PRICE_OUT_PER_TOKEN`, preços reais do Gemini
    2.5 Flash) soma no mesmo `AIAnalysis.costEstimate` que a narração da IA Coach já usava — Uso &
    IA no admin reflete o custo real sem mudança na agregação existente
  - `GEMINI_API_KEY` segue o mesmo padrão dos outros 4 provedores (schema `AppSetting` + migration
    + `SettingsService` + `UpdateAiProviderDto` + card na tela admin Uso & IA)
  - `VideoCaptureService.extractFrameAt` (novo) — extrai o frame no timestamp exato retornado pelo
    Gemini, substituindo o grid fixo de 30s (que podia errar o frame do erro por até 15s)
  - Fallback para a heurística antiga (comportamento pré-0.49.0) só quando `GEMINI_API_KEY` não
    está configurada (`GeminiNotConfiguredError`); qualquer outra falha do Gemini propaga — o
    worker já tem retry (3 tentativas, backoff exponencial) e marca `failed` no esgotamento
  - Efeito colateral esperado: "Lances da Partida" fica mais curta (só os erros reais, sem os
    ~30 eventos fake por partida de antes) — troca deliberada, decidida com o usuário
  - `package.json` (`apps/api`) — nova dependência `@google/genai`

### Notes
- Este fix resolve a fabricação de dados, mas não o gap estrutural do Tactical Engine documentado
  desde a Tarefa 1 (`docs/tactical-engine-current-state.md`): o Gemini aponta erros e timestamps a
  partir do vídeo, mas não devolve coordenadas de jogador/bola — `TacticalStateProvider` continua
  sem nenhuma implementação real

## [0.48.0] — 2026-08-27

### Added
- **Mostra o frame do erro detectado na tela de análise da partida** — primeiro passo para sair de
  "só texto": em vez de vídeo pesado, guarda só a imagem estática (frame já extraído pelo FFmpeg)
  do momento exato de cada erro detectado.
  - `DetectedError.frameUrl` (schema + migration)
  - `GameAnalysisService` copia o frame do erro para `uploads/error-frames/` antes do worker
    apagar o diretório temporário de frames (que já acontecia ao final do processamento do
    vídeo); falha ao copiar só deixa `frameUrl: null`, nunca derruba a análise inteira
  - `matches/[id]/page.tsx` — `ErrorItem` mostra a miniatura do frame (clicável, abre a imagem
    original em tamanho real)

## [0.52.0] — 2026-08-28

### Added
- **`apps/extension`: reescrita do pipeline de captura — `chrome.tabCapture` + offscreen document
  como caminho principal, o content script/`<video>` heurístico vira só fallback.** Motivação:
  além do gap de calibração dos limiares (ainda em aberto, ver `docs/REMOTE_PLAY_CAPTURE.md`), o
  caminho antigo dependia inteiramente de achar um `<video>` na página (heurística de
  `video-picker.ts`, que pode quebrar se o Xbox mudar o player) e de passar cada frame por
  `chrome.runtime.sendMessage` entre o content script (isolated world) e o service worker — o
  mesmo mecanismo cuja falha de transporte de `ArrayBuffer` corrompeu 100% dos frames na validação
  de 2026-07-22 (CHANGELOG 0.38.3, contornado então com base64). O novo caminho principal evita
  essa classe de bug de origem: `chrome.tabCapture.getMediaStreamId()` captura o vídeo da aba
  inteira sem depender de nenhum `<video>` específico da página, o stream é processado inteiramente
  dentro de um **offscreen document** (`offscreen.html`/`offscreen.ts` — único jeito de manter um
  `MediaStream`/`<video>`/`setInterval` vivos sob Manifest V3, já que o service worker pode ser
  reciclado a qualquer momento de ociosidade) e o upload do JPEG comprimido sai direto do próprio
  offscreen document via `fetch`, sem nunca cruzar `chrome.runtime.sendMessage` com dados binários.
  - `CaptureManager` (`background/capture-manager.ts`, novo) — orquestra dois `CaptureProvider`
    (`providers/types.ts`): `TabCaptureProvider` (principal, coordena o offscreen document a
    partir do service worker) e `VideoElementCaptureProvider` (fallback, é o mecanismo antigo
    reaproveitado — content script + `chrome.runtime.sendMessage` + base64). Se o provider ativo
    falhar (`onProviderUnavailable`/`onFatalError`), tenta automaticamente o outro antes de desistir
    da sessão (`attemptFallbackThenFail`)
  - `CaptureSessionState` (`shared/capture-state-machine.ts`, novo) — máquina de estados explícita
    (`idle→starting→running↔paused→reconnecting→stopping→stopped|failed`) com transições validadas
    (`InvalidCaptureTransitionError` em vez de estado inconsistente silencioso)
  - Reconexão com backoff (`shared/reconnect-backoff.ts`) — perda de stream (`onStreamLost`, ex.:
    a track de vídeo termina) tenta reconectar com o mesmo provider em 500ms/1s/2s antes de cair
    para o provider alternativo
  - Backpressure de upload (`shared/backpressure-gate.ts`, `LatestFrameBuffer`) — buffer de um
    único slot: se um frame novo fica pronto antes do upload do anterior terminar, o anterior é
    descartado. O Coach Play precisa do frame mais recente, nunca de uma fila atrasada
  - Diff de frame antes de processar (`shared/frame-diff.ts`) — assinatura barata (média estridada
    de bytes RGBA) descarta frames "praticamente parados" antes de chegar ao estágio de
    amostragem/compressão, reduzindo banda e CPU sem custar um diff pixel-a-pixel completo
  - Dois níveis de FPS (`shared/capture-config.ts`, `shared/frame-sampler.ts`): `processingFps`
    (cadência de detecção de movimento, default 5) separado de `analysisFps` (cadência real de
    upload para análise, default 1) — a Fase 2 de `capture-sessions` já distinguia os dois
    conceitos, mas o pipeline de captura da extensão não
  - `CaptureMetrics` (`shared/capture-metrics.ts`) — conta frames capturados/processados/
    enviados/descartados (por motivo: diff-gate/sampler-skip/backpressure), latência de upload
    (última + média) e reinícios de provider; exposto no snapshot que o popup lê
  - Reidratação após reciclagem do service worker (`CaptureManager.rehydrate()`) — o offscreen
    document sobrevive à reciclagem do SW (MV3 mata o SW após ~30s ocioso, o offscreen document
    não), então um restart do SW no meio de uma captura via `tabCapture` perdia todo o estado em
    memória enquanto o pipeline offscreen seguia rodando sozinho, dessincronizado. Agora, antes do
    primeiro handler de mensagem relacionado à captura, `CaptureManager` consulta
    `chrome.offscreen.hasDocument()` + `queryStatus()` e reconstrói seu estado em memória a partir
    do que encontrar rodando
  - `manifest.json` — novas permissions `tabCapture`/`offscreen`; `package.json` (`bundle`) e
    `scripts/copy-static.mjs` passam a empacotar/copiar `offscreen.js`/`offscreen.html`
  - Content script (`content/index.ts`, provider de fallback): ganhou `pause`/`resume` de verdade
    (antes só tinha start/stop — pausar reiniciava a amostragem do zero); só avisa o background no
    primeiro miss consecutivo de `<video>` em vez de logar/mensagear a cada tick sem vídeo
  - Popup: novos estados exibidos (`starting`/`reconnecting`/`stopping`, antes só
    `running`/`paused`/`stopped`/`failed`), rótulo do provider ativo ("captura direta da aba" vs.
    "modo alternativo") e controles desabilitados durante estados transitórios
  - 7 novas suítes de teste (`capture-manager`, `capture-state-machine`, `frame-diff`,
    `frame-dimensions`, `frame-sampler`, `backpressure-gate`, `reconnect-backoff`) — 51 testes em
    `apps/extension` (9 suítes, era 2 suítes/8 testes antes desta mudança). Build (`tsc` + `esbuild`,
    incluindo o novo bundle `offscreen.js`) validado sem erros

### Notes
- **Ainda não validado contra uma sessão real de Xbox Remote Play** — mesma ressalva de toda
  mudança anterior na extensão: precisa recarregar em `chrome://extensions` e testar contra uma
  aba real. Como o caminho principal (`tabCapture` + offscreen) nunca foi exercitado fora dos
  testes automatizados (que rodam contra mocks de `chrome.*`), essa validação é o próximo passo
  antes de qualquer calibração de limiares de detecção (`GameStateDetectorService`,
  `EventDetectorService` — ver `docs/REMOTE_PLAY_CAPTURE.md`) e antes de considerar o fix do
  0.38.3 (transporte via base64) definitivamente superado — o `VideoElementCaptureProvider` de
  fallback ainda depende dele, então continua valendo enquanto o fallback existir
- `apps/desktop` não ganhou o equivalente desta reescrita — continua no mecanismo antigo (IPC do
  Electron), sem o gap de foco resolvido aqui já ser aplicável a ele (a limitação de foco do
  Remote Play, documentada desde a 0.35.0, é estrutural ao Electron ser uma janela separada, não
  ao transporte de frame)

## [0.47.0] — 2026-08-27

### Fixed
- **Crítico — `apps/web` ficava com tela travada/em branco depois de 15min de uso, só
  recuperava limpando dados de navegação**: reportado como "erro ao acessar partidas
  analisadas" e antes disso como "acesso não autorizado" ao salvar chave de IA no admin.
  Investigação (nginx access log da VPS, correlacionando por timestamp): `GET
  /api/v1/matches/:id` e `/matches/:id/report` voltando 401 — o access token
  (`JWT_ACCESS_EXPIRES_IN=15m`) tinha expirado. Mesma causa raiz já documentada no
  CHANGELOG 0.46.0 para `apps/extension` (e que também afeta `apps/desktop`): nenhuma
  renovação automática existia. Mas o efeito em `apps/web` é pior que nos outros
  clientes — não existia nem tratamento de erro dedicado: como o `AuthProvider`
  ([auth-provider.tsx](apps/web/src/providers/auth-provider.tsx)) só confere a sessão
  **uma vez**, ao montar a página, ele não percebe o 401 de uma chamada de dados feita
  no meio de uma navegação client-side já em andamento — a sidebar renderiza
  normalmente (estado de auth "válido" desatualizado), só os dados da página em si
  ficam quebrados, sem nenhum redirecionamento ou aviso pro usuário.
  Corrigido em [api.ts](apps/web/src/lib/api.ts): qualquer 401 agora dispara
  `POST /auth/refresh` (usa o cookie httpOnly `refresh_token` de 7 dias, que já
  existia e não tinha esse uso) e repete a chamada original automaticamente antes de
  desistir; `refreshPromise` deduplica corridas quando várias chamadas expiram juntas.
  Só cai pro `/login` se o cookie de 7 dias também estiver inválido/expirado — aí sim é
  logout de verdade, não um bug.
- Ao investigar o caso acima, achado um bug separado e real de dados: `GameAnalysisService`
  gera eventos/erros **sem olhar o conteúdo do vídeo** — categoria por posição no tempo,
  severidade em rotação fixa a cada 3º evento
  ([game-analysis.service.ts:32-33](apps/api/src/modules/game-analysis/game-analysis.service.ts#L32),
  TODO explícito no código pra isso ser substituído por análise multimodal). A IA (Claude/
  GPT/DeepSeek/Groq) só narra esses dados fabricados em texto, nunca julga se algo foi erro.
  Ainda não corrigido — ver discussão em aberto sobre trocar por um modelo com entendimento
  nativo de vídeo (ex. Gemini) pra detecção real, e adicionar player com clique-pra-pular-
  pro-timestamp do erro na tela de análise (`matches/[id]/page.tsx` hoje não renderiza
  vídeo nenhum, mesmo os timestamps já existindo no banco).

### Notes
- **`apps/desktop` continua sem nenhuma renovação de sessão** (nem silenciosa, nem aviso
  como a extensão ganhou em 0.46.0) — mesma classe de bug, ainda não tratada nesse cliente.
  Verificar se vale aplicar o mesmo padrão do 0.46.0 (extensão) lá, já que sessões de
  captura no desktop também costumam passar de 15min.
- Se esse tipo de sintoma ("tela branca/preta que só volta limpando cookies", "acesso não
  autorizado" aparecendo do nada em uma sessão que estava logada) reaparecer em produção,
  primeiro suspeitar de expiração de token antes de qualquer outra causa — já foi a raiz
  real três vezes nesta mesma investigação (extensão em 0.46.0, e dois sintomas
  aparentemente não relacionados aqui no mesmo dia).

## [0.46.0] — 2026-08-14

### Fixed
Primeira validação de ponta a ponta da extensão contra a API de **produção** (todas as
validações anteriores da extensão foram feitas contra `localhost` — ver CHANGELOG 0.38.3, notas).
Achados:

- **Crítico — extensão nunca conseguia falar com a API de produção**: `BASE_URL` em
  `apps/extension/src/background/backend-client.ts` estava fixo em `http://localhost:3001/api/v1`
  (endereço de dev) e o `manifest.json` nem tinha `host_permissions` para o domínio de produção —
  todo login retornava "Failed to fetch" (nem chegava a sair da máquina do usuário). Corrigido:
  `BASE_URL` aponta para `https://coachplayals.com.br/api/v1` por padrão (localhost mantido no
  `host_permissions` para quem quiser testar contra API local no futuro — ver TODO já existente
  sobre tornar isso configurável via options page)
- **Crítico — sessão de captura silenciosamente parava de enviar frames após 15 minutos**: o
  access token do Coach Play expira em 15min (`JWT_ACCESS_EXPIRES_IN`) e a extensão nunca tinha
  lógica de renovação — toda chamada autenticada após a expiração falhava com HTTP 401,
  `handleContentFrame` só logava o erro no console do service worker e continuava tentando pra
  sempre, sem nenhum aviso visível pro usuário (achado ao validar: 147 falhas de 401 em sequência,
  zero frames persistidos). **Renovação silenciosa não é viável**: o cookie `refresh_token` é
  `SameSite=Strict`, nunca enviado por um `fetch` originado de `chrome-extension://` mesmo com
  `credentials: 'include'` — mesma limitação vale para `apps/desktop` (também nunca implementou
  refresh). Corrigido com uma saída segura em vez de silêncio: novo `SessionExpiredError`
  (`backend-client.ts`) lançado por qualquer chamada autenticada que volte 401; ao ser detectado —
  seja durante upload de frame (`handleContentFrame`) ou em qualquer ação interativa do popup —, a
  extensão para a amostragem no content script, limpa a sessão local e volta pra tela de login com
  a mensagem "Sua sessão expirou (o login dura 15 minutos) — entre novamente para continuar."
  (`session-store.ts`/`setAuthExpired`, novo `expiredReason` no retorno de `AUTH_STATUS`)
- Build (`tsc` + `esbuild`) e as 8 suítes existentes de `apps/extension` validados sem regressão;
  nenhum teste novo (mudança é toda de integração/orquestração já coberta indiretamente, mesmo
  padrão de mudanças anteriores só de UI/orquestração na extensão)

### Notes
- Ainda falta uma solução de verdade para sessões de captura longas (uma partida real dura bem
  mais que 15min) — hoje o usuário precisa logar de novo manualmente se a sessão expirar no meio
  da captura. Opções futuras: token de acesso com vida mais longa só para clientes de
  captura (desktop/extensão), ou um fluxo de refresh que não dependa de cookie `SameSite=Strict`
  (ex.: refresh token retornado no corpo da resposta para esses clientes, guardado em memória do
  mesmo jeito que o access token já é hoje) — mudança de modelo de autenticação, não deve ser
  feita sem alinhar com o usuário antes
- Duas sessões de captura órfãs (`status: running`, criadas nesta validação, nunca chegaram a
  receber frame nenhum) ficaram no banco de produção — não foram limpas automaticamente porque a
  chamada de `stop` também exigiria um token válido; sem impacto funcional (não bloqueiam sessões
  novas), mas aparecerão como "em andamento" para sempre se alguém consultar via `GET
  /capture-sessions/:id/status`

## [0.45.0] — 2026-08-14

### Added
- **Tactical Engine — Fase 7 (Robustez)**: última fase do roadmap original (7 fases, 39
  tarefas) — fecha o motor como projeto completo e testado contra fixtures. Não fecha o gap
  estrutural documentado desde a Tarefa 1: continua sem fonte real de posição de
  jogadores/bola, sem controller/endpoint HTTP público. Ver `docs/TASKS.md`.
  - **Tarefas 29/30 (Sistema de confiança + anti-falso-positivo)** — `confidence.evaluator.ts`:
    `evaluateConfidence()` agrega os sinais de confiança que `TacticalGameState`/`VirtualPlayer`
    já carregavam desde a Fase 1 mas nenhum código usava, sempre pelo MENOR sinal disponível
    (nunca o mais otimista; limiar 0.5). `decision.evaluator.ts` passa a retornar `null` também
    quando a confiança agregada é insuficiente, mesmo com uma candidata de ação válida
  - **Tarefa 34 (Dataset de fixtures)** — `tactical-fixtures.ts`: cenários nomeados reutilizáveis
    (reciclagem segura, contra-ataque 3×2, sobrecarga central, passe central sob pressão,
    confiança insuficiente, elenco completo 11×11); specs existentes não foram migradas
  - **Tarefas 31/32/33 (Performance + testes de integração)** —
    `tactical-engine.integration.spec.ts`: primeiro teste encadeando várias fases de verdade
    (avaliação → princípios → padrões entre partidas → perfil → relatório/timeline/detalhe) +
    guarda de performance (200 decisões sobre 22 jogadores em < 3s)
  - **Tarefa 35 (Feature flag)** — `TacticalEngineFeatureFlagService`
    (`TACTICAL_ENGINE_ENABLED`, via `ConfigService`, desabilitada por padrão), gateia
    `AiCoachService.explainDecision()`/`deliverLiveTacticalFeedback()`
  - **Tarefa 36 (Telemetria)** — `Logger.debug` nos pontos de decisão de `AiCoachService` (flag
    desabilitada, cooldown bloqueando entrega ao vivo com a prioridade envolvida)
  - **Tarefas 37/38 (Documentação)** — `docs/tactical-engine-api.md` (referência da API
    TypeScript pública, por fase) e `docs/tactical-engine-scoring.md` (algoritmo de scoring
    completo — referenciado em comentários desde a Fase 3, nunca escrito até agora)
  - **Tarefa 39 (`TacticalStateProvider`)** — já implementada desde a Fase 1, confirmada sem
    mudança de código
  - `.env.example` — nova variável `TACTICAL_ENGINE_ENABLED=false`
  - 30 novos testes (319 na suíte completa da API) — sem regressão; `tsc --noEmit` e
    `nest build` validados

### Notes
- **Tactical Engine: roadmap original completo (Fases 1–7, 39/39 tarefas).** Qualquer próximo
  passo (endpoint público, integração real com `game-analysis`/`capture-sessions`, pipeline de
  visão computacional) é uma decisão de produto nova, não uma fase já planejada

## [0.44.0] — 2026-08-14

### Added
- **Tactical Engine — Fase 6 (Tempo real)**: última fase de funcionalidade do motor antes da
  robustez (Fase 7). Ver `docs/TASKS.md`.
  - `feedback-priority.evaluator.ts` (Tarefa 28) — `computeFeedbackPriority()`: mapeia cada
    `DecisionClassification` (Fase 3) para uma prioridade de interrupção ao vivo (`MAJOR_ERROR`
    → `CRITICAL`, `ERROR` → `HIGH`, `RISKY`/`EXCELLENT` → `MEDIUM`, `ACCEPTABLE`/`GOOD` → `LOW`
    — `LOW` nunca é entregue ao vivo, fica só no relatório pós-jogo da Fase 5).
    `shouldDeliverLiveFeedback()`: cooldown por prioridade (`CRITICAL` 15s, `HIGH` 30s, `MEDIUM`
    60s), sempre usando o MAIOR cooldown entre a prioridade atual e a da última entrega (uma
    entrega `HIGH` recente também segura a próxima `MEDIUM`) — exceto `CRITICAL`, que só
    respeita o próprio cooldown, nunca fica preso atrás do cooldown de um aviso menos urgente
  - `AiCoachService.deliverLiveTacticalFeedback()` — orquestra prioridade + cooldown +
    `explainDecision` (Tarefa 23) + persistência. `feedbackLevel = 'silencioso'` bloqueia
    qualquer entrega sem chamar IA, mesma regra de `generateEventFeedback` (Fase 2) — respeita a
    preferência do usuário acima de qualquer prioridade, inclusive `CRITICAL`. `lastDelivery` é
    passado explicitamente pelo chamador (o motor não guarda estado de sessão nenhum, mesmo
    princípio de isolamento de todas as fases anteriores). Persiste via `CoachFeedback` com
    `feedbackType: 'tactical_feedback'` — valor novo de um campo `String` livre que já existia,
    sem migration. Best-effort: retorna `null` (nunca lança) quando todos os provedores de IA
    falham
  - 15 novos testes (289 na suíte completa da API) — sem regressão; `tsc --noEmit` e
    `nest build` validados. Nenhuma migration Prisma nesta fase

### Notes
- Mesmo bloqueio de todas as fases anteriores: sem fonte real de `TacticalGameState`, ainda não
  existe nenhum worker/pipeline real invocando `deliverLiveTacticalFeedback` — só a Fase 2 de
  `capture-sessions` (motion/estado de jogo) roda contra dados reais hoje
- Próxima fase (Robustez — Tarefas 29–39: sistema de confiança, anti-falso-positivo,
  performance, testes de integração, dataset de fixtures, feature flag, telemetria,
  documentação da API e do algoritmo de scoring) só avança depois de revisão do usuário desta
  Fase 6

## [0.43.0] — 2026-08-14

### Added
- **Tactical Engine — Fase 5 (Coach)**: primeira vez que o motor produz texto — até aqui (Fases
  1–4) tudo era número/enum/estrutura determinística. Único novo acoplamento: `ai-coach` passa a
  importar tipos/funções do `tactical-engine` (nunca o contrário — o motor continua sem chamar
  `@anthropic-ai/sdk`/`openai` diretamente, ver `docs/tactical-engine-domain.md`, seção 5). Ainda
  sem controller/endpoint público. Ver `docs/TASKS.md`.
  - `AiCoachService.explainDecision()` (Tarefa 23, `apps/api/src/modules/ai-coach/ai-coach.service.ts`)
    — recebe uma `DecisionEvaluation` (Fase 3) + `PrincipleAdherence[]` (Fase 4) já resolvidas,
    monta um prompt e gera 1-2 frases de explicação pela mesma cascata Claude → GPT-4o →
    DeepSeek de `analyzeMatch`/`generateEventFeedback`. Best-effort — retorna `null` (nunca
    lança) quando todos os provedores falham. A IA nunca recalcula nota/classificação/
    princípios, só explica em texto o que o motor já decidiu
  - `TacticalDecisionFeedback` (Tarefa 24, `tactical-decision-feedback.type.ts`) — "novo formato
    de feedback": ao lado do texto gerado por IA, sempre carrega `classification`,
    `scoreDifference` e `principlesFollowed`/`principlesViolated` já calculados pelo motor.
    `splitPrincipleAdherence()` (novo helper em `principle-adherence.type.ts`) separa
    `PrincipleAdherence[]` em seguidos/violados, descartando os `null` — reusado também pelos
    dois builders abaixo
  - `buildTacticalMatchReport()` (Tarefa 25, `tactical-match-report.builder.ts`) — agrega
    `EvaluatedDecisionRecord[]` (novo tipo comum aos 3 builders desta fase) de UMA partida em
    nota média (`null`, nunca `0`, quando não há decisões), contagem por classificação (todas as
    6 faixas, mesmo as que não ocorreram) e frequência de princípios seguidos/violados;
    sequências táticas reusam `detectTacticalSequences` (Fase 3) sem duplicar lógica
  - `buildTacticalTimeline()` (Tarefa 26, `tactical-timeline.builder.ts`) — equivalente
    estruturado da timeline "Lances da partida" já exibida em `apps/web`, um item por decisão em
    ordem cronológica, só com os princípios violados (foco no que precisa de atenção)
  - `buildDecisionDetail()` (Tarefa 27, `decision-detail.builder.ts`) — `DecisionDetail`:
    formato canônico de UMA decisão (avaliação + princípios + explicação opcional), pensado para
    um futuro endpoint de detalhe que ainda não existe
  - 18 novos testes (274 na suíte completa da API) — sem regressão; `tsc --noEmit` e
    `nest build` validados. Nenhuma migration Prisma nesta fase — sem novas tabelas

### Notes
- Próxima fase (Tempo real — Tarefa 28: feedback estratégico durante a partida, com prioridade e
  cooldown, plugando `explainDecision`/`TacticalDecisionFeedback` no pipeline de captura em
  tempo real do `capture-sessions`) só avança depois de revisão do usuário desta Fase 5

## [0.42.0] — 2026-08-14

### Added
- **Tactical Engine — Fase 4 (Princípios estratégicos)**: primeira vez que o motor produz um
  vocabulário qualitativo (não só uma nota 0–100) — princípios nomeados, inspirados em xadrez e
  traduzidos para futebol, julgados por decisão e agregados em padrões recorrentes entre
  partidas de um mesmo usuário. Continua 100% determinístico, sem IA generativa, sem
  controller/endpoint público (fica para a Fase 5, integração com `ai-coach`). Ver
  `docs/tactical-engine-domain.md` e `docs/TASKS.md`.
  - `strategic-principle.type.ts` (Tarefa 18) — catálogo de 8 princípios (`CENTRAL_CONTROL`,
    `PIECE_ACTIVITY`, `KING_SAFETY`, `SPACE_EXPANSION`, `INITIATIVE`, `PROPHYLAXIS`, `OVERLOAD`,
    `WEAKNESS_EXPLOITATION`), cada um com nome, origem no xadrez e tradução explícita para
    futebol — dado estático, sem lógica de avaliação embutida
  - `initiative.evaluator.ts` (Tarefa 19) — `evaluateInitiative()`: metade posse da bola, metade
    domínio territorial. O domínio territorial usa a MÉDIA da altura de campo dos dois times
    (não a diferença entre elas): a diferença simples classificaria erradamente como "neutro" um
    cenário em que o usuário está recuado e o adversário pressiona ainda mais perto do próprio
    gol do usuário — um caso de domínio claro do adversário, não empate
  - `overload-switch.evaluator.ts` (Tarefa 20) — `detectOverloadOpportunities()` reusa
    `evaluateNumericalAdvantage` (Fase 2/Tarefa 10) para listar zonas com superioridade numérica
    clara do usuário (diferença ≥ 2); `evaluateSwitchOpportunity()` compara o lado atual da bola
    com o lado espelhado do campo, quantificando o valor de uma troca de lado além do
    `progressionValue` geométrico já calculado pelas linhas de passe
  - `principle-adherence.evaluator.ts` — `evaluatePrincipleAdherence()`: conecta as Tarefas
    18–20 ao motor de decisões da Fase 3 (`DecisionScore`, `TacticalAction`). Para cada ação já
    pontuada, julga os 8 princípios como `true` (seguiu), `false` (violou) ou `null` (princípio
    não estava em jogo neste instante — ex.: `PROPHYLAXIS` sem pressão real a neutralizar,
    `CENTRAL_CONTROL` numa ação `HOLD` sem `targetZone`, `OVERLOAD`/`WEAKNESS_EXPLOITATION` sem
    zona relevante disponível) — nunca inventa julgamento sem base, mesma regra já aplicada em
    `decision.evaluator.ts` (Tarefa 15/30)
  - `tactical-pattern.detector.ts` (Tarefa 21) — `detectTacticalPatterns()`: agrega julgamentos
    de aderência não-nulos através de MÚLTIPLAS partidas do mesmo usuário; só aponta um padrão
    com amostra mínima (3 observações) e consistência real (≥60% de violação vira
    `<principio>_NEGLECTED`, ≥85% de aderência vira `<principio>_STRENGTH`, sempre severidade
    `LOW` — um ponto forte não é um risco). `tactical-patterns.service.ts` persiste via
    `TacticalPattern` (Prisma) com upsert por `(userId, pattern)` — nunca sobrescreve
    `firstDetectedAt` num update, só `frequency`/`confidence`/`severity`/`lastDetectedAt`
  - `strategic-profile.builder.ts` (Tarefa 22) — `buildStrategicProfile()`: agrega os
    `TacticalPattern` já persistidos em `dominantPrinciples`/`neglectedPrinciples` (ordenados por
    severidade/confiança) + `sampleSize`; camada fina de leitura, não recalcula geometria.
    `tactical-profiles.service.ts` persiste via `TacticalProfile` (Prisma), uma linha por
    usuário, sempre sobrescrita na última agregação — sem histórico de perfis anteriores
  - Prisma: `TacticalPattern`/`TacticalProfile` + enum `TacticalPatternSeverity`, migration
    `20260814171346_add_tactical_engine_phase4`, `TacticalPattern` único por `(userId, pattern)`
  - `TacticalEngineModule` ganha os dois primeiros novos providers desde a Fase 1
    (`TacticalPatternsService`, `TacticalProfilesService`) — todo o resto do módulo (avaliadores,
    motor de decisões, catálogo, detector, builder) continua sendo função pura importada
    diretamente, sem injeção de dependência
  - 49 novos testes (185 no módulo `tactical-engine`, 256 na suíte completa da API) — sem
    regressão; `tsc --noEmit` e `nest build` validados

### Notes
- Próxima fase (Coach — Tarefas 23–27: integração com `ai-coach`, novo formato de feedback
  textual a partir de `DecisionEvaluation`/princípios identificados, relatório pós-jogo, timeline
  e detalhe de decisões) só avança depois de revisão do usuário desta Fase 4

## [0.41.0] — 2026-08-13

### Added
- **Tactical Engine — Fase 3 (Motor de decisões)**: primeira vez que o motor produz uma
  avaliação completa — ação escolhida × melhores alternativas, com nota 0–100 e classificação —
  fechando o critério de sucesso descrito em `docs/tactical-engine-domain.md`. Continua 100%
  determinístico, sem IA generativa, e sem controller/endpoint público ainda.
  - `action-generator.ts` (Tarefa 12) — `generateActions()`: para o portador da bola, gera
    candidatas `PASS`/`SAFE_PASS`/`PROGRESSIVE_PASS`/`RECYCLE`/`SWITCH_SIDE` (a partir das
    linhas de passe da Fase 2) mais `CARRY` e `HOLD` (a partir da pressão sobre o portador);
    `action-thresholds.ts` centraliza os limiares de classificação reusados pelo cálculo do
    score, para os dois nunca divergirem
  - `decision-score.config.ts` (Tarefa 13) — pesos dos 6 componentes do `DecisionScore`
    versionados (`DECISION_SCORE_CONFIG_VERSION`), somando exatamente 1.0 (validado por teste);
    `decision-score.calculator.ts` computa `possessionSafety`/`progression`/`spaceCreation`/
    `defensiveBalance`/`futureOptions`/`pressureManagement` reaproveitando os avaliadores da
    Fase 2 — nenhum peso solto em outro arquivo
  - `decision-classification.ts` (Tarefa 14) — 6 faixas (`EXCELLENT`→`MAJOR_ERROR`) exatamente
    como especificado no plano original
  - `decision.evaluator.ts` (Tarefa 15) — `evaluateDecision()`: o chamador só informa QUAL ação
    foi tomada (tipo + alvo), nunca risco/recompensa (sempre recalculados); retorna `null`
    quando a ação informada não corresponde a nenhuma candidata gerada — implementação direta
    da regra "sem confiança suficiente, não gerar avaliação conclusiva" (Tarefa 15/30)
  - `decision-tree.evaluator.ts` (Tarefa 16) — `buildDecisionTree()`: horizonte curto
    (`depth=2`, `topActions=3` por padrão), poda simples por construção (máx.
    `topActions^depth` nós); limitação documentada no próprio código — não simula reação real
    do adversário, só troca o portador da bola para o alvo da ação entre níveis
  - `tactical-sequence.detector.ts` (Tarefa 17) — `detectTacticalSequences()`: 5 dos 6 padrões
    do plano original (`SWITCH_OF_PLAY`, `CIRCULATION_UNDER_PRESSURE`, `CENTRAL_PROGRESSION`,
    `PRESSURE_ESCAPE`, `DANGEROUS_LOSS`); `DEFENSIVE_RECOVERY` fica só no vocabulário de tipos,
    sem detector — o `ActionGenerator` não modela ações do time sem a posse, não há dado de
    onde inferir isso com honestidade
  - **Bug real encontrado e corrigido durante os testes desta fase**: a fórmula original de
    `pressureManagement` dava 100 para `HOLD` e só 50 para qualquer outra ação mesmo com
    pressão adversária zero — enviesando o motor a sempre preferir "segurar a bola" mesmo sem
    necessidade nenhuma. Corrigido para as duas opções empatarem perto de 100 quando não há
    pressão real a gerenciar, só divergindo sob pressão de fato (ver comentário em
    `decision-score.calculator.ts`)
  - 44 novos testes (118 → 162 no módulo `tactical-engine`; 207 na suíte completa da API) —
    sem regressão; `tsc --noEmit` e `nest build` validados

### Notes
- Cenário do "critério principal de sucesso" (`docs/tactical-engine-domain.md`) coberto por
  teste de ponta a ponta em `decision.evaluator.spec.ts`: passe central bloqueado sob pressão
  avaliado como pior opção que o passe lateral seguro, com `scoreDifference` negativo
- Próxima fase (Princípios estratégicos — Tarefas 18–22: catálogo de princípios inspirado em
  xadrez, iniciativa, overload/switch, padrões do jogador entre partidas, perfil estratégico)
  só avança depois de revisão do usuário desta Fase 3

## [0.40.0] — 2026-08-13

### Added
- **Tactical Engine — Fase 2 (Inteligência espacial)**: cinco avaliadores geométricos
  determinísticos sobre `TacticalGameState` — nenhum usa IA generativa (ver
  `docs/tactical-engine-domain.md`). Continua sem nenhum controller/endpoint público; consumido
  só internamente até a Fase 3 (motor de decisões) plugar isso em ações candidatas.
  - `geometry.util.ts` — `euclideanDistance`, `projectionParameter`/`perpendicularDistance`
    (geometria de ponto-reta reusada pelas linhas de passe) e `clamp`, com testes próprios
  - `passing-lanes.evaluator.ts` (Tarefa 7) — `evaluatePassingLanes()`: para cada companheiro do
    portador, calcula `distance`, `obstructionRisk` (adversário entre os dois, dentro de um
    corredor de 0.06), `pressureRisk` (proximidade do adversário mais próximo do receptor) e
    `progressionValue` (avanço em direção ao ataque); `score` 0–100 combina os três. Cenário do
    enunciado (`docs/tactical-engine-domain.md`) validado por teste: passe lateral livre tem
    score maior que passe central bloqueado
  - `pressure.evaluator.ts` (Tarefa 8) — `evaluatePressure()`: classifica `LOW`/`MEDIUM`/`HIGH`/
    `CRITICAL` a partir da distância ao adversário mais próximo e da contagem dentro de um raio
    de 0.15; `nearestOpponentDistance: number | null` (nunca inventa "distância infinita" quando
    não há adversário no estado)
  - `space.evaluator.ts` (Tarefa 9) — `evaluateSpace()`: usa as 15 `PitchZone` já existentes como
    grid (sem malha independente), calcula `occupation`/`pressure`/`freeSpace`/`goalProximity` por
    zona e ordena por valor estratégico decrescente
  - `numerical-advantage.evaluator.ts` (Tarefa 10) — `evaluateNumericalAdvantage()` (zona exata) e
    `evaluateNumericalAdvantageAroundBall()` (zona da bola + vizinhança de Moore via novo
    `getNeighboringZones()` em `pitch-zone.ts`) — cenário do enunciado (3×2) coberto por teste
  - `defensive-balance.evaluator.ts` (Tarefa 11) — `evaluateDefensiveBalance()`: conta jogadores
    atrás da bola, cobertura central, dispersão lateral e adversários "livres" (sem marcador do
    usuário num raio de 0.15) à frente da bola; produz `DefensiveSafetyScore` 0–100. Cenários
    "reciclagem segura" (score > 75) e "contra-ataque 3×2" (score < 40) cobertos por teste
  - `getAllPitchZones()`/`getNeighboringZones()` novos em `pitch-zone.ts` — vizinhança de Moore
    (3×3, incluindo diagonais) reusada pela superioridade numérica
  - 45 novos testes (83 no total do módulo `tactical-engine`, 154 na suíte completa da API) —
    sem regressão; `tsc --noEmit` e `nest build` validados

### Notes
- Pesos de cada avaliador (ex.: `WEIGHT_OBSTRUCTION`, `WEIGHT_PLAYERS_BEHIND`) vivem como
  constantes locais no próprio arquivo do avaliador — a Tarefa 13 (Fase 3) que introduz
  configuração *central* versionada é especificamente para o `DecisionScore` agregado por ação,
  um conceito diferente destes sub-scores
- Próxima fase (Motor de decisões — Tarefas 12–17: ações candidatas, `DecisionScore`,
  classificação, comparação real × alternativas, árvore de curto horizonte, sequências táticas)
  só avança depois de revisão do usuário desta Fase 2

## [0.39.0] — 2026-08-13

### Added
- **Tactical Engine — Fase 1 (Fundação)**: novo subdomínio inspirado em princípios de xadrez,
  traduzidos para futebol digital, que evolui o Coach Play de "detector de erros" para "sistema
  de inteligência de decisão" (avaliar decisão tomada × alternativas disponíveis, não só apontar
  erro). Plano completo em `docs/tactical-engine-domain.md`; auditoria pré-implementação em
  `docs/tactical-engine-current-state.md`. Só fundação nesta rodada — nenhuma avaliação tática
  real ainda (isso entra nas Fases 2–4, ver roadmap no fim desta entrada).
  - **Achado crítico da auditoria**: não existe, em nenhum lugar do projeto, detecção real de
    posição de jogadores/bola — `GameAnalysisService.analyzeMatch` (pipeline de upload) é
    inteiramente sintético (categoria = posição do frame na lista, erro a cada 3 eventos de
    risco, `confidence: 0.5` fixo, com `TODO` já admitindo isso no próprio código); o pipeline de
    captura em tempo real (`capture-sessions`) só faz diff de pixels agregado (menu vs. partida
    rodando, pico de movimento), sem semântica espacial. Decisão de arquitetura resultante: o
    Tactical Engine é construído e testado inteiramente contra fixtures determinísticas, isolado
    atrás de uma interface (`TacticalStateProvider`) sem nenhuma implementação real ainda — não
    acoplado a `game-analysis`/`capture-sessions`.
  - `apps/api/src/modules/tactical-engine/` (novo módulo, estrutura flat — mesmo padrão dos
    demais módulos do projeto, não a estrutura em camadas documentada mas nunca usada em
    `docs/ARCHITECTURE.md`; decisão confirmada com o usuário):
    - `pitch-coordinate.type.ts` — `PitchCoordinate` normalizada (x/y em [0,1]) +
      `isValidPitchCoordinate`
    - `pitch-zone.ts` — `getPitchZone()` (15 zonas: 3 terços × 5 corredores), `invertPitchSide()`,
      `pitchZoneEquals()`; lança erro explícito para coordenada fora de [0,1] (nunca corrige
      silenciosamente)
    - `tactical-game-state.type.ts` — `TacticalGameState`/`VirtualPlayer`, com nomenclatura que
      nunca confunde `User` (conta autenticada) com jogador virtual em campo (`VirtualPlayer`,
      qualificado por `team: 'user' | 'opponent'`)
    - `tactical-state-provider.interface.ts` — única costura para uma futura fonte real de dados
      (visão computacional); hoje sem implementação real, só fixtures de teste
    - `tactical-snapshots.service.ts` — persistência do `TacticalGameState` via Prisma
  - Prisma: `TacticalSnapshot`/`TacticalPlayer` (+ enums `TacticalPossession`/`TacticalTeam`),
    migration `20260813150732_add_tactical_engine`, índices em `matchId`, `(matchId,
    timestampMs)` e `createdAt` (este último preparando uma futura rotina de
    expurgo/agregação — sem política de retenção implementada ainda, risco documentado na
    auditoria)
  - `TacticalEngineModule` registrado em `app.module.ts` — sem controller/endpoint ainda (nada
    consome o módulo publicamente nesta fase)
  - 38 novos testes (`pitch-zone.spec.ts`, `tactical-snapshots.service.spec.ts`); suíte completa
    da API (16 suítes / 109 testes) e `tsc --noEmit`/`nest build` validados sem regressão

### Notes
- Roadmap completo (7 fases, 40 tarefas) descrito em `docs/tactical-engine-domain.md` — próxima
  fase (Inteligência espacial: linhas de passe, pressão, espaço livre, equilíbrio defensivo) só
  avança depois de revisão do usuário desta Fase 1
- Lint da API (`npm run lint`) falha hoje por falta de configuração do ESLint no projeto
  (`apps/api` não tem `.eslintrc*`) — pré-existente, não introduzido por esta mudança; não
  bloqueou a validação desta fase (build e type-check via `tsc --noEmit` passaram)

## [0.38.3] — 2026-07-22

### Fixed
- **Crítico — todo frame capturado pela extensão chegava corrompido na API**: `chrome.runtime.sendMessage` não transfere `ArrayBuffer` de forma confiável entre o content script (isolated world) e o service worker — o valor chegava do outro lado como um objeto genérico, e `new Blob([buffer])` em `background/backend-client.ts` serializava isso silenciosamente como a string `"[object Object]"` em vez dos bytes reais da imagem. Todo frame salvo em disco tinha exatos 15 bytes de texto, nunca um PNG — por isso `GameStateDetectorService` falhava em 100% das amostras com `Input file contains unsupported image format` (o que na 0.38.2 eu tinha diagnosticado incorretamente como "limiares não calibrados"; a causa real é esta, não calibração).
  - Corrigido convertendo o frame para base64 antes de mandar a mensagem (`src/shared/binary.ts`, novo: `arrayBufferToBase64`/`base64ToArrayBuffer`) — uma string comum já é serializada corretamente pela API de mensagens, diferente do `ArrayBuffer` cru
  - `content/index.ts` codifica o frame antes de enviar; `background/index.ts` decodifica antes de repassar para `BackendClient.uploadFrame`; `ContentFramePayload.buffer: ArrayBuffer` virou `ContentFramePayload.base64: string`
  - 3 novos testes de round-trip (`tests/binary.spec.ts`) — total 8 testes em `apps/extension`
  - Limpeza: os 736 arquivos de frame corrompidos (15 bytes cada) e os registros correspondentes em `frame_samples` (todos com `gameState: null`, nenhum jamais analisado) removidos do ambiente de teste local

### Notes
- Esta correção não foi validada ainda contra uma sessão real (precisa recarregar a extensão + reabrir a aba do Xbox do zero, mesmo cuidado da validação anterior) — próximo passo antes de seguir para a calibração de limiares de verdade
- `apps/desktop` usa um transporte diferente (IPC do Electron via `ipcRenderer.invoke`, não `chrome.runtime.sendMessage`) para o mesmo tipo de dado — não há evidência de que tenha o mesmo bug, mas também não foi verificado; fica como algo a confirmar se/quando o desktop for testado com `matchId`

## [0.38.1] — 2026-07-22

### Added
- **Login da extensão: mostrar/ocultar senha + salvar senha pelo gerenciador do Chrome** (`apps/extension/src/popup/popup.ts`), achado ao validar o login pela primeira vez contra a API real:
  - Botão de olho (👁/🙈) alterna `type="password"`/`type="text"` no campo de senha, mesmo padrão já usado no login web (`apps/web`)
  - Campos de login passaram a viver dentro de um `<form>` real com `submit` (antes era só um `<div>` com clique no botão) — é isso que faz o Chrome oferecer "Salvar senha para este site?"; o Coach Play continua sem guardar a senha em nenhum lugar (mesmo princípio já documentado para o `apps/desktop`), quem passa a lembrar/preencher é o próprio gerenciador de senhas do navegador

## [0.38.0] — 2026-07-22

### Added
- **Vínculo da sessão de captura com uma `Match`** — fecha o gargalo que bloqueava o valor de ponta a ponta dos dois caminhos de captura (`apps/desktop` e `apps/extension`): até aqui, nenhum dos dois tinha uma tela para criar/escolher uma partida antes de iniciar, então `GameEvent`/`CoachFeedback` nunca eram persistidos mesmo com a classificação de estado/eventos funcionando (`CaptureSessionsModule` já aceitava `matchId` desde a Fase 1, só não havia UI que o preenchesse).
  - `apps/desktop`: nova tela `MatchSelector` entre o consentimento e a seleção de fonte — lista partidas pendentes do usuário (`GET /matches?status=pending`) ou cria uma nova (`POST /matches`, só título opcional); `matchId` escolhido flui por `App.tsx` → IPC `capture:start` → `CaptureSessionManager.start()` → `BackendClient.createCaptureSession`. Novos canais IPC `matches:list`/`matches:create` (`ipc-channels.ts`, `ipc-handlers.ts`, `preload/index.ts`, `coach-play-api.d.ts`)
  - `apps/extension`: mesmo fluxo no popup — `renderSelectMatch` lista/cria partidas via novas mensagens `matches:list`/`matches:create` (`background/index.ts`, `background/backend-client.ts`) antes de `renderStart`, que agora exige `matchId` e o envia em `CAPTURE_START`
  - Nenhuma rota nova no backend — `CreateCaptureSessionDto.matchId` e `CaptureSessionsService.assertMatchOwner` já existiam e nunca tinham um cliente que os usasse de fato
  - Builds (`tsc`/`esbuild`) e as suítes existentes de `apps/desktop` (15 testes) e `apps/extension` (5 testes) validados sem regressão; nenhum teste novo — a mudança é toda de UI que orquestra chamadas já cobertas ou é fetch simples sem lógica própria (mesmo padrão de `backend-client.ts`, que também não tinha testes unitários)

### Notes
- Ainda não validado contra uma sessão real de Remote Play com `matchId` de ponta a ponta (nem `apps/desktop` nem `apps/extension` tiveram essa validação manual completa nesta rodada) — próximo passo natural antes de considerar o pipeline de captura "completo" é repetir a validação manual da 0.35.0 já com uma partida vinculada, confirmando que `GameEvent`/`CoachFeedback` aparecem em `/matches/:id`
- Roadmap restante em `docs/REMOTE_PLAY_CAPTURE.md`: geração automática de `VideoSegment` a partir de eventos, calibração dos limiares de detecção com captura real, Fase 3 (voz/tracking) e Fase 4 (modelo próprio)

## [0.37.0] — 2026-07-21

### Added
- **Novo workspace `apps/extension`: extensão Chrome (Manifest V3) para captura via Remote Play direto na aba**, caminho alternativo ao `apps/desktop` para o fluxo via navegador (`xbox.com/.../play/...`). Resolve estruturalmente a limitação de foco encontrada na validação manual do desktop (CHANGELOG 0.35.0): o Remote Play pausa o stream quando a janela que tem foco não é a dele, e uma extensão nunca precisa roubar o foco da aba pra pausar/encerrar a captura, porque roda dentro dela. Plano e trade-offs em `docs/REMOTE_PLAY_CAPTURE.md`.
  - `src/background/` (service worker): `BackendClient` reaproveita os mesmos endpoints já usados pelo `apps/desktop` (`POST /auth/login`, `POST /capture-sessions`, `PATCH .../{pause,resume,stop}`, `POST .../frames`) — nenhuma rota nova no backend; `SessionStore` guarda token e estado da sessão em `chrome.storage.session` (só memória do navegador, nunca disco, some ao fechar o Chrome — mesmo princípio de privacidade do token do desktop guardado só em memória do processo main)
  - `src/content/index.ts` injetado em `xbox.com/*/play/*`: `pickBestVideoIndex` (`src/shared/video-picker.ts`) escolhe qual `<video>` da página é o player do Remote Play (maior área de exibição entre os que estão de fato tocando), sem depender de um seletor CSS específico do Xbox que pode mudar a qualquer momento; amostra frames via `<canvas>`/`toBlob` e envia ao background por `chrome.runtime.sendMessage`
  - `src/popup/` — UI sem framework (HTML/DOM puro, proporcional ao tamanho da tela): login, tela de consentimento com o mesmo texto de transparência já usado no desktop (só pixels da aba, sem engenharia reversa do Xbox/EA FC), controles iniciar/pausar/retomar/encerrar
  - `elapsedMs` desde o início da sessão (nunca `Date.now()` absoluto) já usado desde a primeira versão do content script — evita de origem o overflow de `INT4` que só foi descoberto no `apps/desktop` durante a validação manual (CHANGELOG 0.35.0)
  - 5 testes (`video-picker.spec.ts`) — única lógica pura testável sem um navegador real; build (`tsc` + `esbuild` via `npm run build --workspace=apps/extension`) validado
  - `package.json` raiz: novos scripts `build:extension`/`test:extension`

### Notes
- Carregar a extensão em `chrome://extensions` e validar contra uma sessão real de Xbox Remote Play (login, consentimento, captura ao vivo) ainda depende de teste manual no navegador do usuário — este ambiente de desenvolvimento não tem GUI de navegador, mesma situação que o `apps/desktop` teve até a validação da 0.35.0
- Trade-off já discutido em `docs/REMOTE_PLAY_CAPTURE.md`: a extensão cobre só o fluxo via navegador (`xbox.com/play`), não o app nativo Xbox no Windows, que continua exigindo o `apps/desktop`
- Mesmo gap dos dois caminhos de captura permanece: sessão sem `matchId` associado, então `GameEvent`/`CoachFeedback` continuam não sendo persistidos mesmo com a captura funcionando — vira a próxima prioridade do roadmap (ver `docs/CURRENT_STATE.md`)

## [0.36.2] — 2026-07-20

### Added
- **Logo de verdade em uso pela primeira vez.** A partir de `Logo coach play.png` (já existente
  na raiz do repo, nunca usada em nenhuma tela), gerados via crop (só o emblema, sem a palavra
  "COACH PLAY", que não caberia legível num badge pequeno):
  - `apps/web/public/logo-mark.png` — emblema quadrado, usado nos badges de
    login/register/reset-password/forgot-password e na sidebar (antes eram só um `<span>C</span>`
    num quadrado com gradiente CSS)
  - `apps/web/public/logo-full.png` — logo completa (emblema + wordmark), para usos futuros
  - `favicon.ico` + `apple-touch-icon.png` + `icon-192/512.png` — gerados do mesmo emblema,
    configurados via `metadata.icons` em `app/layout.tsx`

### Fixed
- **Badge da logo aparecia corrompido/em branco no navegador** (achado ao validar a troca acima):
  `middleware.ts` só excluía `api`, `_next/static`, `_next/image` e `favicon.ico` do seu matcher
  — qualquer outro arquivo estático de `public/` (como o novo `logo-mark.png`) caía no middleware
  normal e, sem sessão ativa, era redirecionado pra `/login`. O otimizador de imagem do Next.js
  então recebia HTML no lugar do PNG ao processar o `<Image>`, resultando num badge corrompido.
  Corrigido excluindo qualquer caminho com extensão de arquivo do matcher (não mais uma lista
  fixa de 4 exceções) — protege contra o mesmo problema pra qualquer asset futuro em `public/`.
- **Conta de admin criada em produção**: `fasterdrible@gmail.com` cadastrada via `/register` no
  ambiente real e promovida a `role = 'admin'` diretamente no banco (mesmo procedimento usado no
  ambiente local) — banco de produção era zerado (só os planos do seed), nenhuma conta migrada
  do ambiente de desenvolvimento.

## [0.36.1] — 2026-07-20

### Fixed
- **`coachplay-web` inacessível pelo nginx compartilhado mesmo com o container saudável**:
  o Next.js standalone usa a env var `HOSTNAME` como endereço de bind, e o Docker define
  `HOSTNAME` automaticamente como o ID do container. Como `coachplay-web` está em duas redes
  (`internal` + a rede do nginx compartilhado, `easysub_easysub`), esse ID resolve para **dois**
  IPs em `/etc/hosts` — o servidor só faz bind no primeiro (`172.22.0.5`, a rede interna),
  ficando inacessível pela rede do nginx (`172.20.0.9`, connection refused mesmo com IP e DNS
  corretos). Corrigido com `HOSTNAME: 0.0.0.0` explícito no serviço `web`, forçando bind em
  todas as interfaces — aplicado em `docker-compose.vps.yml` e, por robustez, também em
  `docker-compose.prod.yml`.
- Nota operacional: toda vez que `coachplay-web`/`coachplay-api` é recriado, o IP na rede
  compartilhada muda — o `easysub-nginx-1` resolve o hostname uma vez e cacheia, então precisa
  de `docker exec easysub-nginx-1 nginx -s reload` depois de qualquer recreate desses containers
  (documentado em `docs/DEPLOY_SHARED_VPS.md`).

## [0.36.0] — 2026-07-20

### Added
- **Primeiro deploy em produção real: https://coachplayals.com.br.** O VPS usado já hospeda
  outros projetos (não é dedicado ao Coach Play), então em vez de `docs/DEPLOY.md` (que assume
  nginx/certbot próprios), foi criado um caminho alternativo documentado em
  `docs/DEPLOY_SHARED_VPS.md`:
  - `docker-compose.vps.yml` (novo) — sem serviços `nginx`/`certbot` próprios; containers
    renomeados (`coachplay-postgres`, `coachplay-redis`, `coachplay-api`, `coachplay-web`)
    conectados também à rede Docker do nginx que já roda no VPS pra outro projeto, evitando
    o conflito de porta 80/443 que o `docker-compose.prod.yml` original causaria
  - `deploy/nginx/coachplay-shared-vps.conf.template` (novo) — vhost pro nginx compartilhado,
    sem depender de webroot pro desafio ACME
  - Certificado TLS emitido via desafio **DNS-01** (`certbot-dns-cloudflare`, token de API restrito
    à zona do domínio) em vez de webroot — não exige nenhuma mudança no nginx que já estava no ar,
    e mantém renovação automática funcionando (diferente do DNS-01 manual, que exigiria repetir a
    validação a cada renovação)

### Fixed
Dois bugs de produção encontrados nesta validação, nenhum coberto antes porque ninguém tinha
rodado um build limpo/deploy real desde as mudanças que os introduziram:

- **`apps/api/Dockerfile` e `apps/web/Dockerfile`**: `npm ci` rodava antes de
  `apps/api/prisma/schema.prisma` existir no contexto de build. O `postinstall: prisma generate`
  do `apps/api/package.json` (adicionado na 0.29.0 pra corrigir o build na Vercel) dispara em
  **qualquer** `npm ci` na raiz do workspace — inclusive ao buildar só a imagem do `web`, que nem
  usa Prisma diretamente. Corrigido: `COPY apps/api/prisma apps/api/prisma` antes do `RUN npm ci`
  nos dois Dockerfiles.
- **`docker-compose.prod.yml`** (bug pré-existente, não só na variante nova): o serviço `web`
  também lê o `.env` compartilhado com a API via `env_file`, que tem `PORT=3001` (pensado só pra
  API) — o Next.js standalone herdava essa porta em vez de 3000, e o `proxy_pass` do nginx pro
  `web:3000` retornava 502. Corrigido com `environment: PORT: 3000` explícito no serviço `web`
  (sobrepõe o valor herdado do `.env` compartilhado). Afeta qualquer deploy de VPS dedicado feito
  com a versão anterior deste arquivo.

### Notes
- Testado de ponta a ponta contra o domínio real: `/login` (200), `/api/v1/plans` (401, rota
  protegida respondendo corretamente), redirect de `/` sem sessão ativa. Certificado válido até
  2026-10-18.
- Chaves de IA (Anthropic/OpenAI) deixadas propositalmente sem configurar via variável de
  ambiente em produção — a decisão foi configurá-las depois pelo painel admin (`/admin/usage`),
  já suportado desde a 0.30.0.
- A senha root do VPS foi compartilhada em texto durante a sessão de deploy (só para autorizar
  a chave SSH usada nos comandos) — recomendado trocá-la (`passwd`) por precaução, já que ficou
  registrada no histórico da conversa.

## [0.35.0] — 2026-07-20

### Fixed
Primeira validação manual do módulo de Captura via Remote Play num Windows real (login, consentimento,
seleção de janela, captura ao vivo contra uma sessão real de Xbox Remote Play via navegador). Achados —
nenhum coberto pela suíte automatizada, que só exercita cada peça isoladamente com dados mockados:

- **`apps/desktop` não tinha tela de login**: o fluxo ia direto de consentimento pra seleção de fonte,
  então toda tentativa de iniciar captura falhava com "Não autenticado" (erro só visível no log do
  processo main, a UI mostrava uma mensagem genérica de conexão). Nova `LoginScreen.tsx` como primeiro
  passo do app, autenticando via `POST /auth/login` já existente; token de acesso guardado só em memória
  do processo main (`BackendClient`), nunca em disco — mesmo princípio de privacidade já documentado em
  `docs/REMOTE_PLAY_CAPTURE.md`. Novo canal IPC `auth:login` (`ipc-channels.ts`/`ipc-handlers.ts`/`preload`).
- **Sessão travava para sempre depois do primeiro "Encerrar"**: `CaptureSessionState` é uma state machine
  de uso único (`stopped`/`failed` são terminais), mas `CaptureSessionManager` reaproveitava a mesma
  instância durante toda a vida do processo — qualquer tentativa de iniciar uma nova captura após encerrar
  a anterior lançava `InvalidTransitionError: não é possível ir de "stopped" para "running"`, exigindo
  reiniciar o app inteiro. Corrigido: `start()` cria uma `CaptureSessionState` nova quando o estado atual
  é terminal.
- **100% dos frames falhavam ao salvar**: o app mandava `Date.now()` (epoch absoluto, ~13 dígitos) como
  `timestampMs` de cada frame; a coluna é um `INT4` do Postgres (máx. ~2,1 bilhões) e todo upload
  estourava esse limite (`PrismaClientUnknownRequestError: Unable to fit integer value... into an INT4`),
  falha só visível no log da API, nunca na tela do app. Corrigido na origem: `CapturePreview.tsx` agora
  manda o tempo decorrido desde `snapshot.startedAt` (sempre pequeno, nunca estoura o `INT4`) em vez do
  epoch absoluto — sem migration, sem mudar o schema.
- **Trava em cascata no `CaptureFrameAnalysisWorker`**: mesmo com os dois bugs acima corrigidos, todo
  frame ficava com `analysisStatus: 'skipped'` para sempre, nunca `analyzed`. Causa: a busca do "frame
  anterior" pra calcular o diff de pixels exigia `analysisStatus: 'analyzed'` — mas o primeiro frame de
  qualquer sessão nunca tem um anterior (fica `skipped` por definição), e como esse filtro exige status
  `analyzed`, nenhum frame seguinte nunca encontra um anterior válido; a sessão inteira ficava presa em
  `skipped` de forma permanente. Corrigido: a busca do anterior agora é só por timestamp, sem exigir
  status (só precisamos do arquivo de imagem dele, não do resultado da análise). Novo teste de regressão
  em `capture-frame-analysis.worker.spec.ts`.

### Notes
- **Limitação real descoberta, não é bug nosso**: o Xbox Remote Play/Cloud Gaming pausa o stream
  sozinho quando a aba/janela perde foco ou visibilidade — comportamento do próprio produto (Microsoft),
  pra economizar banda e evitar input acidental enquanto o usuário "não está olhando". Como
  `apps/desktop` é uma janela separada, focá-la durante a partida (por exemplo pra pausar/encerrar a
  captura) pausa o jogo junto. Não há forma de evitar isso enquanto a captura depender de uma janela
  separada roubando o foco — ver `docs/REMOTE_PLAY_CAPTURE.md`, seção de riscos, e a decisão de priorizar
  uma extensão de navegador como próximo passo (roda dentro da própria aba, nunca precisa de foco).
- Após os 4 achados acima, a validação manual confirmou de ponta a ponta: login, consentimento, seleção
  de janela (incluindo listar de verdade uma aba real do Xbox Remote Play via `xbox.com/play`), preview
  ao vivo, início/pausa/retomada/encerramento de sessão, upload de frames e classificação de estado
  (`menu`/`match_running`) rodando sobre dados reais. `GameEvent`/`CoachFeedback` continuam não sendo
  gerados nesta validação porque a sessão de captura não tem `matchId` associado (gap já conhecido,
  documentado desde a 0.34.0) — não é um bug novo.

## [0.34.0] — 2026-07-18

### Added
- **Fase 2 do módulo de Captura via Remote Play: Game State Detector + Event Detector + feedback quase em tempo real.** Fecha o pipeline que a Fase 1 deixou pendente — até aqui, frames enviados pelo `apps/desktop` ficavam com `analysisStatus: pending` para sempre, sem nenhuma análise. Plano completo em `docs/REMOTE_PLAY_CAPTURE.md`.
- **`GameStateDetectorService`**: heurística de diferença de pixels (`sharp`) entre o frame atual e o anterior da mesma sessão, sempre com confidence score. Sem reconhecimento de HUD/cores específicas do EA FC (sem capturas reais disponíveis para calibrar) — dos 5 valores de `FrameGameState`, o heurístico MVP só emite `menu` (proxy "estático") e `match_running` (proxy "ativo"); `paused`/`replay`/`post_match` ficam reservados no schema.
- **`EventDetectorService`**: heurística de pico de movimento após atividade sustentada, com dois limiares de confiança independentes — um para persistir o `GameEvent`, outro mais alto para acionar a IA.
- **Fila BullMQ `capture-frame-analysis`**: novo worker consome cada `FrameSample` enviado (`CaptureSessionsService.addFrame` enfileira o job), encadeando detecção de estado → detecção de evento → geração de feedback. Sessões sem `matchId` associado classificam o `gameState` mas não geram evento/feedback (best-effort, não falha o job).
- **`AiCoachService.generateEventFeedback`**: reaproveita a cadeia de fallback Claude → GPT-4o → DeepSeek já usada por `analyzeMatch`, com prompt curto (uma frase) por evento. Limite de dicas por minuto reaproveita `UserPreferences.feedbackLevel` (silencioso/leve/normal/intensivo) — sem migration nova para esse campo.
- **Prisma**: novo enum `FrameGameState` + campos `gameState`/`motionScore` em `FrameSample`.
- 21 novos testes (detectores, worker, extensão de `AiCoachService` e `CaptureSessionsService`).

### Notes
- Os limiares de detecção (`STATIC_THRESHOLD`, `ACTIVE_THRESHOLD`, `SPIKE_THRESHOLD` e os dois de confiança) são placeholders validados só com imagens sintéticas em teste — precisam de calibração com captura real de Remote Play antes de considerar a detecção confiável em produção.
- Geração automática de `VideoSegment` a partir de eventos detectados (FFmpeg no `apps/desktop`) fica para uma rodada futura — `SegmentReason.event_detected` continua sem uso.

## [0.33.0] — 2026-07-17

### Added
- **Novo módulo: Captura via Remote Play** — base do app desktop que permite analisar partidas de EA FC no Xbox capturando a tela do PC (Xbox Remote Play oficial), sempre com consentimento explícito e sem qualquer engenharia reversa do console. Plano completo em `docs/REMOTE_PLAY_CAPTURE.md`.
- **Backend — `CaptureSessionsModule`** (novo): lifecycle completo de sessão de captura (`POST /capture-sessions`, `PATCH .../pause|resume|stop`, `GET .../status`), ingestão de frames e segmentos (`POST .../frames`, `POST .../segments`) e leitura de eventos/feedbacks por partida (`GET /matches/:id/events`, `GET /matches/:id/feedbacks`). State machine de status (`starting→running↔paused→stopped|failed`) validada no service; 12 novos testes.
- **Prisma**: 4 modelos novos (`CaptureSession`, `FrameSample`, `VideoSegment`, `CoachFeedback`) + `GameEvent` ganhou `captureSessionId`/`segmentId`/`evidence` para linkar com o novo pipeline sem quebrar o fluxo de upload de vídeo já existente.
- **`apps/desktop`** (novo workspace, Electron + TypeScript): app desktop de captura —
  - `capture-session-state.ts`: state machine pura da sessão local (sem dependência do Electron, 100% testável)
  - `local-server.ts`: servidor HTTP em `127.0.0.1` (só loopback) expondo `/local/capture/{sources,start,pause,stop,preview,health}`
  - `capture-session-manager.ts`: liga a state machine ao `desktopCapturer` do Electron e ao backend (`BackendClient`)
  - `frame-buffer.ts`: buffer circular (30s) com descarte automático de frames temporários
  - Renderer React: tela de consentimento (obrigatória antes de qualquer captura), seletor de fonte (janela/monitor, com preview em miniatura), preview ao vivo via `getUserMedia`, controles de pausar/retomar/encerrar
  - 15 testes automatizados (state machine + rotas do servidor local) — build completo (`tsc` + `esbuild`) validado

### Notes
- Captura real de uma janela do Xbox Remote Play **não foi testada neste ambiente de desenvolvimento** (sem GUI Windows nem Xbox Remote Play instalado) — precisa de validação manual no PC do usuário antes de considerar o MVP pronto. Ver "Riscos e limitações" em `docs/REMOTE_PLAY_CAPTURE.md`.
- Fases 2–4 (Game State Detector, Event Detector, IA de feedback, voz, modelo próprio) ficam documentadas no roadmap do plano, mas não implementadas nesta rodada — schema e endpoints de leitura já preparados para receber esses dados quando existirem.

## [0.32.0] — 2026-07-17

### Added
- **Selecionar tudo + exclusão em massa** em `(admin)/admin/logs`: checkbox no cabeçalho (com estado indeterminado quando só parte das linhas da página está marcada) e um por linha; barra de ação aparece quando há seleção, com "Excluir selecionados (N)" e "Cancelar". Reusa o `DELETE /audit-logs/:id` já existente — sem endpoint novo, os itens selecionados são excluídos em paralelo (`Promise.allSettled`) e o contador de falhas é reportado se algum não puder ser excluído
- Seleção é limitada à página atual (paginação de 15) e é limpa automaticamente ao trocar de página/filtro ou após a exclusão

### Fixed
- **`.gitignore` derrubava silenciosamente a rota `/admin/logs` do controle de versão**: o padrão `logs/` (pensado para uma pasta de log em runtime) também casava com `apps/web/src/app/(admin)/admin/logs/`, então esse arquivo nunca foi commitado desde que foi criado no módulo admin. Corrigido para `/logs/` (âncora só na raiz do projeto); `admin/logs/page.tsx` entra no controle de versão pela primeira vez nesta versão

## [0.31.0] — 2026-07-17

### Added
- **Excluir usuário** (admin): `DELETE /api/v1/users/:id` já existia no backend (soft delete via `deletedAt`) mas não tinha botão na tela `(admin)/admin/users`. Adicionado como item do novo menu suspenso
- **Excluir log de auditoria** (admin): novo `DELETE /api/v1/audit-logs/:id` (`@Roles('admin')`, hard delete — logs não têm soft delete) + `AuditLogsService.remove()`; botão de lixeira em cada linha de `(admin)/admin/logs`
- **Componente `DropdownMenu`** (`components/ui/dropdown-menu.tsx`) — novo, reutilizável: trigger customizável, fecha ao clicar fora ou `Esc`, item com variante `danger`, separador. Substitui o botão único "Bloquear/Ativar" da tela de usuários por um menu (ícone `⋮`) com "Bloquear/Ativar usuário" e "Excluir usuário" (vermelho, com confirmação)
- 2 novos testes (`audit-logs.service.spec.ts`) cobrindo exclusão de log existente e `NotFoundException` para log inexistente; total agora 37 testes

### Notes
- Ambas as exclusões pedem confirmação nativa do navegador (`window.confirm`) antes de executar — sem componente de modal customizado, para não introduzir uma dependência nova só para isso
- Testado de ponta a ponta via Playwright: abrir menu → excluir usuário de teste → linha some da tabela e contador decrementa; excluir log → linha some e contador decrementa

## [0.30.0] — 2026-07-17

### Added
- **Configuração de chaves de IA pelo painel admin** — a tela "Uso & IA" agora permite salvar/remover as chaves de API do Anthropic Claude, OpenAI GPT-4o e **DeepSeek** sem depender só de variáveis de ambiente:
  - Novo modelo `AppSetting` (Prisma, linha única `id: "global"`) armazenando `anthropicApiKey`/`openaiApiKey`/`deepSeekApiKey` **criptografados com AES-256-GCM** (chave derivada de `JWT_SECRET` — sem precisar de mais uma variável de ambiente)
  - `SettingsModule` (antes um stub vazio) ganhou `SettingsService` (`getAiProviderStatus`, `updateAiProviderKeys`, `getAnthropicKey`/`getOpenAiKey`/`getDeepSeekKey` com fallback para env var) e `SettingsController` (`GET`/`PUT /api/v1/settings/ai-provider`, `@Roles('admin')`)
  - `AiCoachService` refatorado de dois níveis de try/catch (Claude → GPT-4o) para um **loop sobre 3 provedores** (Claude → GPT-4o → DeepSeek); os clients deixaram de ser construídos uma vez no construtor (lendo só env var) e passaram a ser criados a cada chamada com a chave resolvida via `SettingsService` — uma chave configurada pelo painel entra em vigor na próxima análise, sem reiniciar o servidor
  - DeepSeek usa a própria SDK `openai` (API compatível), só trocando `baseURL` para `https://api.deepseek.com` e o modelo para `deepseek-chat`
  - UI em `(admin)/admin/usage/page.tsx`: status por provedor (configurada via painel/env var, com preview mascarado tipo `sk-a••••cdef`), campos para nova chave (`type="password"`, nunca preenchidos com o valor real) e ação de remover — grid de 3 colunas
  - 8 novos testes (`settings.service.spec.ts` + `ai-coach.service.spec.ts`) cobrindo status não configurado, fallback de env var, criptografar/decifrar/mascarar, remoção via string vazia e fallback em cascata Claude → GPT-4o → DeepSeek

### Fixed
- **Servidor de API em dev rodando um build antigo**: um processo `node dist/src/main` (sobra de teste de deploy anterior) estava com o lock da porta 3001, então o dev server real (`nest start --watch`) subia mas nunca respondia — todo o tráfego local ia para o bundle compilado desatualizado. Processos zumbis encerrados e um `dev:api` limpo reiniciado

## [0.29.0] — 2026-07-17

### Added
- `(dashboard)/settings/page.tsx` — tela de Configurações completa, substituindo o stub ("Task 2.x"):
  - Nome da conta (`PUT /users/:id`)
  - Nível de feedback (simples/normal/detalhado), modo de jogo favorito (mesma lista de modos EA FC do formulário de nova partida), feedback por voz (toggle) e idioma — tudo já suportado pelo backend (`UserPreferences`), só nunca tinha tela
  - Estados de carregamento, erro e confirmação de salvamento; testado de ponta a ponta (alterar → salvar → reload → confere que persistiu)

### Fixed
- **Build da API no Vercel/CI**: `nest build` rodava sem `prisma generate` antes, então `@prisma/client` ficava com o client "stub" genérico sem nenhum enum/model do schema (17 erros `TS2305`/`TS2694`). Adicionado `postinstall: prisma generate` e `build: prisma generate && nest build`
- **Timeout em todas as chamadas da API do frontend** (`lib/api.ts`, 15s) — sem isso, uma requisição pendurada (ex.: servidor reiniciando no meio de uma chamada) travava o `AuthProvider` no estado de carregamento para sempre, já que `/auth/me` nunca resolvia nem rejeitava
- `next.config.mjs` — `onDemandEntries` com janela de inatividade maior (1h) e mais páginas em buffer, reduzindo recompilações ao alternar entre abas/rotas em dev

### Notes
- A API (`apps/api`) não é adequada para o modelo serverless do Vercel — roda worker BullMQ persistente, spawna FFmpeg e grava vídeo em disco local. Documentado em `docs/DEPLOY.md`; o caminho de produção recomendado continua sendo o VPS via `docker-compose.prod.yml`

---

## [0.28.0] — 2026-07-17

### Added
- **Módulo administrador completo** (backend + frontend), substituindo os 4 stubs deixados na Fase 7:
  - `GET /api/v1/audit-logs` — lista paginada de logs de auditoria com filtro por módulo/ação (`AuditLogsController`, admin-only)
  - `GET /api/v1/admin/overview` — agregados de usuários (total/ativos/bloqueados/inativos), partidas (total/analisadas/processando/falha/aguardando), custo e contagem de análises de IA concluídas, e os 8 eventos de auditoria mais recentes (`AdminModule` novo)
  - `GET /api/v1/admin/usage` — consumo e custo estimado de IA por usuário, paginado (agregação em memória via `match.userId`, já que `AIAnalysis` não tem `userId` direto)
  - `(admin)/admin/page.tsx` — Dashboard Admin com os cards acima + lista de atividade recente
  - `(admin)/admin/users/page.tsx` — tabela de usuários com busca, filtro por status e ação de bloquear/ativar (`PATCH /users/:id/status`)
  - `(admin)/admin/logs/page.tsx` — tabela de auditoria com filtro por módulo, paginação e detalhe expansível do `metadata` de cada evento
  - `(admin)/admin/usage/page.tsx` — cards de custo total/médio + tabela de consumo por usuário
- 2 novas suites de teste (`admin.service.spec.ts`, `audit-logs.service.spec.ts`) — 9 testes cobrindo agregação de overview/usage e paginação/filtro de logs

### Notes
- Todas as rotas novas usam `@Roles('admin')`, testado manualmente com um usuário `player_free` recebendo 403
- Ação de bloquear/ativar testada de ponta a ponta (clique → persistência confirmada após reload → reversão)

---

## [0.27.0] — 2026-07-17

### Added
- Identidade visual NEX-ALS ("Dark Luxury UI") aplicada em todo o frontend e no manual do usuário:
  - `tailwind.config.ts` — tokens de cor (`ink`, `ink2`, `gold`/`gold-bright`/`gold-dim`, `violet`), gradiente `bg-luxury-radial` e `shadow-gold`
  - `layout.tsx` — tipografia trocada de Inter isolado para o par **Sora** (display, headings/marca) + **Inter** (corpo), via `next/font/google` com CSS variables
  - `globals.css` — glow ambiente dourado/violeta fixo atrás do conteúdo (elemento `fixed`, não `background-attachment: fixed` — mais estável entre engines)
  - `manual.html` — retrabalhado com a mesma paleta, mantido como tema único (dark luxury não tem variante clara)
- Reestilizadas todas as ~20 telas do app (auth, dashboard, partidas, evolução, plano, admin, componentes `Button`/`Input`/`Sidebar`): fundo quase-preto, cards em vidro (`bg-ink2/60` + `backdrop-blur`), bordas `white/8%`, acento dourado para ações primárias e navegação ativa, violeta para a seção "Administração"
- Cores semânticas de nota/status (verde/amarelo/vermelho) retonalizadas para os tons joia do manual (`#6fcf97`/`#e0954a`/`#e2718a`), mantidas semanticamente distintas do dourado de marca

### Fixed
- Corrigidas classes Tailwind malformadas geradas por uma substituição em lote (`bg-blue-600/15` virando um gradiente inválido em `matches/new`; `hover:bg-gray-800/50` com sufixo de opacidade duplicado)

### Notes
- `next build` e `next dev` não devem rodar simultaneamente no mesmo diretório — ambos compartilham `.next` e um `build` no meio de uma sessão de `dev` corrompe o cache do dev server (exigiu limpar `.next` e reiniciar)

---

## [0.26.3] — 2026-07-16

### Added
- `apps/web/public/manual.html` — manual do usuário completo e ilustrado (capturas reais de cada tela), servido como página estática pela própria aplicação
- Item **Manual** na barra lateral (`components/layout/sidebar.tsx`), entre "Meu Plano" e a seção de administração, abrindo o manual em nova aba — visível para qualquer usuário autenticado

---

## [0.26.2] — 2026-07-16

### Fixed
- **Crítico** — `(dashboard)/evolution/page.tsx` quebrava com `TypeError: Cannot read properties of undefined` sempre que havia pelo menos uma partida analisada. A causa: `prevInTime?.overallScore !== null` usa optional chaining só na leitura da propriedade — quando `prevInTime` é `undefined` (última posição da lista invertida), a expressão inteira avalia para `undefined !== null` (`true`), entrando no branch que acessa `prevInTime.overallScore` sem `?.` e derrubando a página. Corrigido nos dois pontos idênticos do arquivo (`Tendência por Partida` e a tabela de `Comparação de Partidas`) verificando a existência de `prevInTime` explicitamente antes de acessar a propriedade
- Encontrado ao gerar uma partida real de teste (vídeo sintético via FFmpeg) para popular o manual do usuário com capturas de tela reais — nenhum teste automatizado ou execução anterior do app tinha exercitado a tela de Evolução com dados de partida de fato

---

## [0.26.1] — 2026-07-16

### Fixed
- **Crítico** — o cookie `refresh_token` era emitido com `path: '/api/v1/auth'`, então o navegador nunca o enviava em navegações para `/dashboard` e demais rotas protegidas (só em chamadas de volta para `/api/v1/auth/*`). Isso fazia `middleware.ts` sempre concluir "sem sessão" e redirecionar de volta para `/login` mesmo logo após um login/registro bem-sucedido — em qualquer ambiente, não só local. Corrigido para `path: '/'` em `apps/api/src/modules/auth/auth.controller.ts`
- Encontrado e confirmado ao rodar a aplicação localmente pela primeira vez de ponta a ponta (API + frontend + Postgres/Redis reais) com um navegador real — nenhum teste automatizado existente cobria esse caminho, já que é puramente um efeito do escopo de cookie no navegador

---

## [0.26.0] — 2026-07-16

### Added
- `apps/api/Dockerfile` — build multi-stage de produção (Debian `bookworm-slim`; Alpine/musl é incompatível com os binários do `@ffmpeg-installer/ffmpeg`), com estágios `build` → `migrator` (mantém o Prisma CLI para `migrate deploy`/`db seed`) e `pruned`/`production` (`npm prune --omit=dev`)
- `apps/web/Dockerfile` — build multi-stage com `output: 'standalone'` do Next.js (Alpine)
- `docker-compose.prod.yml` — stack de produção: postgres/redis sem porta exposta ao host, `restart: unless-stopped`, serviço `migrate` sob demanda (`profiles: [tools]`), `nginx` (reverse proxy + TLS) e `certbot` (emissão/renovação automática)
- `deploy/nginx/coachplay.conf.template` — reverse proxy (`/` → web, `/api/` e `/uploads/` → api), redirect HTTP→HTTPS, `client_max_body_size 550M`
- `deploy/certbot/init-letsencrypt.sh` — bootstrap do primeiro certificado Let's Encrypt (dummy cert → nginx → cert real via webroot)
- `deploy/backup/backup-postgres.sh` — backup automático do PostgreSQL (`pg_dump` + gzip + rotação por `BACKUP_RETENTION_DAYS`), agendável via cron
- `docs/DEPLOY.md` — runbook completo de deploy em VPS
- `apps/api/prisma/migrations/20260716152320_init` — primeira migration Prisma do projeto
- `.dockerignore` (raiz) e variáveis de deploy (`DOMAIN`, `LETSENCRYPT_EMAIL`, `LETSENCRYPT_STAGING`, `BACKUP_DIR`, `BACKUP_RETENTION_DAYS`) em `.env.example`

### Fixed
Três bugs pré-existentes, nunca detectados porque a API e o frontend nunca haviam sido buildados/executados de fato antes desta tarefa:
- `apps/web/next.config.ts` não é suportado no Next.js 14.x (suporte a config em TypeScript só chegou no Next 15) — convertido para `next.config.mjs`
- `/login` chamava `useSearchParams()` fora de um `<Suspense>`, o que quebra `next build` em produção — refatorado no mesmo padrão de `/reset-password` (componente interno + `<Suspense>` no export default)
- Script `start` (`apps/api/package.json`) e o `CMD` do Dockerfile apontavam para `dist/main.js`; `nest build` gera `dist/src/main.js` — corrigido em ambos
- Não existiam migrations do Prisma no repositório; sem elas `prisma migrate deploy` não criava nenhuma tabela em um banco novo — gerada a migration inicial

### Notes
- Build das imagens `api`/`web`/`migrator` e o fluxo completo (`migrate` → `api` → `web`) foram validados localmente com Docker: aplicação da migration, boot da API contra Postgres/Redis reais, registro + login via HTTP, e a página `/login` servida pelo container do frontend

---

## [0.25.0] — 2026-07-16

### Fixed
- **Crítico** — `ThrottlerGuard` nunca estava registrado como guard global em `app.module.ts` (apenas `ThrottlerModule.forRoot` era configurado); na prática nenhum `@Throttle` tinha efeito, incluindo o do login. Adicionado `{ provide: APP_GUARD, useClass: ThrottlerGuard }` antes de `JwtAuthGuard`/`RolesGuard`
- `VideoProcessingWorker` — vídeo com duração acima de 90min (não reprocessável) agora é removido do disco via `unlink` em vez de permanecer indefinidamente após a falha
- `AuditLogsService.log` — erro de compilação TS no campo `metadata` (`Prisma.InputJsonValue`), identificado ao rodar a suite de testes

### Added
- `@Throttle` em `POST /auth/register` (5/min), `POST /auth/forgot-password` (3/min) e `POST /auth/reset-password` (5/min) — mitigam criação em massa de contas, spam de e-mail e brute-force de token
- `@Throttle` em `POST /matches/:id/video` (10/min) — endpoint caro (disco + fila) antes sujeito apenas ao limite default global
- `throttler-wiring.integration.spec.ts` — sobe um app Nest real (porta efêmera) reproduzindo o wiring de `app.module.ts` e confirma HTTP 429 após exceder `@Throttle` (regressão para o bug acima)

### Notes
- Revisão de exposição de dados sensíveis (Task 7.3): confirmado que `passwordHash` nunca é retornado em nenhuma rota (todas as queries usam `select` explícito), `HttpExceptionFilter` não vaza stack trace, cookies de refresh usam `httpOnly`/`secure`/`sameSite: strict`, e `assertOwner`/`assertCanAccess` cobrem matches e users — nenhuma mudança de código necessária nesse ponto
- Validação de upload (formato/tamanho/duração) já cobria os 3 critérios da Task 7.3; único ajuste foi a limpeza do arquivo em disco quando a duração excede o limite

---

## [0.24.0] — 2026-07-16

### Added
- Testes unitários (Jest) cobrindo os critérios da Task 7.2:
  - `shared/guards/jwt-auth.guard.spec.ts` — rota pública ignora auth; sem token/token inválido lança `UnauthorizedException`
  - `shared/guards/roles.guard.spec.ts` — admin acessa rota restrita, jogador recebe `ForbiddenException`
  - `modules/matches/matches.service.spec.ts` — usuário não vê/edita partida de outro usuário (`assertOwner`)
  - `modules/matches/video.config.spec.ts` — `videoFileFilter` aceita MP4/MOV/AVI e rejeita outros formatos
  - `modules/plans/guards/analysis-limit.guard.spec.ts` — HTTP 402 quando o plano Free atinge o limite mensal; libera abaixo do limite
  - `modules/ai-coach/ai-coach.service.spec.ts` — fallback Claude → GPT-4o quando Claude falha; `AIAnalysis.status = failed` quando ambos falham

### Fixed
- `AuditLogsService.log` — erro de compilação TS no campo `metadata` (Prisma `Json` não aceitava `Record<string, unknown>` diretamente); corrigido com cast para `Prisma.InputJsonValue`

---

## [0.23.0] — 2026-07-07

### Added
- `AuditLogsService.log(entry)` — grava eventos em `AuditLog` (userId?, module, action, ipAddress?, metadata?); best-effort, nunca derruba o fluxo principal em caso de falha
- `AuditLogsModule` agora `@Global` (mesmo padrão do `MailModule`), com `AuditLogsService` como provider/export

### Changed
- `AuthController` — `register`/`login` passam a logar `auth.register`/`auth.login` no sucesso e `auth.register_failed`/`auth.login_failed` (com IP e motivo) no erro; `logout` loga `auth.logout`
- `AuthService.register` — loga `plans.plan_assigned` ao vincular o plano Free na criação da conta (cobre "mudança de plano" no único ponto do sistema que atribui um plano hoje)
- `MatchesService.uploadVideo` — loga `matches.video_upload` (matchId, nome e tamanho do arquivo) após enfileirar o job de processamento
- `VideoProcessingWorker` — loga `game-analysis.analysis_completed` ao concluir a análise com sucesso e `video-processing.processing_failed` (matchId, mensagem de erro, tentativa) quando o job falha
- `AuthModule`, `MatchesModule`, `VideoCaptureModule` — importam `AuditLogsModule` explicitamente

### Notes
- Não existe hoje endpoint de upgrade/downgrade de assinatura — a auditoria de "mudança de plano" cobre apenas a atribuição inicial do plano Free no cadastro. Quando um fluxo de troca de plano for implementado, deverá chamar `AuditLogsService.log` com o mesmo padrão (`module: 'plans'`)

---

## [0.22.0] — 2026-07-07

### Added
- `(dashboard)/plan/page.tsx` — tela "Meu Plano" completa substituindo stub:
  - Card do plano atual com nome, preço formatado e badge de status da assinatura
  - Barra de progresso de consumo mensal (`analysesThisMonth / limit`) com cor semântica e aviso quando o limite é atingido
  - Cards de detalhes do plano: limite mensal de análises, duração máxima de vídeo, feedback ao vivo
  - Bloco de datas: início da assinatura e renovação (`expiresAt`), com fallback para planos sem data de expiração
  - Seção "Planos disponíveis" listando `GET /plans` com destaque no plano atual
  - 2 fetches paralelos via `Promise.allSettled`: `/subscriptions/me` + `/plans`

---

## [0.21.0] — 2026-07-07

### Added
- `PlansService.registerAnalysisUsage(matchId)` — registra 1 unidade de consumo em `UsageLog` (action `video_analysis`, resourceType `match`, resourceId `matchId`) a cada análise concluída
- `PlansService.countAnalysesThisMonth(userId)` — conta o consumo do mês corrente a partir do `UsageLog`, substituindo a contagem anterior via `Match.count`

### Changed
- `VideoProcessingWorker` — novo passo 5.1: chama `registerAnalysisUsage(matchId)` logo após `GameAnalysisService.analyzeMatch` marcar a partida como `analyzed`
- `AnalysisLimitGuard` — agora usa `PlansService.countAnalysesThisMonth()` em vez de duplicar a query de contagem; continua lançando HTTP 402 com detalhes de plano/limite quando o consumo mensal é atingido
- `PlansService.getMySubscription()` — reutiliza `countAnalysesThisMonth()` para manter o mesmo critério de consumo exibido em `/subscriptions/me`
- `VideoCaptureModule` — importa `PlansModule` para injetar `PlansService` no `VideoProcessingWorker`

---

## [0.20.0] — 2026-06-26

### Added
- `apps/api/prisma/seed.ts` — seed idempotente com 3 planos: Free (3 análises/mês, 45min), Pro (20, 90min, R$29.90), Premium (100, 90min + live feedback, R$79.90); usa `findFirst` + `update`/`create` porque `Plan.name` não é `@unique` no schema
- `PlansService.findAll()` — lista planos ativos ordenados por preço
- `PlansService.getMySubscription(userId)` — retorna subscription + plan + `usage` (analysesThisMonth, limit, limitReached) calculado com `Match.count` do mês corrente
- `PlansController` sem prefixo — `GET /plans` e `GET /subscriptions/me`
- `AnalysisLimitGuard` — guard NestJS que conta partidas analisadas no mês para o usuário, lança HTTP 402 com detalhes de plano/limite se excedido
- `PlansModule` — controller + providers + exports de `PlansService` e `AnalysisLimitGuard`

### Changed
- `MatchesController.POST :id/video` — decorado com `@UseGuards(AnalysisLimitGuard)` para bloquear upload quando limite mensal atingido
- `MatchesModule` — importa `PlansModule` para disponibilizar o guard
- `apps/api/package.json` — adicionado `"prisma": { "seed": "ts-node prisma/seed.ts" }` para `prisma db seed`

---

## [0.19.0] — 2026-06-26

### Changed
- `(dashboard)/evolution/page.tsx` — tela de evolução implementada (stub substituído):
  - Seletor de período: 7 / 30 / 90 dias (refetch ao trocar)
  - 3 cards: Partidas no Período, Melhor Nota (cor semântica), Tendência (delta primeira→última)
  - Chart SVG responsivo: polyline de `overallScore` com zonas verde/amarelo/vermelho, dots coloridos por nota, labels de data no eixo X (adaptados ao número de entradas), gradiente de área
  - "Desempenho por Categoria": 4 barras horizontais CSS ordenadas do mais problemático ao melhor
  - "Tendência por Partida": últimas 6 partidas com delta vs anterior (↑/↓), nota colorida, link para relatório
  - "Comparação de Partidas": tabela responsiva (Geral + Ata/Def/Pas/Dec ocultos em mobile) com indicador ↑↓= por linha
  - Empty state com CTA para nova partida quando sem dados no período

---

## [0.18.0] — 2026-06-26

### Added
- `(dashboard)/matches/[id]/page.tsx` — tela de relatório da partida:
  - Header: título, status badge, modo de jogo, placar, data
  - Nota Geral (grande) + 4 cards de categoria (Ataque, Defesa, Passe, Decisão) com cor semântica
  - Card "Resumo do Coach IA" com texto do AI e modelo utilizado (oculto se sem aiSummary)
  - Grid 2 colunas: "Erros Detectados" (ordenados critical→high→medium→low, com categoria, descrição e sugestão) + "Lances da Partida" (timeline com timestamp MM:SS, categoria e ícone, máx 15)
  - "Pontos Positivos" (oculto se nenhuma categoria ≥ 7.0)
  - "O que Treinar" (tip estática baseada em `report.mainProblem`, oculto se não disponível)
  - Estado de partida não analisada: guard visual com mensagem contextual por status
  - Loading spinner; estado de erro com back link
  - 2 fetches paralelos via `Promise.allSettled`: `/matches/:id` + `/matches/:id/report`

---

## [0.17.0] — 2026-06-26

### Changed
- `(dashboard)/dashboard/page.tsx` — dashboard completo substituindo stub:
  - Saudação dinâmica (Bom dia / Boa tarde / Boa noite) com primeiro nome + data formatada
  - 4 cards de estatísticas: Partidas Analisadas, Nota Média (com cor semântica), Erro Mais Frequente, Evolução Semanal (delta entre primeira e última nota da semana)
  - Card "Última Partida": placar, nota, status badge, link "Ver análise completa →" (só se analisado)
  - Card "Recomendação de Treino": foco na pior categoria com dica prática; empty state se sem dados
  - 3 chamadas paralelas via `Promise.allSettled`: `/reports/summary`, `/reports/evolution?days=7`, `/matches?limit=1`
  - Degradação graciosa: cada seção exibe "—" / empty state se os dados não estiverem disponíveis

---

## [0.16.0] — 2026-06-26

### Added
- `ReportsService.getMatchReport(matchId, user)` — verifica dono, exige `status = analyzed`, gera/retorna `MatchReport` com scores por categoria e resumo de IA
- `ReportsService.generateReport(matchId)` — chamado pelo worker; gera e persiste `MatchReport` a partir de `DetectedError[]` e `AIAnalysis.summary`
- `ReportsService.getEvolution(userId, days)` — evolução de scores dos últimos N dias (default 30, max 90)
- `ReportsService.getSummary(userId)` — estatísticas agregadas: total analisado, média geral, melhor/pior categoria, erro mais frequente via `groupBy`
- `ReportsController` sem prefixo — 3 rotas:
  - `GET /matches/:matchId/report` — relatório detalhado da partida
  - `GET /reports/evolution?days=N` — evolução de performance
  - `GET /reports/summary` — resumo geral
- `EvolutionQueryDto` — valida `days` (Int, 1–90, default 30)
- Score por categoria (base 10, deduções por erro): `attackScore`, `defenseScore`, `passingScore`, `decisionScore`, `overallScore` (média dos 4); mínimo de 1.0 por categoria
- `ReportsModule` (controller + providers + exports `ReportsService`)

### Changed
- `VideoProcessingWorker`: 8 etapas — step 7 = `ReportsService.generateReport()` após AI Coach; falha capturada sem cancelar a partida
- `VideoCaptureModule`: importa `ReportsModule`

---

## [0.15.0] — 2026-06-26

### Added
- `AiCoachService.analyzeMatch(matchId)` — busca `GameEvent[]` e `DetectedError[]` do banco, monta prompt tático em português e chama Claude Sonnet 4.6 via `@anthropic-ai/sdk`
- Fallback para GPT-4o (OpenAI) se Claude falhar; ambos os erros são logados antes de marcar `AIAnalysis.status = failed`
- Controle de custo por análise: `costEstimate = inputTokens × preço_entrada + outputTokens × preço_saída` (USD)
- `AIAnalysis` persistido com `summary`, `costEstimate`, `rawResponse`, `modelUsed`, `status` via upsert (suporte a re-análise)
- `AiCoachModule` (providers: `AiCoachService`, exports: `AiCoachService`)
- Dependências adicionadas: `@anthropic-ai/sdk ^0.51.0`, `openai ^4.85.0`

### Changed
- `VideoProcessingWorker`: 7 etapas agora (step 6 = AI Coach após game analysis; step 7 = cleanFrames); falha do AI Coach logada como warning sem cancelar a partida (game events já salvos)
- `VideoCaptureModule`: importa `AiCoachModule`; injeta `AiCoachService` no worker
- `AppModule`: importa `AiCoachModule`

### Notes
- Preços configurados como constantes em `ai-coach.service.ts`: Claude Sonnet 4.6 $3/M input, $15/M output; GPT-4o $2.50/M input, $10/M output
- Rodar `npm install` na raiz do monorepo para instalar `@anthropic-ai/sdk` e `openai`

---

## [0.14.0] — 2026-06-25

### Added
- `GameAnalysisService.analyzeMatch(matchId, framePaths)` — detecta eventos básicos por fase da partida e erros táticos, persiste `GameEvent` e `DetectedError` no banco via `createManyAndReturn`, atualiza `match.status = analyzed`
- Distribuição de categorias por fase: posicionamento (0–15%) → ataque (15–35%) → defesa (35–50%) → passe (50–65%) → finalização (65–82%) → decisão (82–100%)
- Detecção de erros: 1 a cada 3 eventos de risco (defesa, decisao, posicionamento), severidade cíclica low/medium/high com FK para o evento de origem
- `GameAnalysisModule` (providers: `GameAnalysisService`, exports: `GameAnalysisService`)
- Limpeza da análise anterior antes de reinserir para suporte a re-análise

### Changed
- `VideoProcessingWorker`: 6 etapas agora (extrai frames → marca video done → `analyzeMatch` → `cleanFrames`); retorno alterado de `string[]` para `void`
- `VideoCaptureModule`: importa `GameAnalysisModule`; injeta `GameAnalysisService` no worker
- `AppModule`: importa `GameAnalysisModule`

### Notes
- Detecção básica é stub; Task 4.4 substituirá com análise multimodal via Claude Sonnet 4.6

---

## [0.13.0] — 2026-06-25

### Added
- Fila `video-processing` com BullMQ + `@nestjs/bullmq`
- `VideoProcessingWorker` (`@Processor`) — fluxo: mark processing → validateVideo → update durationSeconds → extractFrames → mark video done; on error: mark match+video failed, rethrow para retry BullMQ
- `video-processing.constants.ts` — `VIDEO_PROCESSING_QUEUE`, `VIDEO_PROCESSING_JOB`, `VideoProcessingJobData`
- `BullModule.forRootAsync` em `AppModule` — parseia `REDIS_URL` da env (suporte a senha no URL)
- `MatchesService.uploadVideo` agora despacha job após upsert do `MatchVideo` com retry exponencial (3 tentativas, delay 5s/10s/20s)
- Resposta do upload alterada para `{ matchId, fileUrl, queued: true }` indicando que o processamento foi agendado

### Changed
- `MatchesModule`: adiciona `BullModule.registerQueue` para injetar a fila no `MatchesService`
- `VideoCaptureModule`: registra fila + worker, exporta `BullModule` para reuso

---

## [0.12.0] — 2026-06-25

### Added
- `VideoCaptureService` — serviço de extração de frames via FFmpeg
  - `getVideoDuration(filePath)` — lê duração em segundos via ffprobe
  - `validateVideo(filePath)` — valida duração (máx 90 min); cobre TODO deixado na Task 3.2
  - `extractFrames(matchId, videoPath)` — extrai 1 frame a cada 30s com filtro `fps=1/30`, JPEG `-q:v 2`, salva em `UPLOAD_DIR/frames/<matchId>/frame_XXXX.jpg`
  - `cleanFrames(matchId)` — remove diretório temporário de frames após análise
- `VideoCaptureModule` registrado globalmente em `AppModule`
- Dependências adicionadas: `fluent-ffmpeg`, `@ffmpeg-installer/ffmpeg`, `ffprobe-static`, `@types/fluent-ffmpeg`
  - Binários estáticos — sem necessidade de FFmpeg instalado no sistema

### Notes
- Rodar `npm install` na raiz do monorepo após este commit para instalar os binários FFmpeg

---

## [0.11.0] — 2026-06-25

### Added
- Tela "Nova Partida" (`/matches/new`): form com título, modo de jogo, data, placar (scoreUser × scoreOpponent)
- Drop zone de vídeo: drag & drop com highlight visual, fallback click-to-select, validação client-side de formato (MP4/MOV/AVI) e tamanho (500MB)
- Preview de arquivo selecionado: nome, tamanho formatado, botão de remoção
- Upload com progresso via `XMLHttpRequest` (`xhr.upload.onprogress`) — `fetch` não suporta progresso nativamente
- Máquina de estados `Phase`: idle → creating → uploading → done; cada fase tem UI dedicada
- Fase `uploading`: barra de progresso animada com percentual e nome do arquivo
- Fase `done`: confirmação visual + redirect automático para `/matches` após 1.8s
- Modos de jogo EA FC pré-configurados: Ultimate Team, Rivals, Champions, Squad Battles, Pro Clubs, Volta Football, Amistoso
- `[color-scheme:dark]` no date input para forçar picker dark no Chrome/Edge

---

## [0.10.0] — 2026-06-25

### Added
- Tela "Minhas Partidas" (`/matches`): lista paginada de partidas com busca por título (debounce 400ms) e filtro por status
- `MatchCard`: placar `scoreUser × scoreOpponent`, nota geral com cor (verde ≥7 / amarelo ≥5 / vermelho <5), modo de jogo, data, badge de status
- `StatusBadge`: ícones lucide + cores semânticas por status (pending/processing/analyzed/failed)
- Estado vazio diferenciado: sem partidas (com link para nova) vs. sem resultados com filtros ativos
- Paginação com botões Anterior / Próxima (só exibida quando totalPages > 1)
- Tratamento de erro com botão "Tentar novamente" (retryKey pattern)
- Cleanup de fetch com flag `cancelled` para evitar state update em componente desmontado
- "Ver análise →" habilitado apenas para partidas com `status === 'analyzed'`

---

## [0.9.0] — 2026-06-25

### Added
- `POST /api/v1/matches/:id/video` — upload multipart com multer: `fileFilter` (MP4/MOV/AVI), `limits.fileSize` (500MB), `diskStorage` em `UPLOAD_DIR/videos/`
- `MulterExceptionFilter` global — converte `MulterError` (e.g. `LIMIT_FILE_SIZE`) em 400 com mesma estrutura do `HttpExceptionFilter`
- `video.config.ts` — configuração de storage e fileFilter isolada; diretório criado de forma lazy no primeiro upload
- `MatchesService.uploadVideo()` — assertOwner → upsert `MatchVideo` → deleta arquivo antigo do disco (best-effort)
- `MatchesService.deleteFile()` — helper privado para remoção de arquivo ao substituir vídeo
- Servir uploads como assets estáticos em `/uploads` via `NestExpressApplication.useStaticAssets`
- BigInt serialization global em `main.ts` — `fileSize` (BigInt no Prisma) serializa como string no JSON

### Changed
- `main.ts`: tipado como `NestExpressApplication`; adicionados `MulterExceptionFilter`, `useStaticAssets` e BigInt override

---

## [0.8.0] — 2026-06-25

### Added
- `POST /api/v1/matches` — cria partida vinculada ao usuário autenticado
- `GET /api/v1/matches` — lista partidas do usuário com paginação (page/limit), filtro por status e busca por título
- `GET /api/v1/matches/:id` — detalhe completo (video, gameEvents ordenados por timestamp, errors, report); apenas dono
- `PUT /api/v1/matches/:id` — edita metadados da partida; apenas dono
- `DELETE /api/v1/matches/:id` — soft delete com `deletedAt`; apenas dono (204 No Content)
- DTOs: `CreateMatchDto`, `UpdateMatchDto`, `FindMatchesQueryDto` com validação class-validator + `@IsEnum(MatchStatus)`
- `MatchesService.assertOwner()` — verifica existência e propriedade antes de qualquer mutação

---

## [0.7.0] — 2026-06-25

### Added
- `(dashboard)/layout.tsx` — layout do dashboard com guarda de autenticação client-side: spinner durante hidratação, redirect para `/login` se sessão inválida
- `(admin)/layout.tsx` — layout admin com guarda de role: redireciona não-admins para `/dashboard`
- `components/layout/sidebar.tsx` — sidebar responsiva com navegação por ícone+label, estado ativo, seção admin condicional (role='admin'), avatar com inicial e botão de logout
- Páginas stub: `/evolution`, `/settings`, `/plan` (dashboard); `/admin`, `/admin/users`, `/admin/logs`, `/admin/usage` (admin)

### Changed
- `middleware.ts`: removida constante `ADMIN_ROUTES` não utilizada

---

## [0.6.0] — 2026-06-25

### Added
- `POST /auth/forgot-password` — gera token de reset (32 bytes, SHA-256, 1h), resposta genérica anti-enumeração
- `POST /auth/reset-password` — valida token, atualiza senha argon2, invalida todas as sessões em transação
- `PasswordResetToken` model no Prisma com campos `token_hash`, `expires_at`, `used_at`
- `MailService` (global) — em dev exibe link formatado no console da API; stub preparado para Nodemailer/Resend em produção
- `MailModule` (@Global) integrado ao AuthModule
- Tela `/forgot-password`: estado de confirmação pós-envio com instrução de verificar spam
- Tela `/reset-password`: lê `?token=` da URL, indicador de força de senha, Suspense para useSearchParams, 3 estados (form / sucesso / token inválido)
- Link "Solicitar novo link" contextual quando token está expirado

### Changed
- `.env.example`: adicionadas variáveis de e-mail SMTP

---

## [0.5.0] — 2026-06-24

### Added
- Tela de Cadastro completa: nome, email, senha, confirmar senha
- Indicador de força da senha em tempo real (4 critérios visuais com ícones Check/X)
- Toggle independente para mostrar/ocultar senha e confirmação
- Validação Zod: regex de senha + refine para confirmar senha
- `register()` adicionado ao `AuthProvider` e ao `AuthContextType`

---

## [0.4.0] — 2026-06-24

### Added
- Tela de Login completa: React Hook Form + Zod, toggle de senha (Eye/EyeOff), erro da API
- Redirect inteligente: preserva `?from=` para retornar à rota original após login
- `AuthProvider` + `useAuth`: React Context com hidratação inicial via `/auth/me`
- `lib/auth.ts`: utilitários de token no localStorage (getToken/setToken/clearToken)
- `lib/utils.ts`: `cn()` via clsx + tailwind-merge
- Componentes UI reutilizáveis: `Button` (4 variantes + loading) e `Input` (label + error)
- `middleware.ts`: agora usa cookie `refresh_token` (httpOnly) como indicador de sessão

### Changed
- `api.ts`: anexa `Authorization: Bearer <token>` automaticamente em todas as requisições
- `layout.tsx`: envolve a app com `AuthProvider`

---

## [0.3.0] — 2026-06-24

### Added
- Módulo Users completo: findAll (admin), findOne, update, updateStatus, remove
- `GET /users` — admin com paginação (page/limit) e filtro por search + status
- `PUT /users/:id` — edita nome e preferências em uma única transação (upsert)
- `PATCH /users/:id/status` — admin altera status via enum `UserStatus` do Prisma
- `DELETE /users/:id` — soft delete com `deletedAt` + status `inactive`
- Regra de acesso: `assertCanAccess()` impede usuário de acessar dados de outros
- `AuthUser` interface compartilhada em `shared/types/`
- DTOs: `UpdateUserDto`, `UpdateUserStatusDto`, `FindUsersQueryDto`

---

## [0.2.0] — 2026-06-24

### Added
- Módulo Auth completo: register, login, logout, refresh, getMe
- JWT (access 15min) + refresh token com rotação (7d em httpOnly cookie)
- Argon2 para hash de senha
- Rate limit 5 req/min no login via `@Throttle`
- Bloqueio de conta após 10 tentativas inválidas (30 minutos)
- `JwtAuthGuard` e `RolesGuard` registrados globalmente
- `RefreshToken` model no Prisma schema (SHA-256 hash, soft rotation)
- `@Public()`, `@CurrentUser()`, `@Roles()` decorators funcionais
- JwtStrategy (Passport) validando usuário no banco a cada request

### Changed
- `app.module.ts`: adicionados guards globais via `APP_GUARD`
- `schema.prisma`: adicionados `login_attempts`, `locked_until` ao User e model `refresh_tokens`

---

## [0.1.0] — 2026-06-24

### Added
- Scaffold completo do monorepo (apps/api, apps/web, packages/shared)
- `docker-compose.yml` com PostgreSQL 16, Redis 7, API e Web
- `.env.example` com todas as variáveis necessárias
- `AGENT.md` com contexto completo do projeto para sessões de IA
- `docs/ARCHITECTURE.md`, `docs/TASKS.md`, `docs/CURRENT_STATE.md`
- Backend NestJS: `main.ts`, `app.module.ts`, estrutura modular completa
- Prisma schema inicial com todas as tabelas: users, plans, subscriptions, matches, match_videos, game_events, detected_errors, ai_analyses, match_reports, usage_logs, audit_logs
- Stubs de todos os módulos: auth, users, matches, video-capture, game-analysis, ai-coach, reports, plans, audit-logs, settings
- Shared: PrismaModule, PrismaService, HttpExceptionFilter, JwtAuthGuard, RolesGuard, @CurrentUser, @Roles
- Frontend Next.js: layout raiz, page.tsx (redirect), middleware de proteção de rotas
- Telas scaffold: login, register, forgot-password, dashboard, matches list
- Cliente HTTP centralizado em `src/lib/api.ts`

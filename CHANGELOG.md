# Changelog — Coach Play

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

# Estado Atual — Coach Play

**Versão:** V.0.20.0
**Data:** 2026-06-26
**Fase:** Fase 3 — Partidas (em andamento)

---

## Concluído

### Fase 1 — Base
- [x] Documento de especificação do sistema (`Sistema Coach Play.txt`)
- [x] `AGENT.md` criado com contexto completo do projeto
- [x] Estrutura de docs criada (`docs/`)
- [x] Scaffold do monorepo (root `package.json`, estrutura de pastas)
- [x] `docker-compose.yml` com PostgreSQL 16, Redis 7, API, Web
- [x] `.env.example` com todas as variáveis necessárias
- [x] `.gitignore` configurado
- [x] Backend NestJS scaffoldado (`apps/api`)
  - [x] `main.ts` com Helmet, CORS, ValidationPipe, cookie-parser
  - [x] `app.module.ts` com todos os módulos registrados
  - [x] Prisma schema completo (11 tabelas)
  - [x] PrismaModule + PrismaService (shared)
  - [x] HttpExceptionFilter global
  - [x] JwtAuthGuard e RolesGuard
  - [x] Decorators @CurrentUser e @Roles
  - [x] Stubs de todos os 10 módulos de domínio
- [x] Frontend Next.js scaffoldado (`apps/web`)
  - [x] Layout raiz com Tailwind/fontes
  - [x] Middleware de proteção de rotas
  - [x] Cliente HTTP centralizado (`lib/api.ts`)
  - [x] Scaffold das telas: login, register, forgot-password, dashboard, matches
- [x] `packages/shared` inicializado

---

## Concluído na Fase 2

### Task 2.1 — Módulo Auth (backend)
- [x] `POST /api/v1/auth/register` — cria usuário + subscription Free (argon2, email único)
- [x] `POST /api/v1/auth/login` — JWT 15min + refresh token 7d em httpOnly cookie
- [x] `POST /api/v1/auth/refresh` — rotação de refresh token
- [x] `POST /api/v1/auth/logout` — invalida refresh token no banco
- [x] `GET /api/v1/auth/me` — retorna usuário autenticado com plano
- [x] Rate limit: 5 req/min no endpoint de login (`@Throttle`)
- [x] Bloqueio após 10 tentativas inválidas (30 min, colunas `login_attempts` + `locked_until`)
- [x] `JwtAuthGuard` e `RolesGuard` globais em `app.module.ts`
- [x] `RefreshToken` tabela no schema Prisma
- [x] `@Public()` nas rotas abertas

---

### Task 2.2 — Módulo Users (backend)
- [x] `GET /api/v1/users` — admin lista usuários com paginação e filtro por status/nome
- [x] `GET /api/v1/users/:id` — usuário vê o próprio perfil; admin vê qualquer um
- [x] `PUT /api/v1/users/:id` — edita nome + preferências (upsert) em transação
- [x] `PATCH /api/v1/users/:id/status` — admin altera status (active/inactive/blocked)
- [x] `DELETE /api/v1/users/:id` — soft delete (deletedAt + status inactive)
- [x] Regra: usuário só acessa/edita o próprio perfil via `assertCanAccess()`
- [x] `AuthUser` type compartilhado em `shared/types/auth-user.type.ts`

---

### Task 2.3 — Tela de Login (frontend)
- [x] `AuthProvider` + `useAuth` — React Context global com login/logout/user state
- [x] Inicialização: lê token do localStorage, chama `/auth/me` para hidratar o usuário
- [x] `api.ts` — anexa `Authorization: Bearer <token>` em todas as requisições autenticadas
- [x] `lib/auth.ts` — utilitários de token no localStorage (get/set/clear)
- [x] `Button` e `Input` — componentes reutilizáveis com Tailwind
- [x] `lib/utils.ts` — `cn()` via clsx + tailwind-merge
- [x] Login page: form com RHF + Zod, toggle de senha, erro amigável, redirect pós-login
- [x] Redirect preserva `?from=` para retornar à rota original após login
- [x] `middleware.ts` — usa cookie `refresh_token` (httpOnly) como indicador de sessão
- [x] `layout.tsx` — envolve toda a app com `AuthProvider`

---

### Task 2.4 — Tela de Cadastro (frontend)
- [x] Form: nome, email, senha, confirmar senha com RHF + Zod
- [x] Validação: regex senha (maiúscula + minúscula + número + mínimo 8), refine confirmar senha
- [x] Indicador de força da senha em tempo real (4 critérios com Check/X)
- [x] Toggle mostrar/ocultar em senha e confirmação independentemente
- [x] `register` adicionado ao `AuthProvider` (chama `POST /auth/register`, salva token)
- [x] Redirect para `/dashboard` após cadastro com sucesso
- [x] Erro de e-mail duplicado exibido em banner amigável

---

### Task 2.5 — Recuperação de senha
- [x] `POST /auth/forgot-password` — gera token (SHA-256 hash, 1h), resposta idêntica para qualquer e-mail (anti-enumeração)
- [x] `POST /auth/reset-password` — valida token, atualiza senha com argon2, invalida todas as sessões ativas
- [x] `PasswordResetToken` model no Prisma (token_hash, expires_at, used_at)
- [x] `MailService` global — em dev loga o link no console; preparado para SMTP em produção
- [x] `MailModule` @Global registrado no AuthModule
- [x] Tela `/forgot-password`: form com e-mail + estado de confirmação pós-envio
- [x] Tela `/reset-password`: lê `?token=` da URL (Suspense), nova senha + confirmação + força, estados de erro/sucesso/token-inválido
- [x] Link direto "Solicitar novo link" exibido quando erro contém "expirado"

---

### Task 2.6 — Guards e proteção de rotas end-to-end
- [x] `JwtAuthGuard` global via `APP_GUARD` protege todas as rotas não marcadas com `@Public()`
- [x] `RolesGuard` global bloqueia rotas `@Roles('admin')` para usuários não-admin
- [x] `middleware.ts` redireciona rotas sem cookie `refresh_token` para `/login?from=<path>`
- [x] `(dashboard)/layout.tsx` — guarda client-side: spinner durante hidratação, redirect se sessão inválida
- [x] `(admin)/layout.tsx` — verifica `user.role === 'admin'`; redireciona não-admins para `/dashboard`
- [x] `components/layout/sidebar.tsx` — navegação com estado ativo, seção admin condicional, logout
- [x] Páginas stub criadas: `/evolution`, `/settings`, `/plan`, `/admin`, `/admin/users`, `/admin/logs`, `/admin/usage`

---

### Task 3.1 — Módulo Matches (backend)
- [x] `POST /api/v1/matches` — cria partida com userId do token
- [x] `GET /api/v1/matches` — lista paginada (page/limit), filtro por status, busca por título
- [x] `GET /api/v1/matches/:id` — detalhe com video, gameEvents, errors, report; 403 se não for dono
- [x] `PUT /api/v1/matches/:id` — edita metadados; 403 se não for dono
- [x] `DELETE /api/v1/matches/:id` — soft delete com `deletedAt`; 204 No Content
- [x] `assertOwner()` reutilizado em findOne, update e remove
- [x] DTOs: `CreateMatchDto`, `UpdateMatchDto`, `FindMatchesQueryDto` com `@IsEnum(MatchStatus)`

---

### Task 3.2 — Upload de vídeo
- [x] `POST /api/v1/matches/:id/video` — campo `video` (multipart/form-data)
- [x] Validação de formato: MP4 / MOV / AVI via `fileFilter` (mime type)
- [x] Limite de 500MB via `limits.fileSize` no multer
- [x] `diskStorage` salva em `UPLOAD_DIR/videos/<matchId>-<timestamp>.<ext>`
- [x] Upsert de `MatchVideo` — substitui vídeo existente e apaga arquivo antigo do disco
- [x] URL retornada: `/uploads/videos/<filename>` (asset estático servido pela API)
- [x] `MulterExceptionFilter` — trata erros de tamanho e formato antes de chegar ao controller
- [x] BigInt serialization — `fileSize` retorna como string no JSON
- [ ] Validação de duração (90min) — TODO Task 4.1 (requer FFprobe)

---

### Task 3.3 — Tela "Minhas Partidas" (frontend)
- [x] Grid responsivo (1 col mobile / 2 col sm / 3 col lg) com `MatchCard`
- [x] `MatchCard`: placar destacado, nota geral com cor semântica, modo de jogo, data, `StatusBadge`
- [x] `StatusBadge`: ícone + cor por status (pending/processing/analyzed/failed)
- [x] Busca por título com debounce 400ms
- [x] Filtro por status via `<select>` nativo com seta customizada
- [x] Paginação Anterior/Próxima (só renderizada se totalPages > 1)
- [x] Estado vazio: sem partidas (com CTA "Nova partida") vs. filtro sem resultados
- [x] Estado de erro com retry; fetch com flag `cancelled` para evitar memory leak
- [x] "Ver análise →" desabilitado enquanto `status !== 'analyzed'`

---

### Task 3.4 — Tela "Nova Partida" (frontend)
- [x] Form com metadados: título, modo de jogo (select EA FC), data, placar (scoreUser × scoreOpponent)
- [x] Drop zone com drag & drop, highlight visual e fallback click-to-select
- [x] Validação client-side: formato (MP4/MOV/AVI) e tamanho (500MB)
- [x] Preview do arquivo selecionado com nome, tamanho e botão de remoção
- [x] Upload via `XMLHttpRequest` com `onprogress` para barra de progresso em tempo real
- [x] Máquina de estados: idle → creating → uploading → done
- [x] UI dedicada por fase: form / criando (spinner) / enviando (barra de progresso) / sucesso (redirect)
- [x] Redirect automático para `/matches` após sucesso

---

### Task 4.1 — Extração de frames via FFmpeg
- [x] `getVideoDuration(filePath)` — lê duração em segundos via ffprobe
- [x] `validateVideo(filePath)` — valida duração máx. 90 min (cobre TODO da Task 3.2)
- [x] `extractFrames(matchId, videoPath)` — filtro FFmpeg `fps=1/30`, `-q:v 2`, frames em `UPLOAD_DIR/frames/<matchId>/`
- [x] `cleanFrames(matchId)` — remove frames temporários após análise
- [x] Binários estáticos via `@ffmpeg-installer/ffmpeg` + `ffprobe-static` (sem FFmpeg no sistema)
- [x] `VideoCaptureModule` registrado em `AppModule`

---

### Task 4.2 — Fila de processamento (BullMQ)
- [x] `BullModule.forRootAsync` em `AppModule` — parseia `REDIS_URL` da env (host, port, password)
- [x] Fila `video-processing` registrada em `VideoCaptureModule` e `MatchesModule`
- [x] `VideoProcessingWorker` (`@Processor` + `WorkerHost`) — 4 etapas com atualização de status em cada uma
- [x] `MatchesService.uploadVideo` despacha job após upsert do MatchVideo (3 tentativas, backoff exponencial 5s)
- [x] Em caso de falha: `Match.status = failed`, `MatchVideo.processingStatus = failed`, job re-thrown para BullMQ

---

### Task 4.3 — Módulo Game Analysis
- [x] `GameAnalysisService.analyzeMatch(matchId, framePaths)` — detecta eventos e erros, persiste no banco, define `match.status = analyzed`
- [x] Eventos: 1 por frame (30s cada), categoria distribuída por fase da partida (posicionamento → ataque → defesa → passe → finalizacao → decisao)
- [x] Erros: 1 a cada 3 eventos de risco (defesa, decisao, posicionamento), severidade cíclica low/medium/high
- [x] `createManyAndReturn` para eventos (retorna IDs para FK dos erros)
- [x] Limpa análise anterior antes de reinserir (suporte a re-análise)
- [x] `VideoProcessingWorker` atualizado: chama `analyzeMatch` após extração + `cleanFrames` após análise
- [x] `GameAnalysisModule` importado em `VideoCaptureModule` e `AppModule`

---

### Task 4.4 — Módulo AI Coach
- [x] `AiCoachService.analyzeMatch(matchId)` — busca eventos/erros do banco, monta prompt tático, chama Claude Sonnet 4.6
- [x] Integração Claude Sonnet 4.6 via `@anthropic-ai/sdk` — modelo `claude-sonnet-4-6`
- [x] Fallback para GPT-4o (OpenAI) via `openai` se Claude falhar
- [x] Custo estimado por análise calculado a partir do uso de tokens (`inputTokens × preço_entrada + outputTokens × preço_saída`)
- [x] `AIAnalysis` upsert com `summary`, `costEstimate`, `rawResponse`, `modelUsed`, `promptVersion`, `status`
- [x] `AiCoachModule` (providers + exports `AiCoachService`)
- [x] `VideoProcessingWorker` step 6: chama `AiCoachService.analyzeMatch()` após game analysis; falha capturada sem cancelar partida
- [x] `VideoCaptureModule` e `AppModule` importam `AiCoachModule`

---

### Task 5.1 — Módulo Reports (backend)
- [x] `GET /api/v1/matches/:matchId/report` — relatório da partida (apenas dono, status = analyzed)
- [x] `GET /api/v1/reports/evolution?days=N` — evolução de scores nos últimos N dias (1–90, default 30)
- [x] `GET /api/v1/reports/summary` — estatísticas agregadas (total, médias, melhor/pior categoria, erro mais frequente)
- [x] Geração de `MatchReport` via `persistReport()` com scores por categoria calculados de `DetectedError[]`
- [x] `generateReport(matchId)` chamado automaticamente pelo worker após AI Coach (step 7)
- [x] `ReportsModule` com controller + service + exports; `VideoCaptureModule` importa `ReportsModule`

---

### Task 5.2 — Dashboard do jogador (frontend)
- [x] Saudação dinâmica com primeiro nome + data formatada (Bom dia / Boa tarde / Boa noite)
- [x] 4 cards: Partidas Analisadas, Nota Média (cor semântica), Erro Mais Frequente, Evolução Semanal (delta da nota)
- [x] Card "Última Partida": placar, nota, status badge, link para análise
- [x] Card "Recomendação de Treino": tip prática por pior categoria (`summary.worstCategory`)
- [x] 3 fetches paralelos via `Promise.allSettled` — sem travar se uma chamada falhar
- [x] Spinner de loading; estado vazio gracioso em cada seção

---

### Task 5.3 — Tela de Relatório da partida (frontend)
- [x] Rota `/matches/[id]` — page dinâmica com `useParams()`
- [x] Header: título, status badge, modo, placar, data
- [x] Nota Geral + 4 cards de categoria com cor semântica (verde/amarelo/vermelho)
- [x] Resumo do Coach IA com modelo utilizado (oculto se não disponível)
- [x] Erros detectados com severidade, categoria, descrição e sugestão
- [x] Lances da partida: timeline MM:SS com ícone por categoria (máx 15)
- [x] Pontos Positivos: categorias com score ≥ 7.0 (oculto se nenhuma)
- [x] O que Treinar: tip estática por `mainProblem` (oculto se não disponível)
- [x] Guard de status não analisado com mensagem contextual
- [x] 2 fetches paralelos: `/matches/:id` + `/matches/:id/report`

---

### Task 5.4 — Tela de Evolução (frontend)
- [x] Seletor de período (7 / 30 / 90 dias) com refetch ao trocar
- [x] 3 cards: Partidas no Período, Melhor Nota, Tendência (delta)
- [x] Chart SVG: polyline de overallScore, zonas coloridas, dots semânticos, labels de data adaptativos
- [x] Desempenho por Categoria: barras CSS do mais problemático ao melhor
- [x] Tendência por Partida: últimas 6 com delta vs anterior e link para relatório
- [x] Comparação de Partidas: tabela com Geral + categorias, indicador ↑↓= por linha
- [x] Empty state com CTA para nova partida

---

## Fase 5 concluída — todas as 4 tasks implementadas

---

### Task 6.1 — Módulo Plans (backend)
- [x] `prisma/seed.ts` — 3 planos seeded (Free/Pro/Premium) com padrão `findFirst` + `update`/`create`
- [x] `GET /api/v1/plans` — lista planos ativos ordenados por preço
- [x] `GET /api/v1/subscriptions/me` — retorna subscription + plan + usage (analysesThisMonth, limit, limitReached)
- [x] `AnalysisLimitGuard` — HTTP 402 quando limite mensal de análises atingido
- [x] Guard aplicado em `POST /api/v1/matches/:id/video`
- [x] `package.json` — seed script configurado para `prisma db seed`

---

## Próxima tarefa

**Task 6.2** — Controle de limite de uso — ver [`TASKS.md`](TASKS.md)

---

## Ambiente de desenvolvimento

| Item | Status |
|---|---|
| Banco de dados | Configurado via Docker (não inicializado — rodar `docker-compose up -d`) |
| Migrations | Nenhuma gerada ainda — rodar `prisma migrate dev` após o primeiro `docker-compose up` |
| Dependências npm | Não instaladas — rodar `npm install` na raiz |
| API | Não iniciada |
| Frontend | Não iniciado |

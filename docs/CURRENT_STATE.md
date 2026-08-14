# Estado Atual — Coach Play

**Versão:** V.0.45.0
**Data:** 2026-08-14
**Fase:** Fase 7 — Produção (concluída, **em produção real em https://coachplayals.com.br**) + Módulo Administrador + Configurações + Chaves de IA + Captura via Remote Play (Fases 1 e 2, validadas manualmente, + extensão de navegador) + Tactical Engine (**Fases 1–7 concluídas — motor completo, 39/39 tarefas do plano original, ainda sem fonte real de dados nem endpoint público**)

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

### Task 6.2 — Controle de limite de uso
- [x] `PlansService.registerAnalysisUsage(matchId)` — cria registro em `UsageLog` (action `video_analysis`, resourceType `match`, resourceId `matchId`, amountUsed default 1)
- [x] `PlansService.countAnalysesThisMonth(userId)` — conta consumo do mês corrente a partir do `UsageLog` (substituiu a contagem por `Match.count`, agora `UsageLog` é a fonte única de verdade de consumo)
- [x] `VideoProcessingWorker` — chama `registerAnalysisUsage(matchId)` logo após `GameAnalysisService.analyzeMatch` concluir (passo 5.1, quando `match.status` vira `analyzed`)
- [x] `AnalysisLimitGuard` — passa a usar `PlansService.countAnalysesThisMonth()` em vez de duplicar a query; mantém HTTP 402 quando limite mensal é atingido
- [x] `PlansService.getMySubscription()` — usa o mesmo `countAnalysesThisMonth()` para consistência entre guard e endpoint `/subscriptions/me`
- [x] `VideoCaptureModule` — importa `PlansModule` para disponibilizar `PlansService` ao worker

---

### Task 6.3 — Tela de Plano atual (frontend)
- [x] `(dashboard)/plan/page.tsx` — tela completa substituindo stub:
  - Card do plano atual: nome, preço formatado (R$ ou "Grátis"), badge de status (active/expired/cancelled)
  - Barra de progresso de consumo mensal (`analysesThisMonth / limit`) com cor semântica (verde/amarelo/vermelho) e aviso quando `limitReached`
  - Cards de detalhes: limite mensal de análises, duração máxima de vídeo, disponibilidade de feedback ao vivo
  - Bloco de datas: início da assinatura (`startedAt`) e renovação (`expiresAt`, com fallback "Sem data de renovação" para planos sem expiração)
  - Seção "Planos disponíveis": lista os planos de `GET /plans` com destaque visual no plano atual
  - 2 fetches paralelos via `Promise.allSettled`: `/subscriptions/me` + `/plans`; estado de erro dedicado se a assinatura não carregar

---

## Fase 6 concluída — todas as 3 tasks implementadas

---

### Task 7.1 — Logs e auditoria completos
- [x] `AuditLogsService.log(entry)` — grava em `AuditLog` (userId?, module, action, ipAddress?, metadata?); best-effort (falha ao gravar não derruba o fluxo principal)
- [x] `AuditLogsModule` marcado `@Global` (mesmo padrão do `MailModule`) — `AuditLogsService` disponível em qualquer módulo sem import extra, mas importado explicitamente em `AuthModule`, `MatchesModule` e `VideoCaptureModule` para manter a convenção do projeto
- [x] **login** — `AuthController.login` loga `auth.login` em caso de sucesso e `auth.login_failed` (com IP e motivo) em caso de erro (senha inválida, conta bloqueada, etc.)
- [x] **cadastro** — `AuthController.register` loga `auth.register` em caso de sucesso e `auth.register_failed` em caso de erro (ex.: e-mail duplicado)
- [x] **logout** — `AuthController.logout` loga `auth.logout` com o usuário autenticado
- [x] **upload** — `MatchesService.uploadVideo` loga `matches.video_upload` com matchId, nome e tamanho do arquivo
- [x] **análise** — `VideoProcessingWorker` loga `game-analysis.analysis_completed` após a análise ser concluída com sucesso
- [x] **erros** — `VideoProcessingWorker` loga `video-processing.processing_failed` (matchId, mensagem de erro, tentativa) quando o job falha
- [x] **mudança de plano** — `AuthService.register` loga `plans.plan_assigned` ao vincular o plano Free na criação da conta (único ponto do sistema hoje que altera o plano de um usuário — ainda não existe endpoint de upgrade/downgrade de assinatura; quando for implementado, deverá chamar `AuditLogsService.log` com o mesmo padrão)

---

### Task 7.2 — Testes
- [x] `JwtAuthGuard` — rota `@Public()` ignora autenticação; sem token/token inválido lança `UnauthorizedException`; usuário autenticado é retornado
- [x] `RolesGuard` — admin acessa rota restrita a admin; jogador (`player`) recebe `ForbiddenException`; rota sem `@Roles()` é liberada
- [x] `MatchesService.findOne` — usuário que não é dono recebe `ForbiddenException`; partida inexistente/deletada retorna `NotFoundException`; dono acessa normalmente
- [x] `videoFileFilter` — aceita MP4/MOV/AVI; rejeita outros formatos (ex. `image/png`) com `BadRequestException`
- [x] `AnalysisLimitGuard` — bloqueia com HTTP 402 quando `analysesThisMonth >= monthlyAnalysisLimit` (plano Free); libera quando abaixo do limite; bloqueia sem assinatura ativa
- [x] `AiCoachService.analyzeMatch` — usa Claude quando disponível; cai para GPT-4o quando Claude falha; marca `AIAnalysis.status = failed` quando ambos falham
- [x] 6 suites / 20 testes unitários (Jest + ts-jest) em `apps/api/src` — `npm test` na pasta `apps/api`
- [x] Corrigido erro de compilação em `AuditLogsService.log` (campo `metadata` do Prisma Json não aceitava `Record<string, unknown>` diretamente — cast para `Prisma.InputJsonValue`)

---

### Task 7.3 — Segurança e revisão
- [x] **Bug crítico corrigido**: `ThrottlerModule.forRoot` estava configurado em `app.module.ts`, mas `ThrottlerGuard` nunca era registrado como guard global — o `@Throttle` do login não tinha nenhum efeito e nenhum endpoint era de fato limitado. Agora `ThrottlerGuard` é o primeiro `APP_GUARD` (roda antes de `JwtAuthGuard`/`RolesGuard`)
- [x] `@Throttle` adicionado a `register` (5/min), `forgot-password` (3/min — evita spam de e-mail/enumeração) e `reset-password` (5/min); `login` já tinha (5/min)
- [x] `@Throttle` adicionado em `POST /matches/:id/video` (10/min) — endpoint caro (I/O de disco + fila), antes sujeito apenas ao limite default
- [x] Teste de regressão `throttler-wiring.integration.spec.ts` — sobe um app Nest real (porta efêmera) reproduzindo o wiring de `app.module.ts` e confirma HTTP 429 após exceder `@Throttle`
- [x] Upload: revisão confirma formato (fileFilter/multer) e tamanho (500MB) já validados de forma síncrona; duração (90min) validada no worker (Task 4.1) — **corrigido**: vídeo com duração inválida agora é removido do disco (`unlink`) em vez de ficar armazenado indefinidamente após falha não-reprocessável
- [x] Revisão de exposição de dados sensíveis: `passwordHash` nunca é retornado (todas as queries de user usam `select` explícito); `assertOwner`/`assertCanAccess` cobrem matches e users; `HttpExceptionFilter` não vaza stack trace; cookies de refresh token `httpOnly` + `secure` em produção + `sameSite: strict`; nenhuma alteração necessária, apenas confirmação
- [x] 1 nova suite de teste (integração do throttling) — total agora 7 suites / 21 testes em `apps/api/src`

### Task 7.4 — Deploy em VPS
- [x] `apps/api/Dockerfile` — build multi-stage (Debian `bookworm-slim`, não Alpine: `@ffmpeg-installer/ffmpeg` não publica binário musl); estágios `build` → `migrator` (com Prisma CLI) e `pruned`/`production` (sem devDependencies)
- [x] `apps/web/Dockerfile` — build multi-stage com Next.js `output: 'standalone'` (Alpine, sem dependência nativa)
- [x] `docker-compose.prod.yml` — postgres/redis sem porta exposta ao host (rede interna), `restart: unless-stopped`, serviço `migrate` sob demanda (`profiles: [tools]`), `nginx` + `certbot`
- [x] `deploy/nginx/coachplay.conf.template` — reverse proxy: `/` → web:3000, `/api/` e `/uploads/` → api:3001, redirect HTTP→HTTPS, `client_max_body_size 550M`
- [x] `deploy/certbot/init-letsencrypt.sh` — emissão do primeiro certificado Let's Encrypt (dummy cert → sobe nginx → cert real via webroot); renovação automática já embutida no serviço `certbot` (loop de 12h)
- [x] `deploy/backup/backup-postgres.sh` — `pg_dump` + gzip + rotação (`BACKUP_RETENTION_DAYS`, default 14 dias); agendável via cron
- [x] `docs/DEPLOY.md` — runbook completo do deploy no VPS
- [x] **3 bugs pré-existentes corrigidos ao validar o build de produção** (nunca detectados porque a API/o frontend nunca haviam sido buildados/rodados antes):
  - `apps/web/next.config.ts` não é suportado no Next.js 14 (só a partir do Next 15) — convertido para `next.config.mjs`
  - `/login` usava `useSearchParams()` sem `<Suspense>`, quebrando o `next build` — refatorado no mesmo padrão já usado em `/reset-password`
  - Script `start` da API (`node dist/main`) e `CMD` do Dockerfile apontavam para o caminho errado — `nest build` gera `dist/src/main.js`, não `dist/main.js`
- [x] **Gap crítico de deploy corrigido**: não existiam migrations do Prisma (`apps/api/prisma/migrations/`) — sem elas, `prisma migrate deploy` não criava nenhuma tabela em um banco novo. Gerada a migration inicial (`20260716152320_init`)
- [x] Build das duas imagens e fluxo completo (`migrate` → `api` → `web`) validado localmente com Docker: registro de usuário, login e roteamento end-to-end confirmados contra Postgres/Redis reais em containers

### Deploy em produção real — coachplayals.com.br (pós Fase 7)

Primeiro deploy de verdade em VPS (2026-07-20). O VPS não é dedicado — já hospeda outros
projetos, então não seguiu `docs/DEPLOY.md` (que assume nginx/certbot próprios do Coach Play)
e sim o novo `docs/DEPLOY_SHARED_VPS.md`: sem nginx/certbot próprio, containers renomeados
(`coachplay-*`) conectados à rede Docker do nginx que já estava rodando pra outro projeto,
certificado via desafio DNS-01 (Cloudflare API token) em vez de webroot.

- [x] `docker-compose.vps.yml` (novo) + `deploy/nginx/coachplay-shared-vps.conf.template` (novo) + `docs/DEPLOY_SHARED_VPS.md` (novo)
- [x] **2 novos bugs de produção encontrados e corrigidos, nunca pegos porque ninguém tinha rodado um build limpo desde mudanças anteriores**:
  - `apps/api/Dockerfile` e `apps/web/Dockerfile` rodavam `npm ci` **antes** de `apps/api/prisma/schema.prisma` existir no contexto de build — o `postinstall: prisma generate` do `apps/api/package.json` (adicionado na 0.29.0 pra corrigir build na Vercel) dispara em qualquer `npm ci` na raiz do workspace, inclusive ao buildar só o `web`. Corrigido: `COPY apps/api/prisma apps/api/prisma` antes do `RUN npm ci` nos dois Dockerfiles
  - `docker-compose.prod.yml` (e a nova variante `docker-compose.vps.yml`): o serviço `web` também lê o `.env` compartilhado com a API (`PORT=3001`), então o Next.js standalone herdava essa porta em vez de 3000, quebrando o `proxy_pass` do nginx (502). Corrigido com `environment: PORT: 3000` explícito no serviço `web` — afeta qualquer deploy de VPS dedicado feito antes desta correção
- [x] Certificado TLS real emitido via Let's Encrypt + Cloudflare DNS-01 (`certbot-dns-cloudflare`, token restrito à zona), renovação automática configurada
- [x] Testado de ponta a ponta contra o domínio real: `/login` (200), `/api/v1/plans` (401, rota protegida respondendo), redirect de `/` sem sessão — certificado válido até 2026-10-18
- [x] **3º bug de produção encontrado ao trocar a logo**: `middleware.ts` só excluía 4 caminhos fixos (`api`, `_next/static`, `_next/image`, `favicon.ico`) do matcher — qualquer outro arquivo estático de `public/` (ex.: `logo-mark.png`) era tratado como rota protegida e redirecionado pra `/login` sem sessão, corrompendo o `<Image>` do Next.js (recebia HTML no lugar do PNG). Corrigido excluindo qualquer caminho com extensão de arquivo, não mais uma lista fixa
- [x] Logo de verdade em uso (`Logo coach play.png` → `logo-mark.png`/`logo-full.png`/favicon), substituindo o badge de texto CSS em login/register/reset-password/forgot-password/sidebar
- [x] Conta de admin criada em produção: `fasterdrible@gmail.com` cadastrada via `/register` e promovida a `admin` direto no banco (banco de produção é zerado, nenhuma conta migrada do ambiente local)
- [ ] Chaves de IA (Anthropic/OpenAI) ainda não configuradas em produção — a decisão foi configurar depois pelo painel admin (`/admin/usage`) em vez de variável de ambiente
- [ ] Senha root do VPS foi compartilhada em texto durante a sessão (só pra autorizar a chave SSH usada no deploy) — recomendado trocá-la (`passwd`) por precaução

### Módulo Administrador (pós Fase 7)
- [x] Os 4 stubs de admin (deixados na Fase 7, sem número de task próprio) foram substituídos por telas reais consumindo dados de verdade:
  - `GET /admin/overview` — contagens de usuários/partidas por status, custo e contagem de análises de IA concluídas, últimos 8 eventos de auditoria
  - `GET /admin/usage` — consumo e custo de IA por usuário, paginado
  - `GET /audit-logs` — leitura paginada com filtro por módulo/ação (o módulo de auditoria só tinha escrita até então)
  - `(admin)/admin`, `/admin/users` (bloquear/ativar), `/admin/logs`, `/admin/usage` — todas consumindo os endpoints acima, sem dados mockados
- [x] Ação de bloquear/ativar usuário testada de ponta a ponta (clique → `PATCH /users/:id/status` → persistência confirmada após reload)
- [x] 2 novas suites de teste (`admin.service.spec.ts`, `audit-logs.service.spec.ts`) — total agora 9 suites / 29 testes em `apps/api/src`

### Configurações do usuário (pós Fase 7)
- [x] Stub "Task 2.x" substituído por tela real: nome, nível de feedback, modo de jogo favorito, feedback por voz
  e idioma, usando o `UserPreferences` que já existia no backend desde a Fase 2 mas nunca tinha tela
- [x] Testado de ponta a ponta: alterar campos → salvar → reload → confirma persistência no banco

### Configuração de chaves de IA pelo admin (pós Fase 7)
- [x] Modelo `AppSetting` (Prisma, linha única) armazena `anthropicApiKey`/`openaiApiKey`/`deepSeekApiKey` criptografados em AES-256-GCM (chave derivada de `JWT_SECRET`)
- [x] `SettingsModule` (antes stub vazio) ganhou `SettingsService` + `SettingsController`:
  - `GET /settings/ai-provider` — status por provedor (configurado via painel ou env var, preview mascarado)
  - `PUT /settings/ai-provider` — salva (string) ou remove (string vazia) cada chave; `@Roles('admin')`
- [x] `AiCoachService` refatorado para loop sobre 3 provedores (Claude → GPT-4o → **DeepSeek**), clients criados por chamada com a chave resolvida via `SettingsService` (painel tem prioridade, cai para env var) — uma chave nova entra em vigor na próxima análise, sem restart. DeepSeek reusa a SDK `openai` (API compatível) com `baseURL: https://api.deepseek.com` e modelo `deepseek-chat`
- [x] UI em `(admin)/admin/usage/page.tsx`: 3 cards de status por provedor, campos para nova chave (nunca preenchidos com o valor real) e ação de remover
- [x] 8 novos testes (`settings.service.spec.ts` + `ai-coach.service.spec.ts`); total agora 10 suites / 35 testes em `apps/api/src`
- [x] Testado de ponta a ponta via Playwright: salvar chave (cada provedor) → reload → preview mascarado persiste → remover → volta a "não configurada"

### Excluir usuário e log + menu suspenso (pós Fase 7)
- [x] `(admin)/admin/users`: ação "Excluir usuário" adicionada, usando o `DELETE /users/:id` que já existia no backend (soft delete) mas não tinha botão na UI
- [x] `(admin)/admin/logs`: nova coluna "Ação" com botão de excluir por linha; novo `DELETE /audit-logs/:id` no backend (`AuditLogsController`/`AuditLogsService`, hard delete — `@Roles('admin')`)
- [x] Componente `DropdownMenu` novo (`components/ui/dropdown-menu.tsx`) — substitui o botão único de bloquear/ativar por um menu (⋮) com "Bloquear/Ativar usuário" e "Excluir usuário" (destrutivo, com confirmação)
- [x] 2 novos testes de `AuditLogsService.remove`; total agora 37 testes em `apps/api/src`
- [x] Testado de ponta a ponta via Playwright: exclusão de usuário e de log de auditoria, com confirmação nativa antes de cada ação

### Selecionar tudo + exclusão em massa nos logs (pós Fase 7)
- [x] `(admin)/admin/logs`: checkbox no cabeçalho da tabela seleciona/desmarca todas as linhas da página atual; fica com estado indeterminado quando a seleção é parcial
- [x] Barra de ação (aparece só quando há seleção): contador de selecionados, "Excluir selecionados" (com confirmação) e "Cancelar"
- [x] Exclusão em massa reusa o `DELETE /audit-logs/:id` existente via `Promise.allSettled` — nenhum endpoint novo; falhas parciais são reportadas
- [x] Testado de ponta a ponta via Playwright: marcar tudo → desmarcar um (header vira indeterminado) → remarcar tudo → excluir selecionados → linhas somem e contador total decrementa corretamente

### Correções de infraestrutura (pós Fase 7)
- [x] `apps/api/package.json` — `postinstall`/`build` agora rodam `prisma generate` antes de `nest build`;
  sem isso, builds em CI/Vercel com client não gerado falhavam com 17 erros `TS2305`/`TS2694` (client "stub"
  sem os enums/models do schema)
- [x] `lib/api.ts` — timeout de 15s em todas as chamadas; evita que o `AuthProvider` fique preso no
  "Carregando..." para sempre se uma requisição ficar pendurada
- [x] `next.config.mjs` — `onDemandEntries` com janela maior, reduzindo recompilações ao alternar abas em dev

---

### Captura via Remote Play — Fases 1 e 2 (pós Fase 7)

Base do novo módulo que permite analisar partidas do Xbox capturando a tela do PC via Xbox
Remote Play oficial (sem engenharia reversa, sem acesso a memória/API privada, sem automação de
jogo). Plano completo, riscos e próximas fases em [`docs/REMOTE_PLAY_CAPTURE.md`](REMOTE_PLAY_CAPTURE.md).

- [x] Prisma: `CaptureSession`, `FrameSample`, `VideoSegment`, `CoachFeedback` + `GameEvent` linkado ao novo pipeline
- [x] `CaptureSessionsModule` (backend): lifecycle da sessão, ingestão de frames/segmentos, leitura de eventos/feedbacks — 12 testes
- [x] `apps/desktop` (novo workspace Electron + TypeScript): state machine de sessão, servidor HTTP local (`127.0.0.1`), seleção de fonte via `desktopCapturer`, preview ao vivo via `getUserMedia`, tela de consentimento, controles start/pause/stop — 15 testes, build (`tsc` + `esbuild`) validado
- [x] **Fase 2** — `GameStateDetectorService` (heurística de diff de pixels via `sharp`, emite `menu`/`match_running`), `EventDetectorService` (pico de movimento com dois limiares de confiança), fila BullMQ `capture-frame-analysis` encadeando estado → evento → feedback, `AiCoachService.generateEventFeedback` (Claude → GPT-4o → DeepSeek, respeitando `UserPreferences.feedbackLevel`) — 21 novos testes (ver CHANGELOG 0.34.0)
- [x] **Validação manual em Windows real, feita nesta rodada** — primeira vez que o módulo rodou de verdade (login, consentimento, seleção de fonte, captura ao vivo contra uma sessão real de Xbox Remote Play via navegador). Encontrados e corrigidos 3 bugs que nenhum teste automatizado cobria (ver CHANGELOG 0.35.0):
  - `apps/desktop` não tinha nenhuma tela de login — `LoginScreen` nova, autentica via `POST /auth/login` reaproveitado, token guardado só em memória do processo main
  - Sessão de captura ficava travada em `stopped`/`failed` para sempre após o primeiro encerramento (`CaptureSessionState` é de uso único) — `CaptureSessionManager` agora recria a state machine ao iniciar uma nova captura
  - Frames nunca eram persistidos: o app mandava `Date.now()` (epoch absoluto) como `timestampMs`, estourando a coluna `INT4` do Postgres — corrigido para mandar o tempo decorrido desde o início da sessão
  - Trava em cascata no `CaptureFrameAnalysisWorker`: a busca do "frame anterior" exigia `analysisStatus: 'analyzed'`, mas o primeiro frame de qualquer sessão nunca tem anterior (fica `skipped`) — nenhum frame seguinte nunca achava um anterior válido, e a sessão inteira ficava `skipped` para sempre. Corrigido para buscar só por timestamp, sem exigir status
- [x] **Limitação real descoberta (não é bug do Coach Play)**: o Xbox Remote Play/Cloud Gaming pausa o stream sozinho quando a aba/janela perde foco ou visibilidade (comportamento do próprio produto Microsoft, pra economizar banda e evitar input acidental) — então focar a janela do `apps/desktop` durante a partida (ex.: pra pausar/encerrar a captura) pausa o jogo junto. Não há como evitar isso a partir do nosso app enquanto ele for uma janela separada — ver `docs/REMOTE_PLAY_CAPTURE.md`, seção de riscos
- [ ] Calibração dos limiares de detecção (`STATIC_THRESHOLD`, `ACTIVE_THRESHOLD`, `SPIKE_THRESHOLD` e os 2 de confiança) com captura real — a validação confirmou que a classificação `menu`/`match_running` roda nos frames reais, mas os limiares em si (ajuste fino) ainda não foram calibrados com dados reais o suficiente
- [ ] Geração automática de `VideoSegment` a partir de eventos detectados (FFmpeg no `apps/desktop`) — `SegmentReason.event_detected` ainda sem uso
- [x] **Vínculo da sessão de captura com uma `Match` (`matchId`)** — nova tela `MatchSelector` (`apps/desktop`, entre consentimento e seleção de fonte) e o mesmo fluxo no popup da extensão (`renderSelectMatch`), listando partidas pendentes (`GET /matches?status=pending`) ou criando uma nova (`POST /matches`) antes de iniciar a captura; `matchId` flui até `CaptureSessionsService.create` (que já aceitava o campo desde a Fase 1, só faltava um cliente que o preenchesse). Nenhuma rota nova no backend. Ver CHANGELOG 0.38.0

### Extensão de navegador — caminho alternativo ao apps/desktop (pós Fase 7)

Novo workspace `apps/extension` (Chrome, Manifest V3), resolvendo estruturalmente a limitação de
foco descoberta na validação manual do `apps/desktop` (Remote Play pausa quando a janela do
Electron ganha foco) — uma extensão roda dentro da própria aba do Remote Play e nunca precisa
roubar o foco dela para pausar/encerrar a captura. Plano completo em
[`docs/REMOTE_PLAY_CAPTURE.md`](REMOTE_PLAY_CAPTURE.md). Reaproveita 100% do backend já existente
(`CaptureSessionsModule`) — nenhuma rota nova.

- [x] `src/background/` (service worker): `BackendClient` (login, createCaptureSession,
  transitionSession, uploadFrame) contra os mesmos endpoints já usados pelo `apps/desktop`;
  `SessionStore` em `chrome.storage.session` (só memória, nunca disco — mesmo princípio de
  privacidade do desktop, necessário porque o service worker do MV3 é reciclado a qualquer momento)
- [x] `src/content/` injetado em `xbox.com/*/play/*`: `video-picker.ts` — heurística de qual
  `<video>` da página é o player do Remote Play (maior área entre os que estão tocando), sem
  depender de seletor CSS específico do Xbox — amostra frames via `<canvas>` e envia ao background
- [x] `src/popup/` — UI sem framework (HTML/DOM puro): login, tela de consentimento (mesmo texto
  de transparência do desktop: só pixels da aba, sem engenharia reversa), controles start/pause/stop
- [x] `elapsedMs` desde o início da sessão (não `Date.now()`) já enviado desde a primeira versão —
  mesma correção que o `apps/desktop` só descobriu na validação manual (CHANGELOG 0.35.0)
- [x] 5 testes (`video-picker.spec.ts`, única lógica pura testável sem um navegador real); build
  (`tsc` + `esbuild`) validado; scripts `build:extension`/`test:extension` no `package.json` raiz
- [x] **Validado em navegador real nesta rodada** — login (com mostrar/ocultar senha e salvar pelo
  gerenciador do Chrome, ver CHANGELOG 0.38.1), `renderSelectMatch` vinculando a sessão a uma
  `Match`, e captura ao vivo contra uma sessão real de Xbox Remote Play: 162 frames de uma sessão
  de teste chegaram no banco, 1/s, com `matchId` preenchido — mas todos corrompidos (bug de
  transporte do frame via `chrome.runtime.sendMessage`, corrigido no CHANGELOG 0.38.3; ainda falta
  revalidar com o fix aplicado)

### Tactical Engine — Fase 1: Fundação (novo subdomínio)

Novo subdomínio inspirado em princípios de xadrez (traduzidos para futebol digital), que evolui
o Coach Play de "detector de erros" para "sistema de inteligência de decisão": comparar a decisão
tomada com as alternativas disponíveis, não só apontar o erro. Plano completo em
[`docs/tactical-engine-domain.md`](tactical-engine-domain.md); auditoria pré-implementação em
[`docs/tactical-engine-current-state.md`](tactical-engine-current-state.md).

- [x] **Tarefa 1 — Auditoria da arquitetura atual** (`docs/tactical-engine-current-state.md`) —
  achado crítico: não existe, em nenhum lugar do projeto, detecção real de posição de
  jogadores/bola. `GameAnalysisService.analyzeMatch` (pipeline de upload) é inteiramente
  sintético; `capture-sessions` só faz diff de pixels agregado, sem semântica espacial. Decisão
  resultante: o motor é construído e testado contra fixtures, isolado atrás de uma interface
  (`TacticalStateProvider`) sem implementação real ainda
- [x] **Tarefa 2 — Domínio estratégico** (`docs/tactical-engine-domain.md`) — linguagem ubíqua,
  nomenclatura que nunca confunde `User` (conta autenticada) com jogador virtual em campo
  (`VirtualPlayer`/`ControlledPlayer`/`OpponentPlayer`)
- [x] **Tarefa 3 — Representação normalizada do campo** — `PitchCoordinate` (x/y em [0,1]),
  `getPitchZone()` (15 zonas: 3 terços × 5 corredores), `invertPitchSide()`; lança erro explícito
  para coordenada inválida (nunca corrige silenciosamente)
- [x] **Tarefa 4 — Módulo `tactical-engine`** — estrutura flat (mesmo padrão dos demais módulos;
  decisão confirmada com o usuário, não a estrutura em camadas documentada mas nunca usada em
  `docs/ARCHITECTURE.md`), registrado em `app.module.ts` sem controller/endpoint ainda
- [x] **Tarefa 5 — `TacticalGameState`/`VirtualPlayer`** — estado estruturado de um instante da
  partida; `TacticalStateProvider` como única costura para uma futura fonte real de dados
- [x] **Tarefa 6 — Persistência** — `TacticalSnapshot`/`TacticalPlayer` no Prisma (migration
  `20260813150732_add_tactical_engine`), índices em `matchId`, `(matchId, timestampMs)` e
  `createdAt` (preparando futura rotina de expurgo — sem política de retenção implementada ainda)
- [x] 38 novos testes; suíte completa da API (16 suítes / 109 testes), `tsc --noEmit` e
  `nest build` validados sem regressão
- [ ] Lint da API (`npm run lint`) segue quebrado por falta de `.eslintrc*` — pré-existente, não
  bloqueou esta fase (validação feita via `tsc --noEmit`)

### Tactical Engine — Fase 2: Inteligência espacial

Cinco avaliadores geométricos determinísticos sobre `TacticalGameState` — nenhum usa IA
generativa. Ainda sem controller/endpoint público.

- [x] **Tarefa 7 — Linhas de passe** (`passing-lanes.evaluator.ts`) — `distance`,
  `obstructionRisk`, `pressureRisk`, `progressionValue`, `score` 0–100 por linha candidata
- [x] **Tarefa 8 — Pressão** (`pressure.evaluator.ts`) — `LOW`/`MEDIUM`/`HIGH`/`CRITICAL` a
  partir de distância e contagem de adversários num raio de 0.15
- [x] **Tarefa 9 — Espaço livre** (`space.evaluator.ts`) — usa as 15 `PitchZone` como grid;
  `occupation`/`pressure`/`freeSpace`/`goalProximity` por zona, ordenado por valor estratégico
- [x] **Tarefa 10 — Superioridade numérica** (`numerical-advantage.evaluator.ts`) — por zona
  exata ou zona da bola + vizinhança (novo `getNeighboringZones()` em `pitch-zone.ts`)
- [x] **Tarefa 11 — Segurança defensiva** (`defensive-balance.evaluator.ts`) —
  `DefensiveSafetyScore` 0–100 a partir de jogadores atrás da bola, cobertura central, dispersão
  lateral e adversários livres à frente
- [x] 45 novos testes (83 no módulo, 154 na suíte completa da API); `tsc --noEmit`/`nest build`
  validados sem regressão

### Tactical Engine — Fase 3: Motor de decisões

Primeira vez que o motor produz uma avaliação completa — ação escolhida × melhores alternativas,
nota 0–100, classificação — fechando o critério de sucesso do plano original. Ainda 100%
determinístico, sem controller/endpoint público.

- [x] **Tarefa 12 — Ações candidatas** (`action-generator.ts`) — `PASS`/`SAFE_PASS`/
  `PROGRESSIVE_PASS`/`RECYCLE`/`SWITCH_SIDE` (a partir das linhas de passe) + `CARRY`/`HOLD`
- [x] **Tarefa 13 — `DecisionScore`** (`decision-score.config.ts` + `.calculator.ts`) — 6
  componentes, pesos versionados (`DECISION_SCORE_CONFIG_VERSION`), somando 1.0
- [x] **Tarefa 14 — Classificação** (`decision-classification.ts`) — `EXCELLENT`→`MAJOR_ERROR`
- [x] **Tarefa 15 — `DecisionEvaluator`** (`decision.evaluator.ts`) — chamador informa só
  tipo+alvo da ação real; retorna `null` sem candidata correspondente (regra "sem confiança,
  sem avaliação")
- [x] **Tarefa 16 — Árvore de decisão curta** (`decision-tree.evaluator.ts`) — `depth=2`,
  `topActions=3`, poda simples por construção
- [x] **Tarefa 17 — Sequências táticas** (`tactical-sequence.detector.ts`) — 5 de 6 padrões
  (`DEFENSIVE_RECOVERY` só no vocabulário, sem detector — `ActionGenerator` não modela ações do
  time sem a posse)
- [x] **Bug real corrigido nesta fase**: fórmula de `pressureManagement` enviesava o motor a
  sempre preferir `HOLD` mesmo sem pressão nenhuma — corrigido, ver `CHANGELOG.md` 0.41.0
- [x] 44 novos testes (162 no módulo, 207 na suíte completa da API); `tsc --noEmit`/`nest build`
  validados sem regressão

### Tactical Engine — Fase 4: Princípios estratégicos

Primeira vez que o motor produz um vocabulário de avaliação qualitativa (não só nota 0–100) —
oito princípios nomeados, inspirados em xadrez e traduzidos para futebol, julgados por decisão e
agregados em padrões recorrentes entre partidas. Ainda 100% determinístico, sem IA generativa, e
sem controller/endpoint público (a integração com `ai-coach` fica para a Fase 5).

- [x] **Tarefa 18 — Catálogo de princípios** (`strategic-principle.type.ts`) — 8 princípios
  (`CENTRAL_CONTROL`, `PIECE_ACTIVITY`, `KING_SAFETY`, `SPACE_EXPANSION`, `INITIATIVE`,
  `PROPHYLAXIS`, `OVERLOAD`, `WEAKNESS_EXPLOITATION`), cada um com nome, origem no xadrez e
  tradução explícita para futebol — dado estático, sem lógica de avaliação
- [x] **Tarefa 19 — Iniciativa** (`initiative.evaluator.ts`) — combina posse da bola (metade do
  peso) com domínio territorial (a outra metade — média da altura de campo dos dois times, não a
  diferença entre elas: uma diferença simples classificaria erroneamente como "neutro" um
  cenário em que o adversário pressiona colado ao gol do usuário)
- [x] **Tarefa 20 — Overload/switch** (`overload-switch.evaluator.ts`) — reusa
  `evaluateNumericalAdvantage` (Fase 2/Tarefa 10) para listar zonas com superioridade numérica
  clara do usuário (`detectOverloadOpportunities`) e para comparar o lado atual da bola com o
  lado espelhado do campo (`evaluateSwitchOpportunity`), quantificando o valor de uma troca de
  lado além do `progressionValue` geométrico já existente
- [x] **Julgamento por decisão** (`principle-adherence.evaluator.ts`) — conecta as Tarefas
  18–20 ao motor de decisões da Fase 3: para cada `TacticalAction` já pontuada, julga os 8
  princípios como `true` (seguiu), `false` (violou) ou `null` (princípio não estava em jogo
  neste instante — ex.: `PROPHYLAXIS` sem pressão real a neutralizar, `CENTRAL_CONTROL` numa
  ação `HOLD` sem `targetZone`) — nunca inventa julgamento sem base
- [x] **Tarefa 21 — Padrões do jogador** (`tactical-pattern.detector.ts` +
  `tactical-patterns.service.ts`) — agrega julgamentos de aderência não-nulos através de
  MÚLTIPLAS partidas do mesmo usuário; só aponta um padrão com amostra mínima (3 observações) e
  consistência real (≥60% de violação → `_NEGLECTED`, ≥85% de aderência → `_STRENGTH`, sempre
  severidade `LOW`). Persistido via `TacticalPattern` (Prisma, migration
  `20260814171346_add_tactical_engine_phase4`), upsert por `(userId, pattern)` — uma nova rodada
  de detecção atualiza o padrão existente sem sobrescrever `firstDetectedAt`
- [x] **Tarefa 22 — Perfil estratégico** (`strategic-profile.builder.ts` +
  `tactical-profiles.service.ts`) — agrega os `TacticalPattern` já persistidos em
  `dominantPrinciples`/`neglectedPrinciples` (ordenados por severidade/confiança) + `sampleSize`;
  camada fina de leitura, não recalcula geometria. Persistido via `TacticalProfile` (Prisma, uma
  linha por usuário, sempre sobrescrita na última agregação — sem histórico de perfis
  anteriores)
- [x] 49 novos testes (185 no módulo `tactical-engine`, 256 na suíte completa da API); `tsc
  --noEmit` e `nest build` validados sem regressão

### Tactical Engine — Fase 5: Coach

Primeira vez que o motor produz texto — até aqui (Fases 1–4) tudo era número/enum/estrutura.
Único novo acoplamento: `ai-coach` passa a importar tipos/funções do `tactical-engine` (nunca o
contrário — o motor continua sem chamar IA diretamente). Ainda sem controller/endpoint público:
os três builders de saída (relatório, timeline, detalhe) recebem `EvaluatedDecisionRecord[]` já
pronto de quem os chamar — isso continua dependendo de uma fonte real de `TacticalGameState` que
não existe (mesmo bloqueio documentado desde a Tarefa 1/auditoria).

- [x] **Tarefa 23 — Integração com `ai-coach`** (`AiCoachService.explainDecision()`) — novo
  método que recebe uma `DecisionEvaluation` (Fase 3) já avaliada + suas `PrincipleAdherence[]`
  (Fase 4) já julgadas, monta um prompt e gera 1-2 frases de explicação via a mesma cascata
  Claude → GPT-4o → DeepSeek de `analyzeMatch`/`generateEventFeedback`. Best-effort: retorna
  `null` (não lança) quando todos os provedores falham — mesma regra de `generateEventFeedback`.
  A IA nunca recalcula nota/classificação/princípios, só explica em texto o que o motor já
  decidiu (regra do próprio plano, risco 4 da auditoria: "nenhum novo consumo de IA generativa
  pode calcular score")
- [x] **Tarefa 24 — Novo formato de feedback** (`TacticalDecisionFeedback`) — diferente do texto
  solto de `CoachFeedback.message` (Fase 2), este formato sempre carrega, ao lado do texto
  gerado por IA, os campos estruturados que o sustentam: `classification`, `scoreDifference`,
  `principlesFollowed`/`principlesViolated` (via novo helper `splitPrincipleAdherence`, reusado
  também pelos builders de relatório/timeline)
- [x] **Tarefa 25 — Relatório pós-jogo** (`tactical-match-report.builder.ts`) —
  `buildTacticalMatchReport(matchId, records)` agrega `EvaluatedDecisionRecord[]` de UMA partida
  em nota média, contagem por classificação (todas as 6 faixas, mesmo as que não ocorreram),
  frequência de princípios seguidos/violados e sequências táticas (reusa
  `detectTacticalSequences` da Fase 3, sem duplicar lógica). `averageDecisionScore` é `null`
  (nunca `0`) quando não há decisões
- [x] **Tarefa 26 — Timeline** (`tactical-timeline.builder.ts`) — equivalente estruturado da
  timeline "Lances da partida" já exibida em `apps/web`, mas alimentada pelo motor: um item por
  decisão, ordenado por `timestampMs`, com só os princípios violados (não os seguidos — foco em
  o que precisa de atenção)
- [x] **Tarefa 27 — Detalhe de decisão** (`decision-detail.builder.ts`) — `DecisionDetail`
  combina `DecisionEvaluation` + `PrincipleAdherence[]` + `TacticalDecisionFeedback` opcional
  (ausente quando a explicação em texto ainda não foi gerada ou falhou) — formato canônico
  pensado para um futuro endpoint de detalhe, que ainda não existe
- [x] 18 novos testes (274 na suíte completa da API); `tsc --noEmit` e `nest build` validados
  sem regressão

### Tactical Engine — Fase 6: Tempo real

Última fase de funcionalidade do motor antes da robustez (Fase 7). Mesmo bloqueio de todas as
fases anteriores: sem fonte real de `TacticalGameState`, não há ainda nenhum worker/pipeline
real invocando o que foi construído aqui — a Fase 2 de `capture-sessions` (motion/estado de
jogo) continua sendo a única parte do sistema rodando contra dados reais.

- [x] **Tarefa 28 — Feedback estratégico durante a partida, com prioridade e cooldown**
  (`feedback-priority.evaluator.ts`) — `computeFeedbackPriority()` mapeia cada
  `DecisionClassification` (Fase 3) para uma prioridade de interrupção ao vivo (`MAJOR_ERROR` →
  `CRITICAL`, `ERROR` → `HIGH`, `RISKY`/`EXCELLENT` → `MEDIUM`, `ACCEPTABLE`/`GOOD` → `LOW`, esta
  última nunca entregue ao vivo — feedback de rotina fica só no relatório pós-jogo da Fase 5).
  `shouldDeliverLiveFeedback()` aplica cooldown por prioridade (15s/30s/60s), usando sempre o
  MAIOR cooldown entre a prioridade atual e a da última entrega (uma entrega HIGH recente também
  segura a próxima MEDIUM) — exceto `CRITICAL`, que só respeita o próprio cooldown, nunca fica
  preso atrás do cooldown de um aviso menos urgente
- [x] `AiCoachService.deliverLiveTacticalFeedback()` — orquestra prioridade + cooldown +
  `explainDecision` (Tarefa 23) + persistência; respeita `feedbackLevel = 'silencioso'`
  (nenhuma chamada de IA, mesma regra de `generateEventFeedback`) acima de qualquer prioridade;
  persiste via `CoachFeedback` com `feedbackType: 'tactical_feedback'` (valor novo do campo
  `String` livre já existente — sem migration); best-effort, retorna `null` quando a IA falha
- [x] 15 novos testes (289 na suíte completa da API); `tsc --noEmit` e `nest build` validados
  sem regressão

### Tactical Engine — Fase 7: Robustez (fecha o plano original de 39 tarefas)

Última fase do roadmap original do Tactical Engine (7 fases, 39 tarefas — ver
`docs/tactical-engine-domain.md`). Fecha o motor como projeto completo e testado contra
fixtures; **não** fecha o gap estrutural documentado desde a Tarefa 1 (auditoria): continua sem
nenhuma fonte real de posição de jogadores/bola, então tudo aqui segue isolado atrás de
fixtures/interfaces, sem nenhum worker real invocando o motor.

- [x] **Tarefas 29/30 — Sistema de confiança + anti-falso-positivo** (`confidence.evaluator.ts`)
  — `evaluateConfidence()` agrega os sinais de confiança que `TacticalGameState`/`VirtualPlayer`
  já carregavam desde a Fase 1 mas nenhum código usava (`gameState.confidence`,
  `VirtualPlayer.confidence`), usando sempre o MENOR sinal disponível (nunca o mais otimista).
  `decision.evaluator.ts` passa a retornar `null` também quando a confiança agregada é
  insuficiente (< 0.5), mesmo com uma candidata de ação válida — fecha o anti-falso-positivo com
  um sinal numérico, além da recusa estrutural (ação não reconhecida) que já existia desde a
  Fase 3
- [x] **Tarefa 34 — Dataset de fixtures** (`tactical-fixtures.ts`) — cenários nomeados
  reutilizáveis (reciclagem segura, contra-ataque 3×2, sobrecarga central, passe central sob
  pressão, confiança insuficiente, elenco completo 11×11); specs já existentes não foram
  migradas (evita mexer em suítes já passando), mas o dataset já sustenta o teste de integração
  abaixo e fica disponível para uso futuro
- [x] **Tarefas 31/32/33 — Performance + testes de integração**
  (`tactical-engine.integration.spec.ts`) — primeiro teste que encadeia várias fases de verdade
  (avaliação de decisão → julgamento de princípios → detecção de padrões entre partidas →
  perfil estratégico → relatório/timeline/detalhe), em vez de testar cada peça isolada; mais uma
  guarda de performance (200 decisões avaliadas sobre um elenco de 22 jogadores em menos de 3s —
  não é benchmark de precisão, é guarda contra regressão grave tipo um `O(n²)` introduzido por
  engano)
- [x] **Tarefa 35 — Feature flag** (`TacticalEngineFeatureFlagService`, `TACTICAL_ENGINE_ENABLED`
  via `ConfigService`) — desabilitada por padrão (nenhuma fase foi validada contra dados reais
  ainda); gateia os dois pontos de entrada de `AiCoachService` (`explainDecision`,
  `deliverLiveTacticalFeedback`)
- [x] **Tarefa 36 — Telemetria** — logging estruturado (`Logger.debug`) nos pontos de decisão de
  `AiCoachService`: flag desabilitada, cooldown bloqueando entrega ao vivo (com a prioridade
  envolvida) — reusa o `Logger` que o resto do arquivo já usa, sem lib nova
- [x] **Tarefas 37/38 — Documentação** — `docs/tactical-engine-api.md` (referência da API
  TypeScript pública, por fase — não há endpoint HTTP ainda) e `docs/tactical-engine-scoring.md`
  (algoritmo de scoring completo: 6 componentes, pesos, classificação, limitações conhecidas,
  sistema de confiança) — este último era referenciado em comentários desde a Fase 3
  (`decision-score.type.ts`) mas nunca tinha sido escrito
- [x] **Tarefa 39 — `TacticalStateProvider`** — já implementada desde a Fase 1
  (`tactical-state-provider.interface.ts`); confirmada aqui sem mudança de código, continua sem
  implementação real
- [x] 30 novos testes (319 na suíte completa da API); `tsc --noEmit` e `nest build` validados
  sem regressão

**Tactical Engine: roadmap original completo (Fases 1–7, 39/39 tarefas).** Continua sem
controller/endpoint HTTP público e sem nenhuma fonte real de `TacticalGameState` — esse gap é
estrutural (falta um pipeline de visão computacional que não existe no projeto, achado desde a
Tarefa 1) e não faz parte do plano original de 39 tarefas. Qualquer próximo passo (endpoint
público, integração real com `game-analysis`/`capture-sessions`, pipeline de visão
computacional) é uma decisão de produto nova, não uma fase já planejada — a discutir com o
usuário quando/se fizer sentido priorizar.

## Próxima tarefa

**Revalidar a captura da extensão após o fix de transporte de frame (CHANGELOG 0.38.3)** — a
validação de ponta a ponta desta rodada (login → escolha de partida → captura ao vivo) achou um bug
crítico, não falta de calibração como eu tinha diagnosticado a princípio: `chrome.runtime.sendMessage`
não transferia o `ArrayBuffer` do frame de forma confiável entre o content script e o service worker,
então todo frame chegava na API como 15 bytes de texto `"[object Object]"`, nunca uma imagem de
verdade — por isso `GameStateDetectorService` falhava em 100% das amostras. Corrigido codificando o
frame em base64 antes de mandar a mensagem. Falta repetir a validação manual (extensão recarregada +
aba do Xbox nova) para confirmar que os frames agora chegam como PNG válido e que
`GameStateDetectorService` consegue de fato classificar `menu`/`match_running`. **Só depois disso**
faz sentido calibrar os limiares (`STATIC_THRESHOLD`, `ACTIVE_THRESHOLD`, `SPIKE_THRESHOLD` e os 2 de
confiança) com dados reais — calibrar em cima de frames corrompidos não serviria de nada. Depois
disso, o roadmap segue com: geração automática de `VideoSegment` a partir de eventos detectados, e
as Fases 3–4 (voz, tracking, modelo próprio) — ver `docs/REMOTE_PLAY_CAPTURE.md`.

---

## Ambiente de desenvolvimento

| Item | Status |
|---|---|
| Banco de dados | Configurado via Docker (não inicializado — rodar `docker-compose up -d`) |
| Migrations | `20260716152320_init` gerada e commitada (`apps/api/prisma/migrations/`) |
| Dependências npm | Instaladas na raiz (`npm install`); Prisma Client gerado (`prisma generate`) |
| API | Não iniciada |
| Frontend | Não iniciado |

> **Nota:** se o repositório estiver dentro de uma pasta sincronizada por OneDrive/Dropbox/iCloud,
> o sync em segundo plano pode "tocar" arquivos do projeto sem mudar o conteúdo, confundindo o
> file-watcher do Next.js e disparando um Fast Refresh em momento ruim (tela em branco por um
> instante — resolve com F5). Não é um bug da aplicação; pausar a sincronização durante o
> desenvolvimento elimina o problema.

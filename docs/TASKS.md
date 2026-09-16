# Tasks — Coach Play

## Fase 1 — Base

- [x] **Task 1.1** — Scaffold do monorepo (root package.json, estrutura de pastas)
- [x] **Task 1.2** — Configurar Docker (docker-compose.yml com PostgreSQL 16 e Redis 7)
- [x] **Task 1.3** — Criar projeto NestJS (apps/api com main.ts, app.module, package.json)
- [x] **Task 1.4** — Criar projeto Next.js (apps/web com layout, middleware, lib/api.ts)
- [x] **Task 1.5** — Configurar Prisma com schema inicial (11 tabelas)
- [x] **Task 1.6** — Criar estrutura modular do backend (stubs de 10 módulos + shared)

---

## Fase 2 — Autenticação

- [x] **Task 2.1** — Implementar módulo Auth no backend
  - Registro: `POST /api/v1/auth/register` (argon2, email único, criar subscription Free)
  - Login: `POST /api/v1/auth/login` (JWT 15min + refresh token 7d em httpOnly cookie)
  - Logout: `POST /api/v1/auth/logout` (invalidar refresh token)
  - Refresh: `POST /api/v1/auth/refresh` (rotação de refresh token)
  - Me: `GET /api/v1/auth/me` (retornar usuário autenticado)
  - Rate limit: 5 req/min no login
  - Bloqueio após 10 tentativas inválidas

- [x] **Task 2.2** — Implementar módulo Users no backend
  - `GET /api/v1/users/:id` — ver perfil
  - `PUT /api/v1/users/:id` — editar perfil
  - `PATCH /api/v1/users/:id/status` — admin bloquear/ativar
  - `DELETE /api/v1/users/:id` — soft delete
  - Usuário só edita seu próprio perfil (validar `user_id`)

- [x] **Task 2.3** — Tela de Login funcional (frontend)
  - Form com React Hook Form + Zod
  - Integração com `POST /auth/login`
  - Redirect para `/dashboard` após sucesso
  - Mensagem de erro amigável

- [x] **Task 2.4** — Tela de Cadastro funcional (frontend)
  - Form com validação (nome, email, senha, confirmar senha)
  - Integração com `POST /auth/register`
  - Redirect para `/dashboard` após cadastro

- [x] **Task 2.5** — Recuperação de senha
  - Backend: `POST /auth/forgot-password` (gerar token + enviar email)
  - Backend: `POST /auth/reset-password` (validar token + atualizar senha)
  - Frontend: telas de forgot-password e reset-password

- [x] **Task 2.6** — Guards e proteção de rotas end-to-end
  - `JwtAuthGuard` funcionando em todas as rotas protegidas
  - `RolesGuard` bloqueando rotas admin
  - Middleware Next.js redirecionando rotas protegidas sem sessão
  - Testes: usuário sem login não acessa `/dashboard`

---

## Fase 3 — Partidas

- [x] **Task 3.1** — Módulo Matches no backend
  - `POST /api/v1/matches` — criar partida
  - `GET /api/v1/matches` — listar partidas do usuário autenticado
  - `GET /api/v1/matches/:id` — detalhe (apenas dono)
  - `PUT /api/v1/matches/:id` — editar metadados
  - `DELETE /api/v1/matches/:id` — soft delete

- [x] **Task 3.2** — Upload de vídeo
  - `POST /api/v1/matches/:id/video` — upload com multer
  - Validação: formato (mp4, mov, avi), tamanho máximo (500MB), duração (90min)
  - Armazenamento local (preparado para S3)
  - Retornar URL do vídeo

- [x] **Task 3.3** — Tela "Minhas Partidas" (frontend)
  - Lista paginada de partidas com status e data
  - Cards com placar, modo de jogo e status de análise

- [x] **Task 3.4** — Tela "Nova Partida" (frontend)
  - Form com metadados (título, modo, data, placar)
  - Upload de vídeo com preview e barra de progresso
  - Integração com API

---

## Fase 4 — Análise

- [x] **Task 4.1** — Extração de frames via FFmpeg
  - Processar vídeo em trechos de 30 segundos
  - Extrair frames-chave para análise
  - Armazenar temporariamente

- [x] **Task 4.2** — Fila de processamento (BullMQ)
  - Queue `video-processing` no Redis
  - Worker para processar vídeos em background
  - Atualizar status da partida a cada etapa

- [x] **Task 4.3** — Módulo Game Analysis
  - Detectar eventos básicos por análise de frames
  - Classificar por categoria (defesa, ataque, passe, finalização, decisão, posicionamento)
  - Salvar GameEvents e DetectedErrors no banco

- [x] **Task 4.4** — Módulo AI Coach
  - Integração com Claude claude-sonnet-4-6 (Anthropic) — análise multimodal
  - Fallback para GPT-4o (OpenAI) se falhar
  - Controle de custo por análise
  - Salvar AIAnalysis com resumo e custo estimado

---

## Fase 5 — Relatórios

- [x] **Task 5.1** — Módulo Reports no backend
  - `GET /api/v1/matches/:id/report` — relatório da partida
  - `GET /api/v1/reports/evolution` — evolução por período
  - `GET /api/v1/reports/summary` — resumo geral

- [x] **Task 5.2** — Dashboard do jogador (frontend)
  - Cards: partidas analisadas, erro mais frequente, nota média, evolução semanal
  - Última partida, próxima recomendação de treino

- [x] **Task 5.3** — Tela de Relatório da partida (frontend)
  - Resultado e nota geral
  - Principais erros com categorias e severidade
  - Lances críticos com timestamp
  - Pontos positivos
  - O que treinar
  - Resumo da IA Coach

- [x] **Task 5.4** — Tela de Evolução (frontend)
  - Histórico de notas ao longo do tempo
  - Erros mais frequentes por categoria
  - Comparação entre partidas

---

## Fase 6 — Planos

- [x] **Task 6.1** — Módulo Plans no backend
  - Seed com planos: Free, Pro, Premium
  - `GET /api/v1/plans` — listar planos
  - `GET /api/v1/subscriptions/me` — ver meu plano
  - Middleware que bloqueia análise se limite do plano foi atingido

- [x] **Task 6.2** — Controle de limite de uso
  - Registrar consumo em UsageLog a cada análise
  - Retornar erro 402 quando limite atingido

- [x] **Task 6.3** — Tela de Plano atual (frontend)
  - Exibir plano, limite, consumo atual e data de renovação

---

## Fase 7 — Produção

- [x] **Task 7.1** — Logs e auditoria completos
  - Registrar: login, cadastro, logout, upload, análise, erros, mudança de plano

- [x] **Task 7.2** — Testes
  - Usuário sem login não acessa rotas protegidas
  - Usuário não vê partidas de outro usuário
  - Admin acessa painel admin, jogador não
  - Upload rejeita formato inválido
  - Plano Free respeita limite
  - Fallback de IA funciona

- [x] **Task 7.3** — Segurança e revisão
  - Rate limiting em todos os endpoints críticos
  - Validação de upload (tipo, tamanho, duração)
  - Revisão de exposição de dados sensíveis

- [x] **Task 7.4** — Deploy em VPS
  - Configurar Nginx como reverse proxy
  - Configurar SSL (Let's Encrypt)
  - Configurar backup automático do PostgreSQL
  - Deploy com docker-compose em produção

---

## Fase 8 — Tactical Engine (novo subdomínio, pós Fase 7, concluída — Fases 1–7/39 tarefas)

Plano completo, domínio e roadmap por fases em [`docs/tactical-engine-domain.md`](tactical-engine-domain.md);
auditoria pré-implementação em [`docs/tactical-engine-current-state.md`](tactical-engine-current-state.md);
algoritmo de scoring em [`docs/tactical-engine-scoring.md`](tactical-engine-scoring.md); referência
de API em [`docs/tactical-engine-api.md`](tactical-engine-api.md). Motor completo e testado contra
fixtures — segue sem nenhuma fonte real de dados (`TacticalStateProvider` sem implementação real,
feature flag desabilitada por padrão) e sem endpoint HTTP público.

### Fase 1 — Fundação (concluída)
- [x] **Tarefa 1** — Auditoria da arquitetura atual
- [x] **Tarefa 2** — Domínio estratégico / linguagem ubíqua
- [x] **Tarefa 3** — Representação normalizada do campo (`PitchCoordinate`, `getPitchZone`)
- [x] **Tarefa 4** — Módulo `tactical-engine` (estrutura flat)
- [x] **Tarefa 5** — `TacticalGameState`/`VirtualPlayer`
- [x] **Tarefa 6** — Persistência Prisma (`TacticalSnapshot`/`TacticalPlayer`)

### Fase 2 — Inteligência espacial (concluída)
- [x] **Tarefa 7** — Linhas de passe (`PassingLane`)
- [x] **Tarefa 8** — Pressão (`PressureEvaluator`)
- [x] **Tarefa 9** — Espaço livre (`SpaceEvaluator`)
- [x] **Tarefa 10** — Superioridade numérica
- [x] **Tarefa 11** — Segurança defensiva (`DefensiveBalanceEvaluator`)

### Fase 3 — Motor de decisões (concluída)
- [x] **Tarefas 12–17** — Ações candidatas, `DecisionScore`, classificação, `DecisionEvaluator`,
  árvore de decisão de curto horizonte, sequências táticas

### Fase 4 — Princípios estratégicos (concluída)
- [x] **Tarefa 18** — Catálogo de princípios (inspirado em xadrez, traduzido para futebol)
- [x] **Tarefa 19** — Iniciativa
- [x] **Tarefa 20** — Overload/switch
- [x] **Tarefa 21** — Padrões do jogador (entre partidas)
- [x] **Tarefa 22** — Perfil estratégico

### Fase 5 — Coach (concluída)
- [x] **Tarefa 23** — Integração com `ai-coach` (`AiCoachService.explainDecision`)
- [x] **Tarefa 24** — Novo formato de feedback (`TacticalDecisionFeedback`)
- [x] **Tarefa 25** — Relatório pós-jogo (`TacticalMatchReport`)
- [x] **Tarefa 26** — Timeline (`TacticalTimelineEntry[]`)
- [x] **Tarefa 27** — Detalhe de decisões (`DecisionDetail`)

### Fase 6 — Tempo real (concluída)
- [x] **Tarefa 28** — Feedback estratégico durante a partida (com prioridade e cooldown)

### Fase 7 — Robustez (concluída)
- [x] **Tarefa 29** — Sistema de confiança (`confidence.evaluator.ts`)
- [x] **Tarefa 30** — Anti-falso-positivo (confiança insuficiente → `evaluateDecision()` retorna `null`)
- [x] **Tarefa 31** — Performance (teste de guarda em `tactical-engine.integration.spec.ts`)
- [x] **Tarefas 32/33** — Testes unitários/integração (`tactical-engine.integration.spec.ts`)
- [x] **Tarefa 34** — Dataset de fixtures (`tactical-fixtures.ts`)
- [x] **Tarefa 35** — Feature flag (`TACTICAL_ENGINE_ENABLED`, `TacticalEngineFeatureFlagService`)
- [x] **Tarefa 36** — Telemetria (logging estruturado em `AiCoachService`)
- [x] **Tarefa 37** — Documentação de API (`docs/tactical-engine-api.md`)
- [x] **Tarefa 38** — Documentação do algoritmo de scoring (`docs/tactical-engine-scoring.md`)
- [x] **Tarefa 39** — Interface `TacticalStateProvider` (já adiantada na Fase 1, confirmada aqui)

---

## Módulo eFootball (em andamento)

Novo subdomínio multi-jogo, transformando o Coach Play numa plataforma de treinamento para
futebol virtual começando pelo eFootball. Plano completo (24 tarefas), auditoria e progresso em
[`docs/efootball-architecture.md`](efootball-architecture.md); documentação técnica por módulo em
[`docs/efootball/`](efootball/).

- [x] **Tarefa 1** — Auditoria da arquitetura atual (`docs/efootball-architecture.md`)
- [x] **Tarefa 2** — Domínio `Game`/`GameProvider`/`GameVersion`/`GameDataSource`
- [x] **Tarefa 3** — Banco de jogadores (`Player`/`PlayerCard` + atributos/skills/playstyles)
- [x] **Tarefa 4** — Pipeline de importação `efootball-data-provider` (fetch→normalize→validate→version→import)
- [x] **Tarefa 5** — Player Build Engine (motor determinístico, 8 estratégias)
- [x] **Tarefa 6** — Comparador de builds (`POST /player-builds/compare`)
- [x] **Tarefa 7** — Player Scanner (identificação de carta por screenshot, sem IA generativa)
- [x] **Tarefa 8** — Meus Jogadores (`UserPlayer`/`UserPlayerBuild`, "Meu Elenco")
- [x] **Tarefa 9** — Squad Builder (6 formações, motor de escalação determinístico)
- [x] **Tarefa 10** — Coach de Elenco (`efootball-coach`, IA só explica o resultado do Squad Builder)
- [x] **Tarefa 11** — Economy/Coins Advisor (motor determinístico, `INSUFFICIENT_DATA` sem odds verificadas)
- [x] **Tarefa 12** — Academia CoachPlay (5 trilhas por nível, 12 módulos, desbloqueio sequencial)
- [x] **Tarefa 13** — Onboarding (`POST /onboarding/efootball`, aponta trilha inicial pelo nível)
- [x] **Tarefa 14** — Ask Coach / Intent Router (`POST /ask-coach`, 5 intents + UNKNOWN)
- [x] **Tarefa 15** — Integração com Match Analysis (recomendação de aula informada pela
  categoria de erro mais frequente das partidas reais já analisadas — só agregação, ver risco 3)
- [x] **Tarefa 16** — Progresso (`GET /progress/me`, agrega Academia/elenco/builds/squads/
  economia/Match Analysis em `UserProgressSnapshot`)
- [x] **Tarefa 17** — Recomendação adaptativa (`GET /recommendations/next-best-action`, cadeia
  de prioridade sobre onboarding/elenco/squad/Match Analysis/Academia; `POST .../:id/dismiss`)
- [x] **Tarefa 18** — Frontend (10 rotas em `(dashboard)/efootball/`, `Sidebar` estendida; UI
  enxuta cobrindo os 15 engines de backend das Tarefas 2–17 — ver `docs/efootball/frontend.md`)
- [x] **Tarefa 19** — Segurança (auditoria transversal das Tarefas 2–18: rate limit em 3
  endpoints caros/de IA, cap de tamanho no prompt do Ask Coach, validação de `gameId` em 2
  endpoints, teste do filtro de upload do Player Scanner — ver `docs/efootball/security-review.md`)
- [x] **Tarefa 20** — Controle de custo de IA (`costEstimate` real, por token, em toda chamada de
  IA do módulo — Coach de Elenco/Build e Ask Coach; antes descartado inteiramente — ver
  `docs/efootball/ai-cost-control.md`)
- [x] **Tarefa 21** — Observabilidade (`AiCallLog`, histórico consultável por chamada de IA —
  `llm_cost`/`llm_latency` — + `GET /admin/efootball-ai-usage`; ver `docs/efootball/observability.md`)
- [x] **Tarefa 22** — Testes E2E (`apps/api/test/` criado do zero — nunca existira, `test:e2e`
  sempre falhava por ausência de configuração; 8 passos reais encadeando módulos de verdade —
  ver `docs/efootball/e2e-testing.md`)
- [x] **Tarefa 23** — Regressão (4 builds + 4 suítes de teste do monorepo inteiro, 756 testes,
  zero regressão no pipeline clássico de EA FC — ver `docs/efootball/regression.md`)
- [x] **Tarefa 24** — Documentação final (`docs/efootball/README.md` — API completa, mapa dos
  19 docs técnicos, modelo de dados, limitações consolidadas, próximos passos)

---

## Base Oficial de Documentação do eFootball (em andamento — novo prompt, 32 tarefas)

Subdomínio **separado** do módulo eFootball acima (já fechado, 24/24) — documentação oficial
versionada e auditável (fonte → documento → versão → regra → validação → engine → AI Coach),
nunca dado inventado por LLM. Auditoria pré-implementação em
[`docs/efootball/documentation-architecture.md`](efootball/documentation-architecture.md).

- [x] **Tarefa 1** — Auditoria da arquitetura existente (achados: `GameVersion`≈`GameRelease`
  pedida, `GameDataSource`/`DataImportRun` são o padrão a seguir mas não a reaproveitar
  diretamente, sem cache/sanitização de HTML/proteção SSRF hoje)
- [x] **Tarefa 2** — Modelo de fonte (`DocumentationSource`, `POST/GET/PATCH /documentation-sources`,
  `@Roles('admin')`; SSRF bloqueado por design + allowlist de domínio deny-by-default via
  `DOCUMENTATION_SOURCE_ALLOWED_DOMAINS`; `trustLevel: AUTHORITATIVE` exclusivo de `sourceType:
  OFFICIAL` — ver `docs/efootball/documentation-sources.md`)
- [x] **Tarefa 3** — Registro de documentos (`GameDocument`, upsert por `(gameId, url)`,
  `contentHash` sha256 derivado no servidor, `POST/GET/PATCH /game-documents`, `@Roles('admin')`
  — ver [`docs/efootball/game-documents.md`](efootball/game-documents.md))
- [x] **Tarefa 4** — Coletor de documentação (`documentation-ingestion`: fetch com
  timeout/retry/redirect seguro/limite de tamanho + sanitização real via `sanitize-html` +
  normalização; delega hash/comparação/armazenamento pro `GameDocumentsService` da Tarefa 3 —
  documento idêntico não cria versão desnecessária; `POST /documentation-ingestion`,
  `@Roles('admin')` — ver [`docs/efootball/documentation-ingestion.md`](efootball/documentation-ingestion.md))
- [x] **Tarefa 5** — Versionamento de documentos (`GameDocumentVersion`, histórico imutável;
  `GameDocumentsService.registerDocument` grava v1 no cadastro e vN+1 a cada alteração real
  detectada — documento idêntico não gera versão desnecessária; `GET /game-documents/:id/versions`
  — ver [`docs/efootball/game-document-versions.md`](efootball/game-document-versions.md))
- [x] **Tarefa 6** — Detector de alterações (`DocumentationDiffService`, diff por LCS
  linha-a-linha + palavra-a-palavra, `DocumentChange` PENDING por mudança detectada; corrige
  defeito retroativo em `htmlToPlainText` da Tarefa 4 — blocos HTML agora viram linhas separadas,
  pré-requisito pra detecção de seção funcionar; `POST/GET /documentation-diff` — ver
  [`docs/efootball/documentation-diff.md`](efootball/documentation-diff.md))
- [ ] **Tarefas 7–32** — `GameRule`, revisão admin,
  matriz de confiança, conflitos, data health, painel admin, `GameRelease`→`GameVersion`, regras
  temporais, API de conhecimento, integração com Player Build Engine/Ask Coach, resposta com
  fonte, Academia, gerador assistido, monitoramento, alertas, auditoria, cache, segurança do
  coletor, fallback, observabilidade, e2e, teste de alteração real, regressão, documentação
  técnica, painel Data Health

**Roadmap original de 24 tarefas do módulo eFootball: 24/24 concluídas.**

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

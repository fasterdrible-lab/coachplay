# Arquitetura — Coach Play

## Visão geral

Coach Play é um **monolito modular** com Clean Architecture e Domain-Driven Design. A separação em módulos garante fronteiras claras entre domínios sem a complexidade de microsserviços.

```
[Coach Play Desktop — Electron, apps/desktop]  ──HTTPS/JWT──┐
        │ (Xbox Remote Play na tela do PC)                  │
[Coach Play Extension — Chrome MV3, apps/extension] ─HTTPS/JWT─┤
        │ (Xbox Remote Play na aba do navegador)             │
        ▼                                                    ▼
[Usuário / Browser]                                [NestJS API — Port 3001]
        │                                             ├── Auth Module
        ▼                                             ├── Users Module
[Next.js Frontend — Port 3000]                         ├── Matches Module
        │ HTTP (REST)                                  ├── Video Capture Module
        └──────────────────────────────────────────►   ├── Game Analysis Module  ──► [Gemini / FFmpeg / Frames]
                                                        ├── AI Coach Module       ──► [Claude / GPT-4o / DeepSeek / Groq]
                                                        ├── Capture Sessions Module ──► ver docs/REMOTE_PLAY_CAPTURE.md
                                                        ├── Tactical Engine Module  ──► ver seção própria abaixo
                                                        ├── Reports Module
                                                        ├── Plans Module
                                                        ├── Audit Logs Module (leitura + escrita — @Global)
                                                        ├── Admin Module          ──► agrega Users/Matches/AIAnalysis/AuditLog
                                                        └── Settings Module
                                                             │
                                                             ├── PostgreSQL (Prisma ORM)
                                                             └── Redis (BullMQ — filas de processamento)
```

---

## Mapa de contexto (fluxo de dados)

```
Usuários → Autenticação → Permissões
Usuários → Partidas
Partidas → Upload de Vídeo
Upload de Vídeo ──fila──► Game Analysis
Game Analysis ──eventos──► AI Coach
AI Coach ──análise──► Reports
Reports → Dashboard
Planos → Limite de Análises
Todos os módulos → Audit Logs
Users + Matches + AIAnalysis + AuditLog → Admin (overview/usage, somente role=admin)
```

---

## Estrutura interna de cada módulo

Cada módulo segue a estrutura de Clean Architecture:

```
modules/<nome>/
├── domain/
│   ├── entities/       # Entidades de domínio (sem frameworks)
│   └── repositories/  # Interfaces de repositório
├── application/
│   ├── use-cases/      # Casos de uso (regra de negócio)
│   └── dtos/           # Data Transfer Objects (entrada/saída)
├── infrastructure/
│   └── repositories/  # Implementações com Prisma
├── presentation/
│   └── controllers/   # Controllers NestJS (apenas delegam ao use-case)
└── published-language/
    └── events/         # Contratos públicos para outros módulos
```

**Regra:** nenhum módulo acessa diretamente as entidades internas de outro módulo. A comunicação ocorre apenas via `published-language/`.

---

## Banco de dados — Diagrama de tabelas

```
users ──────── user_preferences (1:1)
  │
  ├─── subscriptions ── plans
  │
  └─── matches ──────── match_videos
           │
           ├─── game_events ── detected_errors
           │
           ├─── ai_analyses
           │
           ├─── match_reports
           │
           └─── tactical_snapshots ── tactical_players

users ─── usage_logs
users ─── audit_logs
users ─── tactical_patterns (Tactical Engine, Fase 4 — recorrência entre partidas)
users ─── tactical_profiles (Tactical Engine, Fase 4 — 1:1, perfil estratégico evolutivo)
```

---

## Fluxo de análise de partida (Fase 4)

```
1. Usuário faz upload do vídeo
   └─► Salva arquivo local → status: pending

2. Match é marcada como "processing"
   └─► Enfileira job em BullMQ (queue: video-processing)

3. Worker processa o vídeo
   ├─► FFmpeg: extrai frames a cada ~2 segundos (grid usado só pelo fallback sintético abaixo)
   ├─► Game Analysis: GeminiVisionService envia o VÍDEO INTEIRO ao Gemini 2.5 Flash (ingestão
   │   nativa — não re-amostra os frames do FFmpeg), que aponta os erros reais com timestamp
   │   exato, categoria e severidade (ver seção "Game Analysis — análise real via Gemini" abaixo)
   ├─► VideoCaptureService.extractFrameAt: extrai o frame exato do timestamp de cada erro
   │   (DetectedError.frameUrl, miniatura exibida na tela de análise)
   ├─► Fallback: sem GEMINI_API_KEY configurada, volta à heurística sintética antiga (eventos por
   │   posição no tempo, sem olhar o vídeo — CHANGELOG 0.49.0)
   └─► Salva GameEvents/DetectedErrors no banco

4. Worker enfileira job de IA (queue: ai-analysis)

5. AI Coach Worker
   ├─► Monta prompt com GameEvents + DetectedErrors
   ├─► Cascata de narração: Claude claude-sonnet-4-6 (multimodal) → GPT-4o → DeepSeek → Groq
   │   (llama-3.3-70b-versatile) — só narra em texto o que o Game Analysis já detectou, nunca
   │   julga se algo foi erro
   └─► Salva AIAnalysis com resumo + custo (soma o custo do Gemini gasto no passo 3)

6. Reports Module gera MatchReport
   └─► Status da partida: analyzed

7. Usuário acessa /matches/:id/report
```

---

## Autenticação — Fluxo JWT

```
Login:
POST /auth/login
  └─► Valida senha (argon2.verify)
  └─► Gera access token (JWT, 15min)
  └─► Gera refresh token (opaque, 7d, salvo no banco)
  └─► Retorna access token no body + refresh em httpOnly cookie

Requisição autenticada:
Authorization: Bearer <access_token>
  └─► JwtAuthGuard valida JWT
  └─► Injeta usuário via @CurrentUser()

Refresh:
POST /auth/refresh (com cookie httpOnly)
  └─► Valida refresh token no banco
  └─► Rotaciona: invalida token antigo, gera novo par
  └─► Retorna novo access token

Logout:
POST /auth/logout
  └─► Invalida refresh token no banco
  └─► Limpa cookie
```

---

## Módulo Admin (`@Roles('admin')` em todas as rotas)

```
GET /admin/overview
  └─► Users.count (total/ativos/bloqueados/inativos)
  └─► Match.count (total/analisadas/processando/falha/aguardando)
  └─► AIAnalysis.aggregate (custo total, contagem, status=done)
  └─► AuditLog.findMany (8 mais recentes)

GET /admin/usage?page=&limit=
  └─► User.findMany (paginado) + AIAnalysis.findMany (via match.userId)
  └─► Agregação em memória por userId (Prisma não agrupa por relação)

GET /audit-logs?page=&limit=&module=&action=
  └─► Leitura paginada do AuditLog (módulo antes só tinha escrita)

GET /users, PATCH /users/:id/status, DELETE /users/:id
  └─► Reaproveitados do Users Module — sem endpoints próprios de gestão de usuário no Admin
      (DELETE já existia no Users Module desde antes; só ganhou botão na tela admin depois)

DELETE /audit-logs/:id
  └─► Exclusão definitiva (sem soft delete — AuditLog não carrega esse campo)

GET/PUT /settings/ai-provider
  └─► Settings Module — status e configuração das chaves de IA (ver seção própria abaixo)
```

Frontend: `(admin)/admin` (overview), `/admin/users` (menu suspenso: bloquear/ativar, excluir),
`/admin/logs` (filtro por módulo, detalhe expansível, seleção múltipla + exclusão em massa,
exclusão individual), `/admin/usage` (custo por usuário + configuração de chaves de IA).

---

## Módulo Settings — chaves de provedores de IA

Permite configurar, pelo painel admin, as chaves de API usadas pelo AI Coach e pelo Game Analysis
(Anthropic, OpenAI, DeepSeek, Groq, Gemini) sem depender só de variável de ambiente.

```
AppSetting (Prisma, linha única id="global")
  anthropicApiKey / openaiApiKey / deepSeekApiKey / groqApiKey / geminiApiKey
      — armazenados como "iv:authTag:ciphertext"
  (AES-256-GCM; chave de criptografia = sha256(JWT_SECRET), sem env var adicional)

SettingsService
  getAiProviderStatus()     → status por provedor: configurado (painel|env var), preview mascarado
  updateAiProviderKeys(dto) → salva (string) ou remove (string vazia) cada chave
  getAnthropicKey() / getOpenAiKey() / getDeepSeekKey() / getGroqKey() / getGeminiKey()
      → painel tem prioridade; cai para a variável de ambiente correspondente se não houver nada salvo

AiCoachService (narração em texto)
  → não guarda mais os clients Anthropic/OpenAI no construtor; cria um novo client por chamada,
    já com a chave resolvida via SettingsService — uma chave nova no painel vale na próxima
    análise, sem reiniciar o servidor
  → loop sobre 4 provedores em cascata: Claude Sonnet 4.6 → GPT-4o → DeepSeek → Groq
    (llama-3.3-70b-versatile) — DeepSeek e Groq usam a própria SDK "openai", só trocando baseURL
    (api.deepseek.com / api.groq.com/openai/v1)

GeminiVisionService (Game Analysis — CHANGELOG 0.49.0)
  → não entra na cascata de narração acima: é chamado antes dela, pelo GameAnalysisService,
    para detectar os erros reais a partir do vídeo inteiro (ver "Fluxo de análise de partida")
  → sem fallback entre provedores (só o Gemini entende vídeo nativamente); sem GEMINI_API_KEY
    configurada, cai para a heurística sintética antiga em vez de tentar outro provedor de IA
```

`GET`/`PUT /settings/ai-provider` — `@Roles('admin')`. UI em `(admin)/admin/usage`.

---

## Módulo Capture Sessions + apps/desktop

Plano completo (arquitetura, modelagem, riscos, roadmap por fases) em
[`docs/REMOTE_PLAY_CAPTURE.md`](REMOTE_PLAY_CAPTURE.md). Resumo:

```
apps/desktop (Electron)              apps/api
  captura tela (consentimento)         CaptureSessionsModule
  desktopCapturer + getUserMedia  ──►    POST /capture-sessions
  state machine local                    PATCH .../{pause,resume,stop}
  servidor HTTP 127.0.0.1                GET .../status
  (/local/capture/*)                     POST .../{frames,segments}
                                        MatchEventsController
apps/extension (Chrome MV3)              GET /matches/:id/events
  chrome.tabCapture + offscreen          GET /matches/:id/feedbacks
  document (caminho principal)    ──►
  content script em xbox.com/play
  <video> da aba + <canvas> (fallback)
  service worker (BackendClient)
  chrome.storage.session (token)
```

Só captura pixels da tela (janela/monitor/região, ou o `<video>` da aba no caso da extensão) —
nenhuma integração com protocolo do Xbox, memória do jogo ou API privada da EA. `apps/desktop` e
`apps/extension` são dois frontends de captura para o mesmo `CaptureSessionsModule`: o desktop
cobre o app nativo Xbox no Windows (e o navegador, via janela/monitor), a extensão cobre só o
fluxo via navegador mas roda dentro da própria aba — nunca precisa do foco que o Remote Play exige
para não pausar o stream (limitação do desktop documentada em `docs/REMOTE_PLAY_CAPTURE.md`). Fase
1 (atual): grava sessão, frames e clipes; Fases 2–4 (roadmap, parcialmente implementadas):
detecção de estado de partida e eventos (Fase 2, ver seção do módulo Capture Sessions), feedback
de IA e voz.

---

## Módulo Tactical Engine

Plano completo (domínio, riscos, roadmap por fases) em
[`docs/tactical-engine-domain.md`](tactical-engine-domain.md) e
[`docs/tactical-engine-current-state.md`](tactical-engine-current-state.md). Resumo:

```
apps/api/src/modules/tactical-engine/    (estrutura flat — mesmo padrão dos demais módulos,
                                           não a estrutura em camadas descrita mais acima)
  pitch-coordinate.type.ts                 PitchCoordinate normalizada (x/y em [0,1])
  pitch-zone.ts                            getPitchZone() — 15 zonas (3 terços × 5 corredores)
  tactical-game-state.type.ts              TacticalGameState / VirtualPlayer
  tactical-state-provider.interface.ts     única costura para uma futura fonte real de dados
  tactical-snapshots.service.ts            persistência via Prisma (TacticalSnapshot/TacticalPlayer)
  passing-lanes/pressure/space/numerical-advantage/defensive-balance.evaluator.ts
                                            avaliadores geométricos (Fase 2)
  action-generator.ts, decision-score.*, decision-classification.ts, decision.evaluator.ts,
  decision-tree.evaluator.ts, tactical-sequence.detector.ts
                                            motor de decisões (Fase 3) — ação real × alternativas
  strategic-principle.type.ts              catálogo de princípios (xadrez → futebol, Fase 4)
  initiative.evaluator.ts, overload-switch.evaluator.ts
                                            iniciativa e sobrecarga/troca de lado (Fase 4)
  principle-adherence.evaluator.ts         julga aderência de 1 decisão aos 8 princípios do catálogo
  tactical-pattern.detector.ts             recorrência de princípios entre PARTIDAS (Fase 4)
  strategic-profile.builder.ts             agrega TacticalPattern em StrategicProfile (Fase 4)
  tactical-patterns.service.ts / tactical-profiles.service.ts
                                            persistência via Prisma (TacticalPattern/TacticalProfile)
  evaluated-decision-record.type.ts        entrada comum dos 3 builders de saída da Fase 5
  tactical-match-report.builder.ts         relatório pós-jogo (Fase 5) — reusa detectTacticalSequences
  tactical-timeline.builder.ts             timeline de decisões (Fase 5)
  decision-detail.builder.ts               objeto canônico de 1 decisão (Fase 5)
  tactical-decision-feedback.type.ts       "novo formato de feedback" (Fase 5) — texto + campos
                                            estruturados; produzido por AiCoachService.explainDecision
  feedback-priority.evaluator.ts           prioridade (LOW-CRITICAL) + cooldown de feedback AO VIVO (Fase 6)
  confidence.evaluator.ts                  sistema de confiança (Fase 7) — agrega sinais, gateia evaluateDecision
  tactical-engine-feature-flag.service.ts  feature flag TACTICAL_ENGINE_ENABLED (Fase 7, desabilitada por padrão)
  tactical-fixtures.ts                     dataset de fixtures reutilizável entre specs (Fase 7, só teste)
  tactical-engine.module.ts
```

Referência completa da API pública (por fase) em [`docs/tactical-engine-api.md`](tactical-engine-api.md);
algoritmo de scoring documentado em [`docs/tactical-engine-scoring.md`](tactical-engine-scoring.md).

**Diferente de todo o resto do backend:** o `tactical-engine` não importa `game-analysis` nem
`capture-sessions` diretamente — consome exclusivamente `TacticalGameState` através de
`TacticalStateProvider`. Isso não é estilo, é necessidade: hoje não existe nenhum pipeline real
de visão computacional no projeto (`game-analysis` é sintético; `capture-sessions` só mede diff
de pixels agregado) — o motor é desenvolvido e testado inteiramente contra fixtures, sem
acoplamento a nenhuma fonte de dado real que ainda não existe.

**Providers Nest vs. funções puras:** só os quatro serviços de persistência
(`TacticalSnapshotsService`, `TacticalPatternsService`, `TacticalProfilesService`) são providers
registrados em `TacticalEngineModule` — todo o resto (avaliadores geométricos, motor de
decisões, catálogo de princípios, detector de padrões, builder de perfil) é função pura
importada diretamente pelo arquivo que precisa dela, sem injeção de dependência.

**Fronteira com `ai-coach` (Fases 5–6):** `AiCoachService.explainDecision()`/`deliverLiveTacticalFeedback()`
(`apps/api/src/modules/ai-coach/ai-coach.service.ts`) são os ÚNICOS pontos do sistema que
importam tipos/funções do `tactical-engine` (`DecisionEvaluation`, `PrincipleAdherence`,
`splitPrincipleAdherence`, `getStrategicPrinciple`, `computeFeedbackPriority`,
`shouldDeliverLiveFeedback`) para montar um prompt e gerar texto — seguem a mesma cascata Claude
→ GPT-4o → DeepSeek → Groq de `analyzeMatch`/`generateEventFeedback`, best-effort (retornam `null` em
vez de lançar quando todos os provedores falham). A direção da dependência é sempre `ai-coach` →
`tactical-engine`, nunca o contrário — o motor continua sem chamar `@anthropic-ai/sdk`/`openai`
diretamente (ver docs/tactical-engine-domain.md, seção 5). A IA só produz o texto de
`TacticalDecisionFeedback.explanation`; classificação, `scoreDifference`, princípios
seguidos/violados e a decisão de ENTREGAR ou não ao vivo (prioridade + cooldown) vêm sempre
prontos do motor, nunca recalculados/decididos pela IA.

Fase 1 (Fundação, concluída): domínio, tipos normalizados de campo, módulo e persistência.
Fase 2 (concluída): inteligência espacial (linhas de passe, pressão, espaço, superioridade
numérica, equilíbrio defensivo). Fase 3 (concluída): motor de decisões (`DecisionScore`,
classificação, árvore de curto horizonte, sequências táticas). Fase 4 (concluída): princípios
estratégicos — catálogo inspirado em xadrez, iniciativa, overload/switch, julgamento de
aderência por decisão, padrões recorrentes entre partidas (`TacticalPattern`) e perfil
estratégico evolutivo (`TacticalProfile`), ambos persistidos por usuário. Fase 5 (concluída):
Coach — integração com `ai-coach` (`explainDecision`), novo formato de feedback
(`TacticalDecisionFeedback`), relatório pós-jogo (`TacticalMatchReport`), timeline
(`TacticalTimelineEntry[]`) e detalhe de decisão (`DecisionDetail`) — todos ainda sem
controller/endpoint público, montados a partir de `EvaluatedDecisionRecord[]` fornecido pelo
chamador. Fase 6 (concluída): tempo real — `feedback-priority.evaluator.ts` classifica cada
`DecisionClassification` numa prioridade (`LOW`-`CRITICAL`) e decide se/quando entregar feedback
ao vivo dado um cooldown por prioridade (o maior erro nunca fica preso atrás do cooldown de um
aviso menor); `AiCoachService.deliverLiveTacticalFeedback()` orquestra prioridade + cooldown +
`explainDecision` + persistência (`CoachFeedback.feedbackType = 'tactical_feedback'`, sem
migration — valor novo de um campo `String` livre que já existia).

**Fase 7 (concluída) — robustez, fecha o roadmap original de 39 tarefas:**
`confidence.evaluator.ts` agrega os sinais de confiança que `TacticalGameState`/`VirtualPlayer`
já carregavam mas nenhum código ainda usava (`gameState.confidence`, `VirtualPlayer.confidence`)
numa única decisão "confiança suficiente para avaliar" (MENOR sinal, nunca o mais otimista;
limiar 0.5) — `decision.evaluator.ts` passa a retornar `null` também quando a confiança é
insuficiente, mesmo com uma candidata válida (fecha o anti-falso-positivo, Tarefa 30, com um
sinal numérico além da recusa estrutural já existente desde a Fase 3).
`tactical-engine-feature-flag.service.ts` (`TACTICAL_ENGINE_ENABLED`, via `ConfigService`,
desabilitada por padrão) gateia os dois pontos de entrada de `AiCoachService`
(`explainDecision`/`deliverLiveTacticalFeedback`) — nenhuma fase do motor foi validada contra
dados reais ainda, então habilitar por padrão arriscaria expor comportamento nunca testado fora
de testes automatizados. `tactical-fixtures.ts` consolida um dataset de cenários nomeados
(reciclagem segura, contra-ataque 3×2, sobrecarga central, confiança insuficiente, elenco
completo 11×11) para reduzir duplicação entre specs e sustentar
`tactical-engine.integration.spec.ts` — o primeiro teste que encadeia várias fases (avaliação →
princípios → padrões → perfil → relatório/timeline/detalhe) contra dados de verdade, mais uma
guarda de performance (200 avaliações sobre 22 jogadores em tempo hábil). Nenhum
worker/pipeline real ainda invoca nada disso — falta uma fonte real de `TacticalGameState`
(mesmo bloqueio de todas as fases anteriores); só a Fase 2 de `capture-sessions`
(motion/estado de jogo) roda contra dados reais hoje.

---

## Identidade visual — NEX-ALS "Dark Luxury UI"

```
Paleta (tailwind.config.ts):
  ink        #080612   fundo principal
  ink2       #0d0a24   fundo secundário / superfícies
  gold       #d9a441   ação primária, navegação ativa
  gold-bright #f2c879  destaque, hover, foco
  violet     #b78dff   acento secundário (seção Admin, badges)
  sucesso/aviso/perigo #6fcf97 / #e0954a / #e2718a (tons joia, separados do dourado de marca)

Tipografia: Sora (--font-display, títulos/marca) + Inter (--font-body, texto corrido) —
substituiu o Inter isolado usado antes do rebrand.

Glassmorphism: bg-ink2/60 + backdrop-blur-xl + border-white/[0.08] em cards/sidebar.
Glow: shadow-gold (box-shadow suave dourado) em CTAs e elementos ativos.
Tema único (dark-only) — decisão deliberada, sem variante clara.
```

O manual do usuário (`apps/web/public/manual.html`) usa a mesma paleta.

`components/ui/dropdown-menu.tsx` — menu suspenso genérico (trigger + itens + separador),
fecha ao clicar fora ou `Esc`, variante `danger` para ações destrutivas. Usado em
`/admin/users` para agrupar bloquear/ativar e excluir em um único menu (ícone `⋮`).

---

## Deploy e infraestrutura

Ver [`docs/DEPLOY.md`](DEPLOY.md) para o runbook completo. Resumo:

```
apps/api/Dockerfile   — multi-stage, Debian bookworm-slim (Alpine/musl incompatível
                         com @ffmpeg-installer/ffmpeg); estágios build → migrator
                         (mantém Prisma CLI) → pruned/production (sem devDependencies)
apps/web/Dockerfile   — multi-stage, Next.js output: 'standalone' (Alpine)
docker-compose.prod.yml
   ├── postgres/redis (rede interna, sem porta exposta ao host)
   ├── api / web (restart: unless-stopped)
   ├── migrate (sob demanda — profiles: [tools] — prisma migrate deploy)
   ├── nginx (reverse proxy + TLS)
   └── certbot (Let's Encrypt, renovação automática a cada 12h)
deploy/nginx/coachplay.conf.template  — / → web:3000, /api/ e /uploads/ → api:3001
deploy/certbot/init-letsencrypt.sh    — bootstrap do primeiro certificado
deploy/backup/backup-postgres.sh      — pg_dump + gzip + rotação, agendável via cron
```

---

## Variáveis de ambiente

| Variável | Uso | Obrigatória |
|---|---|---|
| `DATABASE_URL` | Conexão Prisma com PostgreSQL | Sim |
| `REDIS_URL` | BullMQ + sessões | Sim |
| `JWT_SECRET` | Assinar/verificar JWTs | Sim |
| `JWT_ACCESS_EXPIRES_IN` | Expiração do access token | Sim |
| `JWT_REFRESH_EXPIRES_IN` | Expiração do refresh token | Sim |
| `ANTHROPIC_API_KEY` | IA principal de narração (Claude) | Sim (Fase 4) |
| `OPENAI_API_KEY` | IA fallback de narração (GPT-4o) | Fase 4 |
| `DEEPSEEK_API_KEY` | IA fallback de narração (DeepSeek) — ou configurável via painel admin | Não |
| `GROQ_API_KEY` | IA fallback de narração (Groq, llama-3.3-70b-versatile) — ou configurável via painel admin | Não |
| `GEMINI_API_KEY` | Análise real de vídeo no Game Analysis (Gemini 2.5 Flash, CHANGELOG 0.49.0) — sem fallback pra outro provedor; sem ela, volta à heurística sintética antiga — ou configurável via painel admin | Não |
| `UPLOAD_DIR` | Diretório de vídeos | Sim |
| `MAX_VIDEO_SIZE_MB` | Limite de tamanho de upload | Sim |
| `FRONTEND_URL` | CORS origin permitida | Sim |
| `NODE_ENV` | `development` ou `production` | Sim |
| `TACTICAL_ENGINE_ENABLED` | Feature flag do Tactical Engine (Fase 7) — gateia `explainDecision`/`deliverLiveTacticalFeedback` | Não (default `false`) |
| `DOMAIN` | Domínio do certificado TLS (deploy) | Produção |
| `LETSENCRYPT_EMAIL` | E-mail para avisos do Let's Encrypt | Produção |
| `BACKUP_DIR` / `BACKUP_RETENTION_DAYS` | Diretório e retenção do backup do Postgres | Produção |

---

## Decisões técnicas e justificativas

| Decisão | Justificativa |
|---|---|
| Monolito modular (não microsserviços) | MVP — simplicidade de deploy e depuração; fácil de extrair módulos depois |
| Argon2 em vez de bcrypt | Resistência superior a ataques GPU; recomendação OWASP atual |
| JWT de curta duração (15min) + refresh rotation | Balanceia segurança com usabilidade |
| BullMQ + Redis para processamento de vídeo | Processamento assíncrono — vídeos podem demorar minutos |
| Soft delete com `deleted_at` | Auditoria e possibilidade de restauração |
| Prisma ORM | Type-safe, migrations versionadas, schema como fonte de verdade |
| App Router Next.js 14 | Server Components, layouts aninhados, middleware nativo |
| Componentes de UI próprios (Tailwind) | `Button`/`Input` autorais em vez de uma lib de componentes — total controle sobre o tema Dark Luxury |
| Debian (não Alpine) na imagem da API | `@ffmpeg-installer/ffmpeg` só publica binário glibc; musl quebraria o processamento de vídeo |

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
        └──────────────────────────────────────────►   ├── Game Analysis Module  ──► [FFmpeg / Frames]
                                                        ├── AI Coach Module       ──► [Claude / GPT-4o / DeepSeek]
                                                        ├── Capture Sessions Module ──► ver docs/REMOTE_PLAY_CAPTURE.md
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
           └─── match_reports

users ─── usage_logs
users ─── audit_logs
```

---

## Fluxo de análise de partida (Fase 4)

```
1. Usuário faz upload do vídeo
   └─► Salva arquivo local → status: pending

2. Match é marcada como "processing"
   └─► Enfileira job em BullMQ (queue: video-processing)

3. Worker processa o vídeo
   ├─► FFmpeg: extrai frames a cada ~2 segundos
   ├─► Game Analysis: analisa frames, detecta GameEvents
   └─► Salva DetectedErrors no banco

4. Worker enfileira job de IA (queue: ai-analysis)

5. AI Coach Worker
   ├─► Monta prompt com GameEvents + DetectedErrors
   ├─► Chama Claude claude-sonnet-4-6 (multimodal)
   ├─► Fallback: OpenAI GPT-4o se Claude falhar
   └─► Salva AIAnalysis com resumo + custo

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

Permite configurar, pelo painel admin, as chaves de API usadas pelo AI Coach (Anthropic,
OpenAI, DeepSeek) sem depender só de variável de ambiente.

```
AppSetting (Prisma, linha única id="global")
  anthropicApiKey / openaiApiKey / deepSeekApiKey  — armazenados como "iv:authTag:ciphertext"
  (AES-256-GCM; chave de criptografia = sha256(JWT_SECRET), sem env var adicional)

SettingsService
  getAiProviderStatus()     → status por provedor: configurado (painel|env var), preview mascarado
  updateAiProviderKeys(dto) → salva (string) ou remove (string vazia) cada chave
  getAnthropicKey() / getOpenAiKey() / getDeepSeekKey()
      → painel tem prioridade; cai para a variável de ambiente correspondente se não houver nada salvo

AiCoachService
  → não guarda mais os clients Anthropic/OpenAI no construtor; cria um novo client por chamada,
    já com a chave resolvida via SettingsService — uma chave nova no painel vale na próxima
    análise, sem reiniciar o servidor
  → loop sobre 3 provedores em cascata: Claude Sonnet 4.6 → GPT-4o → DeepSeek
    (DeepSeek usa a própria SDK "openai", só trocando baseURL para api.deepseek.com)
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
  content script em xbox.com/play        GET /matches/:id/feedbacks
  <video> da aba + <canvas>       ──►
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
| `ANTHROPIC_API_KEY` | IA principal (Claude) | Sim (Fase 4) |
| `OPENAI_API_KEY` | IA fallback (GPT-4o) | Fase 4 |
| `UPLOAD_DIR` | Diretório de vídeos | Sim |
| `MAX_VIDEO_SIZE_MB` | Limite de tamanho de upload | Sim |
| `FRONTEND_URL` | CORS origin permitida | Sim |
| `NODE_ENV` | `development` ou `production` | Sim |
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

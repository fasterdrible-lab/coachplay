# AGENT.md — Coach Play

## Instruções para o agente (leia antes de qualquer ação)

Ao iniciar qualquer sessão de trabalho neste projeto:

1. Leia `/docs/CURRENT_STATE.md`
2. Leia `/docs/TASKS.md`
3. Leia `/docs/ARCHITECTURE.md`
4. Leia `/CHANGELOG.md`
5. Continue a próxima tarefa listada em `TASKS.md`
6. Não analise o projeto inteiro
7. Não altere arquivos fora do escopo da tarefa

---

## O que o projeto faz

**Coach Play** é uma plataforma SaaS de análise de partidas de EA FC para jogadores de Xbox.

O jogador envia o vídeo de uma partida e recebe uma análise feita por IA com os principais erros cometidos, categorias de problema (defesa, ataque, passe, finalização, tomada de decisão, posicionamento) e sugestões de melhoria personalizadas.

**Dor resolvida:** o jogador sabe que está errando mas não sabe o quê, quando e por quê. O Coach Play funciona como um treinador digital acessível para jogadores casuais e competitivos.

**MVP — Análise Pós-Jogo:**
1. Usuário cria conta
2. Usuário envia vídeo da partida
3. Sistema processa e extrai frames
4. IA analisa os momentos-chave
5. Sistema gera relatório com erros e dicas
6. Usuário vê onde está errando e como melhorar

---

## Domínio de produção

| Item | Valor |
|---|---|
| Domínio | `coachplay.app` (TBD — pendente registro) |
| Ambiente | VPS + Docker + Nginx + PostgreSQL |
| Porta API | `3001` |
| Porta Web | `3000` |
| MVP | Análise pós-jogo (sem tempo real) |

---

## Stack completa com versões

| Camada | Tecnologia | Versão |
|---|---|---|
| Runtime | Node.js | 20 LTS |
| Frontend | Next.js (App Router) | 14.x |
| Frontend | TypeScript | 5.x |
| Frontend | Tailwind CSS | 3.x |
| Frontend | Shadcn/UI | latest |
| Frontend | React Hook Form | 7.x |
| Frontend | Zod | 3.x |
| Backend | NestJS | 10.x |
| Backend | TypeScript | 5.x |
| Backend | Prisma ORM | 5.x |
| Backend | BullMQ | 5.x |
| Backend | JWT (@nestjs/jwt) | 10.x |
| Backend | Argon2 | 0.31.x |
| Backend | Class-validator / transformer | 0.14.x |
| Banco | PostgreSQL | 16 |
| Fila | Redis | 7.x |
| Infra | Docker + Docker Compose | latest |
| Infra | Nginx | latest |
| Processamento | FFmpeg | sistema |
| IA principal | Claude claude-sonnet-4-6 (Anthropic) | multimodal |
| IA fallback | GPT-4o (OpenAI) | — |

---

## Estrutura do monorepo

```
coach-play/
├── apps/
│   ├── api/                        # Backend NestJS
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── modules/            # Módulos de domínio
│   │   │   │   ├── auth/
│   │   │   │   ├── users/
│   │   │   │   ├── matches/
│   │   │   │   ├── video-capture/
│   │   │   │   ├── game-analysis/
│   │   │   │   ├── ai-coach/
│   │   │   │   ├── reports/
│   │   │   │   ├── plans/
│   │   │   │   ├── audit-logs/
│   │   │   │   └── settings/
│   │   │   ├── shared/             # Utilitários internos
│   │   │   │   ├── database/       # PrismaModule + PrismaService
│   │   │   │   ├── filters/        # Exception filters globais
│   │   │   │   ├── guards/         # JwtAuthGuard, RolesGuard
│   │   │   │   └── decorators/     # @CurrentUser, @Roles
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── nest-cli.json
│   └── web/                        # Frontend Next.js
│       ├── src/
│       │   ├── app/                # App Router
│       │   │   ├── (auth)/         # Rotas públicas
│       │   │   │   ├── login/
│       │   │   │   ├── register/
│       │   │   │   └── forgot-password/
│       │   │   ├── (dashboard)/    # Rotas protegidas
│       │   │   │   ├── dashboard/
│       │   │   │   ├── matches/
│       │   │   │   ├── evolution/
│       │   │   │   ├── settings/
│       │   │   │   └── plan/
│       │   │   ├── (admin)/        # Rotas admin
│       │   │   │   ├── users/
│       │   │   │   ├── logs/
│       │   │   │   └── usage/
│       │   │   ├── layout.tsx
│       │   │   └── page.tsx
│       │   ├── components/
│       │   │   └── ui/             # Componentes Shadcn/UI
│       │   ├── lib/
│       │   │   └── api.ts          # Cliente HTTP centralizado
│       │   └── middleware.ts       # Proteção de rotas Next.js
│       ├── package.json
│       ├── tsconfig.json
│       └── next.config.ts
├── packages/
│   └── shared/                     # Types compartilhados
├── docker-compose.yml
├── .env.example
├── .gitignore
├── AGENT.md
├── CHANGELOG.md
└── docs/
    ├── ARCHITECTURE.md
    ├── CURRENT_STATE.md
    └── TASKS.md
```

---

## Módulos do backend

| Módulo | Responsabilidade | Entidades principais |
|---|---|---|
| `auth` | Login, cadastro, recuperação de senha, JWT, refresh token | UserCredential, Session, PasswordResetToken |
| `users` | Perfil e preferências do jogador | User, UserProfile, UserPreferences |
| `matches` | Registrar, listar e gerenciar partidas | Match, MatchVideo, MatchMetadata |
| `video-capture` | Upload, validação e processamento inicial de vídeo | VideoSource, VideoFile, CaptureSession |
| `game-analysis` | Detectar eventos e erros no vídeo (frames + FFmpeg) | GameEvent, DetectedError, TacticalPattern |
| `ai-coach` | Transformar eventos em feedback textual via IA | AIAnalysis, CoachFeedback, PromptTemplate, AIUsage |
| `reports` | Gerar e exibir relatórios pós-partida | MatchReport, EvolutionReport, ErrorSummary, SkillScore |
| `plans` | Controlar planos e limites de análise | Plan, Subscription, UsageLimit |
| `audit-logs` | Registrar ações importantes do sistema | AuditLog, UsageLog |
| `settings` | Preferências globais e configurações do usuário | UserPreferences |

**Comunicação entre módulos:** via contratos públicos (interfaces e DTOs no `published-language/`). Nenhum módulo importa diretamente de outro exceto pela interface pública.

---

## Rotas do frontend mapeadas

| Rota | Página | Acesso |
|---|---|---|
| `/` | Redirect para `/dashboard` ou `/login` | público |
| `/login` | Tela de login | público |
| `/register` | Cadastro | público |
| `/forgot-password` | Recuperar senha | público |
| `/reset-password` | Redefinir senha (via token) | público |
| `/dashboard` | Dashboard do jogador | autenticado |
| `/matches` | Lista de partidas | autenticado |
| `/matches/new` | Enviar nova partida + upload de vídeo | autenticado |
| `/matches/[id]` | Detalhe da partida | autenticado, dono |
| `/matches/[id]/report` | Relatório da partida | autenticado, dono |
| `/evolution` | Evolução histórica do jogador | autenticado |
| `/settings` | Configurações | autenticado |
| `/plan` | Plano atual e upgrade | autenticado |
| `/admin` | Dashboard admin | `admin` |
| `/admin/users` | Gerenciar usuários | `admin` |
| `/admin/logs` | Logs do sistema | `admin` |
| `/admin/usage` | Uso e consumo de IA | `admin` |

---

## Roles de usuário e regras de autenticação

| Role | Permissões |
|---|---|
| `admin` | Gerencia usuários, planos, logs e configurações do sistema |
| `player_free` | Análise com limite mensal, relatório básico |
| `player_pro` | Mais análises, histórico completo, relatórios avançados |
| `player_premium` | Feedback quasi-tempo-real, plano de evolução personalizado |
| `support` | Visualiza erros técnicos e dados de usuários, sem dados sensíveis |

**Regras de autenticação:**
- JWT com expiração de **15 minutos**
- Refresh token com rotação, expiração de **7 dias**, armazenado em `httpOnly` cookie
- Rate limit no `/auth/login`: **5 tentativas por minuto**
- Bloqueio de conta após **10 tentativas inválidas** consecutivas
- Rotas protegidas por `JwtAuthGuard` no backend e `middleware.ts` no frontend
- Jogador só acessa suas próprias partidas — validação por `user_id` no service
- Chaves de IA **apenas no backend** — nunca expostas ao cliente

---

## Estado atual e próxima tarefa

**Versão:** V.0.1.0
**Fase atual:** Fase 1 — Base (scaffold do monorepo)

Veja [`/docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md) para detalhes do que foi feito.
Veja [`/docs/TASKS.md`](docs/TASKS.md) para a lista completa de tarefas.

---

## Regras obrigatórias

### Banco de dados
- Usar Prisma ORM — nunca raw SQL em application code
- Toda alteração de schema via migration versionada: `prisma migrate dev --name <descricao>`
- Índices obrigatórios: `user_id`, `match_id`, `status`, `created_at`
- Soft delete obrigatório: usar `deleted_at` — nunca deletar fisicamente usuários ou partidas
- Backup configurado antes de qualquer deploy em produção

### Docker
- Todos os serviços rodam via `docker-compose.yml` em dev e produção
- Variáveis de ambiente via `.env` — nunca hardcoded no código
- Volumes persistentes para PostgreSQL e uploads de vídeo
- Healthchecks configurados para postgres e redis

### Frontend
- App Router do Next.js — nunca Pages Router
- Componentes UI via Shadcn/UI — não criar do zero
- Validação de formulários com React Hook Form + Zod
- Todas as chamadas à API passam por `src/lib/api.ts`
- Dados sensíveis nunca passam pelo cliente
- Proteção de rotas via `src/middleware.ts`

### Auth
- Senhas com **Argon2** — nunca bcrypt neste projeto
- JWT assinado com secret de no mínimo 256 bits
- Refresh token em `httpOnly` cookie — nunca em `localStorage`
- `JwtAuthGuard` em todas as rotas protegidas do backend
- `RolesGuard` validado antes de executar qualquer lógica de negócio

### Código
- Regra de negócio fica nos **services** — nunca nos controllers
- Controllers recebem DTO e delegam ao service
- Módulos se comunicam via contratos públicos (DTOs e interfaces)
- Tratamento de erros com filtros globais de exceção (`HttpExceptionFilter`)
- Stack trace nunca exposto ao cliente em produção

---

## Tabela de arquivos de risco

| Arquivo | Motivo de risco |
|---|---|
| `.env` | Contém segredos — nunca commitar; usar `.env.example` como template |
| `apps/api/prisma/schema.prisma` | Alterações geram migrations — irreversíveis em produção sem rollback planejado |
| `apps/api/src/modules/auth/` | Lógica de autenticação — vulnerabilidades aqui comprometem todo o sistema |
| `apps/api/src/modules/plans/` | Controla limites por plano — erros causam vazamento de acesso ou cobranças erradas |
| `apps/api/src/modules/ai-coach/` | Gerencia chaves de IA e custo por análise — vazamento = custo financeiro direto |
| `apps/api/src/shared/guards/` | Guards de autorização — erros expõem rotas protegidas |
| `apps/api/src/shared/filters/` | Exception filters — erros podem expor stack trace em produção |
| `docker-compose.yml` | Configuração de infra — erros podem expor portas ou perder volumes |
| `apps/api/src/app.module.ts` | Módulo raiz — erros aqui quebram toda a aplicação na inicialização |
| `apps/web/src/middleware.ts` | Controla proteção de todas as rotas no frontend |

---

## Comandos úteis

```bash
# Iniciar banco + redis (sem API/web)
docker-compose up -d postgres redis

# Iniciar todos os serviços
docker-compose up -d

# Ver logs em tempo real
docker-compose logs -f api
docker-compose logs -f web

# Rodar migration do banco
cd apps/api && npx prisma migrate dev --name <descricao>

# Abrir Prisma Studio (GUI do banco)
cd apps/api && npx prisma studio

# Gerar Prisma Client após alterar schema
cd apps/api && npx prisma generate

# Instalar todas as dependências do monorepo
npm install

# Iniciar API em modo desenvolvimento
cd apps/api && npm run start:dev

# Iniciar Frontend em modo desenvolvimento
cd apps/web && npm run dev

# Build da API
cd apps/api && npm run build

# Build do Frontend
cd apps/web && npm run build

# Rodar testes unitários
cd apps/api && npm run test

# Rodar testes e2e
cd apps/api && npm run test:e2e

# Verificar tipos TypeScript sem compilar
cd apps/api && npx tsc --noEmit
cd apps/web && npx tsc --noEmit

# Reset completo do banco (APENAS DEV)
cd apps/api && npx prisma migrate reset

# Parar todos os serviços Docker
docker-compose down

# Parar e remover volumes (CUIDADO — apaga dados)
docker-compose down -v
```

---

## Links para os docs de referência

- [NestJS Docs](https://docs.nestjs.com)
- [Prisma Docs](https://www.prisma.io/docs)
- [Next.js 14 App Router](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Shadcn/UI](https://ui.shadcn.com)
- [BullMQ](https://docs.bullmq.io)
- [Argon2 (Node)](https://www.npmjs.com/package/argon2)
- [Zod](https://zod.dev)
- [Docker Compose](https://docs.docker.com/compose)
- [Claude API (Anthropic)](https://docs.anthropic.com)
- [`/docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`/docs/TASKS.md`](docs/TASKS.md)
- [`/docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md)
- [`/CHANGELOG.md`](CHANGELOG.md)

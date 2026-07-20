# Changelog — Coach Play

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

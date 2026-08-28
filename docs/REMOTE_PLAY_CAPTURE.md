# Módulo Captura via Remote Play

Plano técnico e arquitetural para o novo módulo do Coach Play que permite analisar
partidas de EA FC jogadas no Xbox através do **Xbox Remote Play oficial**, capturando
apenas a imagem exibida na tela do PC — com consentimento explícito do usuário.

## O que este módulo NÃO faz (limite não-negociável)

- Não integra com o Xbox por nenhum protocolo privado ou engenharia reversa.
- Não lê memória do console, do emulador do Remote Play ou do processo do EA FC.
- Não usa API privada da EA/Xbox.
- Não controla o jogo, não envia input, não automatiza comandos.
- Não captura nada fora da janela/monitor/região explicitamente autorizada pelo usuário.
- Não promete detecção perfeita — toda leitura visual carrega um nível de confiança,
  e abaixo de um limiar o sistema prefere não dizer nada a inventar.

A única entrada de dados é **pixels da tela do PC**, com o usuário sabendo exatamente
o que está sendo capturado e podendo parar a qualquer momento.

---

## Arquitetura geral

```
┌──────────────────────────┐
│   Xbox (jogo real)       │
└───────────┬──────────────┘
            │ Xbox Remote Play (oficial, app Xbox no Windows)
            ▼
┌──────────────────────────────────────────────────────────┐
│  PC do usuário (Windows 10/11)                           │
│                                                            │
│  ┌────────────────────┐        ┌─────────────────────┐   │
│  │ App Xbox (Remote    │        │ Coach Play Desktop   │   │
│  │ Play) — renderiza    │◄──────│ (Electron)           │   │
│  │ o jogo numa janela   │ captura│                      │   │
│  └────────────────────┘  de tela │ ┌──────────────────┐ │   │
│                                   │ │ Capture Session  │ │   │
│                                   │ │ Manager (state   │ │   │
│                                   │ │ machine)         │ │   │
│                                   │ └────────┬─────────┘ │   │
│                                   │          ▼            │   │
│                                   │ ┌──────────────────┐ │   │
│                                   │ │ Frame Extractor  │ │   │
│                                   │ │ + Frame Buffer   │ │   │
│                                   │ │ (circular, 10–30s)│ │   │
│                                   │ └────────┬─────────┘ │   │
│                                   │          ▼            │   │
│                                   │ ┌──────────────────┐ │   │
│                                   │ │ Local HTTP server│ │   │
│                                   │ │ (127.0.0.1, só    │ │   │
│                                   │ │ localhost)        │ │   │
│                                   │ └────────┬─────────┘ │   │
│                                   └──────────┼────────────┘   │
└──────────────────────────────────────────────┼────────────────┘
                                                │ HTTPS (auth JWT)
                                                ▼
┌───────────────────────────────────────────────────────────────┐
│  Backend SaaS (apps/api — NestJS, já existente)                │
│                                                                  │
│  CaptureSessionsModule ─┬─► CaptureSession (Prisma)             │
│                         ├─► FrameSample                          │
│                         ├─► VideoSegment                         │
│                         └─► GameEvent / CoachFeedback (leitura)  │
│                                                                  │
│  Fila (BullMQ, já existente) ──► Fase 2+: Game State Detector,  │
│                                   Event Detector, AI Coach       │
│                                                                  │
│  AiCoachModule (já existente) ──► análise pós-jogo dos clipes    │
└───────────────────────────────────────────────────────────────┘
                                                │
                                                ▼
                                  apps/web — painel de relatórios
                                  (reaproveita telas de Match/Report
                                  já existentes)
```

**Por que Electron, e não WPF/WinUI ou Tauri:** o resto do monorepo já é 100% TypeScript
(NestJS + Next.js), com `packages/shared` compartilhando tipos. Electron mantém essa
consistência (mesmo time, mesma linguagem, mesmo pipeline de CI) e dá acesso nativo ao
`desktopCapturer`, que cobre window/monitor/região sem exigir C++ nativo. Um app WinUI
nativo ficaria mais leve, mas exigiria outra stack e outro time — fica registrado como
opção de evolução futura (`docs/REMOTE_PLAY_CAPTURE.md` → Riscos) se o consumo de
recursos do Electron se mostrar um problema real em produção.

---

## Estrutura de pastas

```
coach-play/
├── apps/
│   ├── api/                         # já existe
│   ├── web/                         # já existe
│   └── desktop/                     # NOVO
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── main/                # processo principal do Electron (Node)
│       │   │   ├── index.ts
│       │   │   ├── capture-session-state.ts   # state machine pura, sem Electron
│       │   │   ├── capture-session-manager.ts # liga a state machine ao desktopCapturer
│       │   │   ├── frame-buffer.ts             # buffer circular de frames
│       │   │   ├── local-server.ts             # endpoints /local/capture/*
│       │   │   ├── backend-client.ts           # HTTP client para apps/api
│       │   │   ├── ipc-channels.ts             # nomes de canais IPC (contrato)
│       │   │   └── ipc-handlers.ts
│       │   ├── preload/
│       │   │   └── index.ts         # contextBridge — única porta entre main e renderer
│       │   └── renderer/
│       │       ├── index.html
│       │       ├── main.tsx
│       │       ├── App.tsx
│       │       └── components/
│       │           ├── ConsentScreen.tsx
│       │           ├── SourceSelector.tsx
│       │           ├── CapturePreview.tsx
│       │           └── SessionControls.tsx
│       └── tests/
│           ├── capture-session-state.spec.ts
│           └── local-server.spec.ts
├── packages/
│   └── shared/                      # já existe — passa a exportar os tipos de captura
└── docs/
    └── REMOTE_PLAY_CAPTURE.md       # este arquivo
```

---

## Fluxo principal (linha do tempo)

1. Usuário liga o Xbox e abre o Remote Play pelo app Xbox no Windows.
2. Usuário abre o Coach Play Desktop e faz login (reaproveita `POST /auth/login` do
   backend já existente).
3. Tela de **consentimento** explica exatamente o que será capturado — só depois disso
   o seletor de fonte é habilitado.
4. Usuário escolhe: janela do Remote Play, monitor inteiro, ou recorte manual.
5. Preview local aparece antes de qualquer envio — nada sai do PC ainda.
6. Usuário clica em "Iniciar sessão" → `CaptureSession` é criada no backend
   (`POST /capture-sessions`) e a state machine local vai para `running`.
7. Frame Extractor tira frames a 1–5 FPS (configurável), grava no Frame Buffer
   circular (10–30s) e descarta o que não é relevante.
8. Frames amostrados sobem para o backend (`POST /capture-sessions/:id/frames`);
   clipes curtos (quando existir Event Detector, Fase 2+) sobem como
   `VideoSegment` (`POST /capture-sessions/:id/segments`).
9. Backend enfileira processamento assíncrono (BullMQ) — Fase 1 apenas grava e
   prepara para análise pós-jogo; Fases 2+ acionam Game State Detector / Event
   Detector / AI Coach Feedback.
10. Usuário pode pausar/retomar/encerrar a qualquer momento
    (`PATCH /capture-sessions/:id/{pause,resume,stop}`).
11. Se a janela do Remote Play fecha ou o sinal cai, o app detecta e avisa —
    sessão vai para `failed` com `error_message` preenchido.
12. Ao encerrar, o backend gera relatório (`GET /matches/:id/report`, endpoint que
    já existe e será reaproveitado).

---

## Modelagem de dados (Prisma)

Reaproveita `Match`, `GameEvent` e `DetectedError`, que já existem. Novo:

```
capture_sessions
  id, user_id, match_id (nullable), source_type (window|monitor|region),
  source_name, resolution_width, resolution_height, capture_fps, analysis_fps,
  status (starting|running|paused|stopped|failed), error_message,
  started_at, ended_at, created_at, updated_at

frame_samples
  id, capture_session_id, timestamp_ms, frame_path, width, height,
  confidence_score, analysis_status (pending|analyzed|skipped|failed), created_at

video_segments
  id, capture_session_id, match_id (nullable), start_timestamp_ms, end_timestamp_ms,
  file_path, reason (event_detected|manual|periodic),
  status (pending|processing|done|failed), created_at

coach_feedbacks
  id, match_id, event_id (nullable), feedback_type, message, confidence,
  delivered_channel (text|voice|overlay|report), delivered_at, created_at
```

`GameEvent` (já existente) ganha 3 campos novos e opcionais para linkar com este
módulo sem quebrar o fluxo de upload de vídeo que já funciona:
`capture_session_id`, `segment_id`, `evidence` (JSON com a evidência visual —
ex.: bounding boxes, frame de referência).

---

## Plano de captura

- **MVP (Fase 1):** 1–5 FPS de análise, resolução de captura reduzida para 720p
  antes de qualquer processamento, sem feedback ao vivo — só grava e analisa
  depois.
- Fonte sempre explícita: `desktopCapturer.getSources({ types: ['window','screen'] })`
  no processo main; a captura de pixels em si acontece no renderer via
  `navigator.mediaDevices.getUserMedia` com `chromeMediaSourceId` — é assim que o
  Electron expõe o Desktop Capture API do Chromium sem precisar de nenhuma DLL
  nativa adicional.
- Recorte manual (região): implementado com `<canvas>` cortando o frame do
  `getUserMedia` nas coordenadas escolhidas pelo usuário (sem lib extra).
- Perda de sinal: se `videoTrack.readyState !== 'live'` ou a janela de origem some
  da lista de `desktopCapturer.getSources()`, a state machine vai para `failed`.

## Plano de privacidade

- Nenhuma captura inicia sem a tela de consentimento ser aceita nesta sessão do
  app (não é uma preferência global silenciosa — é perguntado a cada nova sessão,
  ou por período configurável).
- Microfone e webcam nunca são solicitados por este módulo.
- Frames temporários vivem só no Frame Buffer (memória/disco temporário) e são
  descartados ao fim da sessão, a menos que façam parte de um `VideoSegment`
  explicitamente salvo (ex.: evidência de um evento, Fase 2+).
- Nenhuma chave de IA (Anthropic/OpenAI/DeepSeek) roda no desktop — o app só fala
  com `apps/api` via HTTPS com o JWT do usuário; a chamada à IA acontece inteiramente
  no backend (`AiCoachModule`, já existente e já com esse cuidado).
- Logs do desktop nunca gravam imagem, token ou chave — só metadados
  (session id, fps, status, timestamps).

## Plano de processamento local

- `FrameBuffer`: array circular de tamanho fixo (ex. `fps * 30` entradas),
  sobrescreve o mais antigo.
- Amostragem: nem todo frame capturado é enviado ao backend — a `analysis_fps`
  (≤ `capture_fps`) decide quantos por segundo realmente saem do PC.
- Segmentação de clipes (Fase 2+, quando existir Event Detector): FFmpeg concatena
  frames do buffer em torno do timestamp do evento (N segundos antes/depois) e
  gera um MP4 H.264 em resolução reduzida.

## Plano de integração com backend

- Autenticação: o desktop reaproveita `POST /auth/login` e guarda o JWT em memória
  de processo (nunca em texto plano em disco) + refresh token conforme já
  implementado em `AuthModule`.
- Upload de frames/segmentos: `multipart/form-data`, mesmo padrão já usado por
  `POST /matches/:id/video` (Multer + limites de tamanho).
- Backpressure: se o backend estiver lento/indisponível, o app continua
  capturando localmente (Frame Buffer) e tenta reenviar — nunca trava a UI nem
  o jogo por causa da rede.

## Plano de IA (fases futuras — não implementado neste MVP)

1. **Game State Detector** (heurísticas simples): presença de HUD/placar/minimapa
   → `MENU | MATCH_RUNNING | PAUSED | REPLAY | POST_MATCH`, sempre com confiança.
   Evita gastar IA analisando menu.
2. **Event Detector**: heurísticas de visão computacional (OpenCV) primeiro;
   YOLO só entra quando houver dataset anotado — nunca antes disso.
3. **AI Coach Feedback**: usa o `AiCoachModule` já existente (Claude → GPT-4o →
   DeepSeek) para transformar eventos com confiança suficiente em frases curtas,
   com limite de dicas por minuto e nível configurável (silencioso/leve/normal/intensivo).
4. **Voz**: TTS opcional, sempre com botão de mutar visível.

---

## Rotas — Backend (`apps/api`)

```
POST   /capture-sessions
PATCH  /capture-sessions/:id/pause
PATCH  /capture-sessions/:id/resume
PATCH  /capture-sessions/:id/stop
GET    /capture-sessions/:id/status
POST   /capture-sessions/:id/frames
POST   /capture-sessions/:id/segments
GET    /matches/:id/events
GET    /matches/:id/feedbacks
```

(`GET /matches/:id/report` já existe em `ReportsModule` e é reaproveitado sem mudança.)

## Endpoints locais — Desktop (`apps/desktop`, servidor HTTP em 127.0.0.1 apenas)

```
GET  /local/capture/sources
POST /local/capture/start
POST /local/capture/pause
POST /local/capture/stop
GET  /local/capture/preview
GET  /local/capture/health
```

Serve para desacoplar a UI (renderer) da lógica de captura (main) por HTTP local
em vez de só IPC — facilita testar com `curl`/Playwright/scripts sem precisar
instanciar o Electron inteiro, e deixa a porta aberta para uma CLI de diagnóstico
no futuro. Só aceita conexões de `127.0.0.1`; nunca expõe a rede.

---

## Ordem de implementação (o que já foi entregue nesta rodada vs. próximos passos)

**Entregue agora (Fase 1, base):**
- Modelagem completa (schema Prisma + migration).
- `CaptureSessionsModule` no backend: lifecycle completo (start/pause/resume/stop/status),
  ingestão de frames e segmentos, leitura de eventos/feedbacks (vazio até Fase 2 popular).
- `apps/desktop`: state machine de sessão (testada), servidor HTTP local, seleção de
  fonte via `desktopCapturer`, preview, tela de consentimento, controles start/pause/stop.
- Testes automatizados do que roda sem GUI (state machine, rotas do servidor local,
  service do backend).

**Entregue nesta rodada (Fase 2 — Game State Detector + Event Detector + feedback quase em
tempo real):**
- `GameStateDetectorService` (`apps/api/src/modules/capture-sessions/game-state-detector.service.ts`):
  heurística de diferença de pixels (`sharp`) entre o frame atual e o anterior da mesma sessão,
  sempre com confidence score. **Não há reconhecimento de HUD/cores específicas do EA FC** — sem
  capturas reais disponíveis para calibrar esse tipo de regra. Dos 5 valores de `FrameGameState`,
  o heurístico MVP só emite `menu` (proxy "estático") e `match_running` (proxy "ativo");
  `paused`/`replay`/`post_match` ficam reservados no schema para uma classificação futura mais
  específica, quando houver imagens reais de referência.
- `EventDetectorService` (`event-detector.service.ts`): heurística de pico de movimento após um
  trecho sustentado de atividade — também aproximada e confidence-scored, com dois limiares
  independentes: um para persistir o `GameEvent` (`EVENT_MIN_CONFIDENCE`), outro mais alto para
  acionar a IA e gerar feedback (`FEEDBACK_MIN_CONFIDENCE`), já que chamadas de IA custam dinheiro.
- Fila BullMQ `capture-frame-analysis` (`capture-frame-analysis.worker.ts`): consome cada
  `FrameSample` recém-enviado (enfileirado a partir de `CaptureSessionsService.addFrame`),
  encadeia detecção de estado → detecção de evento → geração de feedback num único job.
  Sessões sem `matchId` associado classificam o `gameState` normalmente, mas não geram
  `GameEvent`/`CoachFeedback` (esses modelos exigem `matchId`).
- `AiCoachService.generateEventFeedback` (`apps/api/src/modules/ai-coach/ai-coach.service.ts`):
  reaproveita a cadeia de fallback Claude → GPT-4o → DeepSeek já usada por `analyzeMatch`, mas
  com prompt curto (uma frase, ≤20 palavras) por evento em vez do resumo pós-jogo. O limite de
  dicas por minuto reaproveita `UserPreferences.feedbackLevel` (silencioso=0, leve=1, normal=3,
  intensivo=6 — sem migration nova para esse campo).
- Os limiares (`STATIC_THRESHOLD`, `ACTIVE_THRESHOLD`, `SPIKE_THRESHOLD` e os dois de confiança)
  são placeholders validados só com imagens sintéticas em teste — precisam de calibração com
  captura real de Remote Play antes de considerar a detecção confiável em produção.
- Nenhuma rota HTTP nova: tudo roda internamente (consumidor de fila + chamadas serviço a
  serviço), lido pelas rotas de leitura já existentes (`GET /matches/:id/events` e `/feedbacks`).
- `SegmentReason.event_detected` continua sem uso — geração automática de clipe (FFmpeg
  concatenando o `FrameBuffer` do desktop ao redor de um evento) fica para uma rodada futura.

**Validação manual em Windows real (2026-07-20):** primeira vez que o módulo rodou de fato, contra uma
sessão real de Xbox Remote Play via navegador. Encontrados e corrigidos 4 bugs que nenhum teste
automatizado cobria (login ausente no `apps/desktop`, sessão travando em `stopped`/`failed` para sempre,
overflow de `INT4` no timestamp dos frames, trava em cascata no `CaptureFrameAnalysisWorker` que mantinha
todo frame em `skipped`) — detalhes em `CHANGELOG.md` 0.35.0. Também revelou a limitação de foco descrita
na tabela de riscos abaixo, que motivou priorizar a extensão de navegador no roadmap.

**Extensão de navegador — implementada em 2026-07-21 (`apps/extension`, ver `CHANGELOG.md` 0.37.0):**
caminho alternativo ao `apps/desktop` para o fluxo via browser (`xbox.com/play`). Captura direta do
`<video>`/`<canvas>` da aba em vez de re-fotografar uma janela do sistema, e resolve estruturalmente
a limitação de foco descrita na tabela de riscos abaixo, já que roda dentro da própria aba e nunca
precisa do foco da página do Remote Play para pausar/encerrar a captura. Reaproveita 100% do
`CaptureSessionsModule` já existente (mesmos endpoints do desktop) — nenhuma rota nova. Trade-off:
cobre só o fluxo via navegador, não o app nativo Xbox no Windows, que continua exigindo o
`apps/desktop`. Ainda não validada contra uma sessão real (só o `apps/desktop` teve essa validação,
2026-07-20) — carregar em `chrome://extensions` e testar no navegador do usuário é o próximo passo
específico da extensão.

**Vínculo da sessão de captura com uma `Match` — implementado em 2026-07-22 (ver `CHANGELOG.md`
0.38.0):** `apps/desktop` ganhou a tela `MatchSelector` (entre consentimento e seleção de fonte) e
`apps/extension` o mesmo fluxo no popup (`renderSelectMatch`) — ambos listam partidas pendentes
(`GET /matches?status=pending`) ou criam uma nova (`POST /matches`) antes de iniciar a captura, e o
`matchId` escolhido flui até `CaptureSessionsService.create` (que já aceitava o campo desde a Fase
1). Nenhuma rota nova no backend.

**Validação manual de ponta a ponta com `matchId` — feita em 2026-07-22 (`apps/extension`, ver
`CHANGELOG.md` 0.38.2/0.38.3):** login, `renderSelectMatch` e captura ao vivo confirmados contra uma
sessão real de Xbox Remote Play — 162 frames de uma sessão de teste chegaram na API com `matchId`
corretamente vinculado, mas **todos corrompidos**: um bug de transporte fazia `chrome.runtime.sendMessage`
perder o `ArrayBuffer` do frame entre o content script e o service worker, então cada frame salvo em
disco era 15 bytes de texto `"[object Object]"`, nunca uma imagem real — por isso
`GameStateDetectorService` falhava em 100% das amostras (`Input file contains unsupported image
format`), não por falta de calibração dos limiares como o diagnóstico inicial da mesma sessão supôs.
Corrigido codificando o frame em base64 antes de enviar (`src/shared/binary.ts`). Ainda falta
repetir a validação com o fix aplicado para confirmar que os frames chegam como PNG válido de
verdade. `apps/desktop` segue sem essa validação específica (só a extensão foi testada nesta
rodada); usa IPC do Electron para o mesmo tipo de dado, transporte diferente do `chrome.runtime`,
então não há evidência de que tenha o mesmo bug — mas também não foi verificado.

**Reescrita do pipeline de captura da extensão — implementada em 2026-08-28 (`apps/extension`, ver
`CHANGELOG.md` 0.48.0):** substitui o content script/`<video>` heurístico como caminho principal por
`chrome.tabCapture.getMediaStreamId()` + um offscreen document (`offscreen.html`/`offscreen.ts`) —
único jeito de manter um `MediaStream`/`setInterval` vivos sob Manifest V3, já que o service worker
é reciclado a qualquer momento de ociosidade. O upload do frame comprimido sai direto do offscreen
document via `fetch`, nunca cruza `chrome.runtime.sendMessage` com dados binários — evita de origem
a classe de bug do transporte por base64 corrigido no 0.38.3 (esse fix continua valendo só para o
`VideoElementCaptureProvider`, que virou fallback, usado se `tabCapture` não estiver disponível ou
falhar). Ganhos que vieram junto: troca automática de provider com reconexão por backoff em caso de
stream perdido (`CaptureManager`), máquina de estados explícita, backpressure de upload (só o frame
mais recente) e diff de frame antes de processar (pula frames praticamente parados). Ainda não
validado contra uma sessão real de Xbox Remote Play — ver `docs/CURRENT_STATE.md`, seção "Próxima
tarefa".

**Próximos passos (não implementados agora, ficam no roadmap):**
- **Validar o novo pipeline de captura da extensão (`tabCapture` + offscreen) em navegador real,
  depois calibrar os limiares de detecção com captura real (prioridade atual)** —
  `STATIC_THRESHOLD`, `ACTIVE_THRESHOLD`, `SPIKE_THRESHOLD` e os 2 de confiança seguem validados só
  com imagens sintéticas; a tentativa de calibrar com a sessão real de 2026-07-22 não foi
  aproveitável porque todos os frames estavam corrompidos (ver acima, bug já corrigido, mas nunca
  revalidado antes desta reescrita). Sem frames reais confirmados como legíveis com o pipeline
  novo, `GameEvent`/`CoachFeedback` não são gerados mesmo com `matchId` vinculado.
- Geração automática de `VideoSegment` a partir de eventos detectados (FFmpeg no `apps/desktop`
  concatenando frames do `FrameBuffer`, `BackendClient.uploadSegment`).
- Heurísticas específicas de HUD para distinguir `paused`/`replay`/`post_match` (hoje só
  `menu`/`match_running` são emitidos).
- Fase 3: voz, tracking visual, comparação entre partidas.
- Fase 4: modelo próprio (YOLO) treinado com dataset anotado sob consentimento.

---

## Riscos e limitações reais

| Risco / limitação | Impacto | Mitigação |
|---|---|---|
| Remote Play tem latência e depende da rede do usuário | Frames podem estar atrasados ou com artefatos de compressão | MVP prioriza análise pós-jogo; "quase tempo real" é o teto de expectativa, nunca "tempo real" |
| Qualidade de imagem variável (rede, resolução do Remote Play) | Detecção visual (Fase 2+) fica menos confiável em conexões ruins | Todo evento carrega `confidence`; abaixo do limiar, o sistema não gera feedback |
| Electron consome mais CPU/RAM que um app nativo | Pode competir por recursos com o jogo/Remote Play rodando no mesmo PC | FPS de captura baixo por padrão (1–5), resolução reduzida antes de qualquer processamento; monitorar em beta real antes de aumentar frequência |
| `desktopCapturer`/`getUserMedia` não garantem 100% de compatibilidade com todo driver de vídeo | Em alguns PCs a captura de uma janela específica pode falhar e só o monitor inteiro funcionar | UI expõe monitor inteiro como alternativa sempre disponível; detecção de falha avisa o usuário em vez de travar silenciosamente |
| Nenhum dataset anotado existe ainda | YOLO/tracking visual (Fase 4) não têm previsão real sem coleta de dados | Fases 1–3 usam heurísticas + IA multimodal em texto/imagem estática, não modelo customizado |
| Este documento e o código descrevem a lógica de captura e pipeline — a captura real de uma janela de Remote Play não foi (e não pôde ser) testada neste ambiente de desenvolvimento, que não tem GUI do Windows nem o Xbox Remote Play instalado | Bugs específicos de ambiente Windows real só aparecem em teste manual do usuário | Testes automatizados cobrem tudo que não depende de GUI (state machine, rotas HTTP, service do backend); captura de tela real precisa ser validada manualmente no PC do usuário antes de considerar o MVP "pronto" — **feito em 2026-07-20**, ver `CHANGELOG.md` 0.35.0 |
| Xbox Remote Play/Cloud Gaming pausa o stream sozinho quando a aba/janela perde foco ou visibilidade (comportamento do próprio produto Microsoft, não algo que o Coach Play controla) | Focar a janela do `apps/desktop` durante a partida (ex.: para pausar/encerrar a captura) pausa o jogo junto — atrito real de UX descoberto na validação manual | Não há mitigação possível para o `apps/desktop` enquanto a captura for uma janela separada; resolvido para o fluxo via navegador pela extensão (`apps/extension`, implementada em 2026-07-21), que roda dentro da própria aba e nunca precisa de foco — segue existindo apenas para quem usa o app nativo Xbox no Windows |

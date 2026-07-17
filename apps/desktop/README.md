# Coach Play Desktop — Captura via Remote Play

App Electron que captura a tela do PC (janela do Xbox Remote Play, monitor
inteiro, ou recorte) com consentimento explícito do usuário, para análise de
partidas de EA FC. Ver plano completo em `docs/REMOTE_PLAY_CAPTURE.md` na raiz
do monorepo.

## Rodando localmente

```bash
npm install --workspace=apps/desktop   # a partir da raiz do monorepo
npm run start --workspace=apps/desktop # compila (main + renderer) e abre o Electron
```

Variável de ambiente opcional:

- `COACH_PLAY_API_URL` — base da API (padrão: `http://localhost:3001/api/v1`)

## Testes

```bash
npm test --workspace=apps/desktop
```

Cobrem a state machine da sessão (`capture-session-state.ts`) e as rotas do
servidor HTTP local (`local-server.ts`) — nenhum dos dois depende do Electron
em si, então rodam em qualquer máquina/CI sem GUI.

**O que não é (e não pode ser) testado neste ambiente**: enumeração real de
janelas via `desktopCapturer`, captura real de pixels via `getUserMedia`, e o
fluxo completo com o Xbox Remote Play de verdade aberto. Isso precisa ser
validado manualmente em um Windows 10/11 com o app Xbox e Remote Play
rodando — ver a seção "Riscos e limitações" em `docs/REMOTE_PLAY_CAPTURE.md`.

## Estrutura

- `src/main/` — processo principal (Node): state machine, buffer circular,
  cliente do backend, servidor HTTP local (`127.0.0.1` apenas), handlers IPC.
- `src/preload/` — única ponte entre main e renderer (`contextBridge`).
- `src/renderer/` — UI React: consentimento, seleção de fonte, preview e
  controles da sessão.

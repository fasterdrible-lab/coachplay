# Coach Play — Extensão de navegador (Captura Remote Play)

Extensão Chrome (Manifest V3) que captura o Xbox Remote Play **direto na aba**
onde ele está aberto (`xbox.com/.../play/...`), sem precisar de um app
separado — resolve estruturalmente a limitação descoberta validando o
`apps/desktop`: o Xbox Remote Play pausa o stream quando a janela que tem
foco não é a dele, e um app separado precisa desse foco pra pausar/encerrar a
captura. Uma extensão nunca rouba o foco da aba, porque roda dentro dela. Ver
`docs/REMOTE_PLAY_CAPTURE.md` na raiz do monorepo para o plano completo e o
trade-off (só cobre o fluxo via navegador, não o app nativo Xbox no Windows).

## Rodando localmente

```bash
npm install --workspace=apps/extension   # a partir da raiz do monorepo
npm run build --workspace=apps/extension # typecheck + bundle (esbuild) + copia manifest/popup
```

Depois, no Chrome:

1. Abra `chrome://extensions`
2. Ative o "Modo do desenvolvedor" (canto superior direito)
3. "Carregar sem compactação" → selecione `apps/extension/dist`
4. Abra uma aba em `xbox.com/.../play/...` com o Remote Play rodando
5. Clique no ícone da extensão → login → "Iniciar captura desta aba"

A API precisa estar rodando em `http://localhost:3001` (padrão hardcoded em
`src/background/backend-client.ts` — vira configurável quando isso for além
de MVP local).

## Testes

```bash
npm test --workspace=apps/extension
```

Cobre só a lógica pura testável sem um navegador de verdade (`video-picker.ts`
— heurística de qual `<video>` da página é o player do Remote Play). O
restante (content script rodando numa página real, service worker do MV3,
popup) precisa ser validado manualmente no Chrome — mesmo princípio já
aplicado ao `apps/desktop`.

## Estrutura

- `src/shared/` — contrato de mensagens entre popup/background/content e
  lógica pura testável.
- `src/background/` — service worker: autenticação, orquestra o lifecycle da
  sessão de captura com `apps/api`, guarda estado em `chrome.storage.session`
  (só memória, nunca disco — sobrevive a reinícios do service worker dentro
  da mesma sessão do navegador, mas nunca persiste após fechar o Chrome).
- `src/content/` — injetado nas páginas do Remote Play: acha o `<video>`,
  amostra frames via `<canvas>`, manda pro background.
- `src/popup/` — UI da extensão (sem React — só HTML/DOM puro, proporcional
  ao tamanho da UI: login, consentimento, controles de start/pause/stop).

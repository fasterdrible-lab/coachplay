# Frontend — módulo eFootball (Tarefa 18)

> 10 rotas novas em `(dashboard)/efootball/`, cobrindo os 15 engines de backend das Tarefas 2–17.
> Escopo combinado com o usuário: fluxo completo, UI funcional/enxuta — reaproveita os componentes
> `Button`/`Input` e o padrão Dark Luxury UI já existentes (`docs/ARCHITECTURE.md`), sem
> investimento de design nesta rodada.

## Rotas

```
(dashboard)/efootball/
  page.tsx                    Dashboard — GET /progress/me + GET /recommendations/next-best-action
  onboarding/page.tsx         POST /onboarding/efootball
  academy/page.tsx            GET /learning/paths + GET /learning/profile
  academy/[pathId]/page.tsx   GET /learning/paths/:id (+/progress), POST /learning/lessons/:id/complete
  players/page.tsx            GET /user-players, POST /user-players (busca por nome OU Player Scanner)
  players/[id]/page.tsx       Player Build Engine (preview + salvar build), ativar/favoritar/remover
  squads/page.tsx             Squad Builder — gerar preview, salvar elenco, listar elencos
  squads/[id]/page.tsx        Detalhe do elenco + "Perguntar ao Coach de Elenco"
  economy/page.tsx            Economy Advisor — escolher pack, avaliar
  ask-coach/page.tsx          Chat-lite com o Ask Coach (Tarefa 14), campos avançados opcionais
```

`Sidebar` (`components/layout/sidebar.tsx`) ganhou a seção "eFootball" (`efootballNav`, 6 itens) —
estende o array `mainNav` já existente, seguindo a instrução de `docs/efootball-architecture.md`
(seção 1.8): "a Tarefa 18 deve estender o array `mainNav` existente... não criar um sistema de
navegação paralelo".

## 2 gaps de backend encontrados e corrigidos ao construir as telas

Nenhum dos dois muda o comportamento de nenhuma tarefa já fechada — só preenchem uma lacuna que
impedia a tela correspondente de existir:

1. **`PlayerBuildEngineService.generateBuild()` (Tarefa 5) nunca tinha endpoint HTTP.** Só
   `POST /player-builds/compare` (Tarefa 6, compara 2 builds já definidas pelo cliente) existia —
   não havia como o frontend obter uma recomendação de alocação de pontos antes de salvá-la.
   `POST /player-builds/generate` (novo, `PlayerBuildsController`/`Service`) roda o motor e
   devolve o resultado sem persistir nada — o usuário decide se salva via
   `POST /user-players/:id/builds` (Tarefa 8), que continua sem calcular nada sozinho.
2. **Não existia nenhuma leitura de `Pack` (Tarefa 11).** O cliente não tinha como descobrir um
   `packId` válido pra `POST /economy-advisor/evaluate`. `GET /economy-advisor/packs?gameId=`
   (novo) é uma leitura simples (`id`/`name`/`cost`/`currency`/`oddsVerifiedAt`), sem nenhuma
   lógica do motor da Tarefa 11.

## Padrões reaproveitados de `apps/web` existente

- `Button`/`Input` (`components/ui/`), `cn()` (`lib/utils.ts`), cards
  `rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl` — mesmo vocabulário visual
  de `plan/page.tsx`/`matches/new/page.tsx`
- `lib/api.ts` (`api.get/post/patch/delete`) pra todas as chamadas JSON; upload multipart do
  Player Scanner usa `fetch` + `FormData` direto (mesmo padrão de auth manual do upload de vídeo
  em `matches/new/page.tsx`, que usa `XMLHttpRequest` — aqui não precisa de barra de progresso,
  então `fetch` simples basta)
- `getEfootballGameId()` (novo, `lib/efootball.ts`) — cacheia `GET /games` em memória por sessão
  de navegação; só existe 1 jogo hoje (`GameProvider.EFOOTBALL`), evita toda tela repetir a
  mesma chamada

## Resolução de nomes client-side

`SquadBuilderService.generate`/`findOne` (Tarefas 9) devolvem `userPlayerId`, nunca o nome do
jogador (mesmo padrão de `SquadPlayer`, que também não guarda nome — só o
`EfootballCoachService.explainSquad`, Tarefa 10, resolve nomes, e só pro prompt de IA). As telas
`squads/page.tsx`/`squads/[id]/page.tsx` buscam `GET /user-players` uma vez e montam um
`Map<userPlayerId, nome>` no cliente pra exibição — sem endpoint novo.

## Limitações conhecidas desta rodada

- **UI enxuta, não polida** — decisão combinada com o usuário para esta rodada (ver escopo no
  topo). Sem estados de loading refinados por seção, sem animações, sem responsividade além do
  grid básico já usado no resto do `(dashboard)`.
- **Sem validação end-to-end contra dados reais** — Docker não estava disponível nesta sessão
  (Postgres/Redis não sobem), então não foi possível logar de verdade e percorrer o fluxo completo
  (onboarding → adicionar jogador → montar elenco → avaliar pack → Ask Coach) contra a API viva.
  Validado: `next build` (lint + `tsc` + geração estática das 25 rotas) sem erros; servidor de dev
  subido e as 10 rotas novas testadas via `curl` sem sessão (todas retornam 307, mesmo
  redirecionamento de sessão do resto do `(dashboard)`, nenhum erro 500). **Próximo passo**:
  validar em navegador real contra a API com banco de verdade, mesmo padrão de validação manual já
  feito em outras rodadas do projeto (ex.: Capture Sessions, extensão).
- **Player Scanner/Academia/Squad Builder dependem de dado real que pode não existir em dev** —
  `Player`/`PlayerCard` não têm seed (fonte de dados real ainda é decisão de produto em aberto,
  risco 1 da auditoria); `Pack` também não tem seed. As telas tratam a lista vazia como estado
  válido (nunca erro), mas exercitar os fluxos completos localmente exige popular esses dados
  primeiro (via fixture do `efootball-data-provider`, Tarefa 4).

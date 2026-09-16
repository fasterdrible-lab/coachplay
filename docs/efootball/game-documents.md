# GameDocument — Registro de Documentos (Tarefa 3)

## Objetivo

Representar o **estado atual** de cada documento (página de suporte, patch note, artigo
comunitário, etc.) capturado a partir de uma `DocumentationSource` (Tarefa 2). Um `GameDocument`
não é "um texto qualquer" — é sempre rastreável até a fonte que o originou, e carrega um hash de
conteúdo que permite ao futuro coletor (Tarefa 4) detectar quando o documento mudou sem precisar
reprocessar tudo com IA.

Este módulo **não guarda histórico de versões** — isso é escopo da Tarefa 5
(`GameDocumentVersion`) e da Tarefa 6 (`DocumentationDiffService`). Aqui existe apenas "o que está
valendo agora" por `(gameId, url)`.

## Modelo de dados

```prisma
enum GameDocumentType {
  PATCH_NOTES
  CONTROLS
  MECHANICS
  PLAYER_STYLES
  TEAM_STYLES
  FORMATIONS
  SKILLS
  CARDS
  FAQ
  OTHER
}

model GameDocument {
  id                 String            @id @default(cuid())
  gameId             String
  sourceId           String
  title              String
  url                String
  documentType       GameDocumentType
  language           String
  gameVersion        String?
  publishedAt        DateTime?
  retrievedAt         DateTime
  contentHash        String
  rawContent         String            @db.Text
  normalizedContent  String            @db.Text
  active             Boolean           @default(true)
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt

  game    Game                 @relation(fields: [gameId], references: [id])
  source  DocumentationSource  @relation(fields: [sourceId], references: [id])

  @@unique([gameId, url])
}
```

`contentHash` é **sempre derivado no servidor** (`sha256(normalizedContent)`), nunca aceito do
cliente — o mesmo princípio de "nunca confiar em input derivado" usado para `domain` na Tarefa 2.

## Regra de upsert por `(gameId, url)`

`registerDocument()` não distingue "criar" de "atualizar" como operações separadas — o consumidor
(hoje: chamada manual/admin; a partir da Tarefa 4: o coletor automático) sempre chama o mesmo
método, e o serviço decide:

| Situação | Efeito | `isNew` | `changed` |
|---|---|---|---|
| URL nova para o jogo | `create` | `true` | `true` |
| URL já existe, mesmo `contentHash` | `update` (só `retrievedAt`) | `false` | `false` |
| URL já existe, `contentHash` diferente | `update` (todos os campos de conteúdo) | `false` | `true` |

O campo `changed` é o sinal que a Tarefa 6 (diff/versionamento) vai usar para decidir se precisa
gerar uma nova versão — só reprocessa quando o conteúdo realmente mudou.

## Validações

- `documentType` é validado tanto por `@IsEnum` no DTO quanto por um guard explícito em runtime no
  serviço (`Object.values(GameDocumentType).includes(...)`) — mesmo padrão de
  `GamesService.resolveProvider()`, porque o Prisma Client não impede um valor inválido de chegar
  em runtime via um DTO malformado.
- `sourceId` precisa existir (reaproveita `DocumentationSourcesService.findOne`, que já lança
  `NotFoundException`) e precisar pertencer ao **mesmo** `gameId` do documento — impede que um
  documento de eFootball seja anexado a uma fonte de outro jogo.
- `url` exige `https://` (`@IsUrl({ protocols: ['https'] })`), consistente com a Tarefa 2.

## Endpoints (`admin`-only)

- `POST /game-documents` — `registerDocument()`.
- `GET /game-documents?gameId=...&documentType=...&includeInactive=...` — lista; por padrão só
  documentos `active`.
- `GET /game-documents/:id`.
- `PATCH /game-documents/:id` — hoje só permite alternar `active` (desativação manual).

## Testes (14 testes, 2 suítes)

- `content-hash.util.spec.ts` — mesmo conteúdo → mesmo hash; conteúdo diferente → hash diferente;
  formato hex de 64 caracteres.
- `game-documents.service.spec.ts`:
  - documento válido (cria, hash derivado corretamente);
  - documento duplicado (mesma URL, mesmo conteúdo → `changed:false`, não reescreve conteúdo);
  - mesma URL com conteúdo alterado (`changed:true`, reescreve campos de conteúdo);
  - documento sem source (`sourceId` inexistente → `NotFoundException` propagada);
  - source de outro jogo (`BadRequestException`);
  - tipo inválido (`BadRequestException`, banco não é tocado);
  - versão nova (`gameVersion` é refletido corretamente);
  - jogo inexistente (`NotFoundException`);
  - `findAll` com filtro de `active` por padrão, `includeInactive`, e filtro por `documentType`.

## Resultado da validação

- `npx tsc --noEmit`: sem erros.
- `npx jest game-documents --silent`: 2 suítes, 14 testes, todos PASS.
- `npx jest --silent` (regressão completa da API): **97 suítes / 738 testes PASS** (antes desta
  tarefa: 95/682).
- `npx nest build`: sem erros.
- `npm run test:e2e`: 1 suíte, 8 testes, todos PASS (módulo eFootball clássico intacto).

## Riscos e decisões em aberto

- Este módulo ainda não tem nenhum consumidor automático — o `POST /game-documents` é chamado
  manualmente (ou por testes) até a Tarefa 4 (coletor) existir.
- `rawContent`/`normalizedContent` não têm limite de tamanho no DTO além de "string não vazia" —
  a Tarefa 4 deverá impor um teto de tamanho antes de aceitar conteúdo de fontes externas, para
  evitar que uma página HTML enorme (ou maliciosa) seja aceita sem controle.

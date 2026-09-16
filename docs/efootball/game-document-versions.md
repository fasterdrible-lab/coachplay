# Versionamento de Documentos — `GameDocumentVersion` (Tarefa 5)

## Objetivo

`GameDocument` (Tarefa 3) guarda só o **estado atual** de um documento — quando o conteúdo muda,
os campos são sobrescritos. `GameDocumentVersion` é o histórico **imutável**: nunca sobrescrever
silenciosamente documentação anterior. Se a Konami altera uma página, a v1 continua existindo,
consultável, ao lado da v2.

## Modelo de dados

```prisma
model GameDocumentVersion {
  id             String   @id @default(cuid())
  documentId     String
  versionNumber  Int
  contentHash    String
  content        String   @db.Text
  changeDetected Boolean
  createdAt      DateTime @default(now())

  document GameDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@unique([documentId, versionNumber])
}
```

- **`content`**: o `normalizedContent` no momento daquela versão (o mesmo texto que gerou
  `contentHash`) — não o HTML bruto. A tarefa pede um único campo `content`; manter alinhado ao
  hash (em vez de duplicar raw+normalized aqui) é o que faz sentido pra um histórico cuja função é
  comparar/diffar (Tarefa 6).
- **`changeDetected`**: `false` **só** na versão 1 — não existe uma versão anterior pra comparar,
  é a linha de base. `true` em toda versão 2+, que por definição representa uma alteração real
  (nunca se cria uma versão pra "nada mudou" — ver abaixo).
- `@@unique([documentId, versionNumber])` — trava a numeração no banco; uma tentativa de gravar
  duas vezes o mesmo número falha alto (nunca corrige silenciosamente), em vez de corromper o
  histórico.

## Quando uma versão é criada

Toda a decisão de "houve mudança real" já é tomada por `GameDocumentsService.registerDocument()`
(Tarefa 3), que compara `contentHash` contra o que já estava salvo. `GameDocumentVersionsService`
não re-deriva essa decisão — só numera e grava o que o chamador manda:

| Situação em `registerDocument()` | Versão criada? | `changeDetected` |
|---|---|---|
| Documento novo (`isNew`) | Sim — v1 | `false` |
| Mesmo `contentHash` (duplicado) | **Não** | — |
| `contentHash` diferente (alterado) | Sim — vN+1 | `true` |

Isso é o que garante o resultado exigido pela tarefa: **documento idêntico não gera versão
desnecessária.**

## `GameDocumentVersionsService`

- `recordVersion(documentId, contentHash, content, changeDetected)` — lê a última `versionNumber`
  pra aquele documento (`findFirst` ordenado desc), grava a próxima. Numeração é isolada por
  documento (`documentId` no `where`).
- `findAllForDocument(documentId)` — histórico completo, ordenado por `versionNumber` asc.
- `findVersion(documentId, versionNumber)` — uma versão específica; `NotFoundException` explícita
  se não existir.

## Endpoints (herdados de `game-documents`, `admin`-only)

- `GET /game-documents/:id/versions` — histórico completo do documento.
- `GET /game-documents/:id/versions/:versionNumber` — uma versão específica.

Ambos primeiro chamam `GameDocumentsService.findOne(id)` pra devolver um 404 claro se o documento
em si não existir, antes de consultar versões.

## Testes (22 testes, 3 suítes — `content-hash.util` + `game-document-versions.service` + `game-documents.service`)

- `game-document-versions.service.spec.ts` (7) — exatamente os cenários pedidos pela tarefa:
  conteúdo A → versão 1, conteúdo B → versão 2 (após 1 existir), conteúdo C → versão 3, histórico
  completo (`findAllForDocument` retorna A/B/C em ordem), numeração isolada por documento,
  `findVersion` recupera uma versão específica, `NotFoundException` para versão inexistente.
- `game-documents.service.spec.ts` (atualizado) — as 3 branches de `registerDocument` (novo/
  duplicado/alterado) agora também verificam a chamada (ou não-chamada) de `recordVersion` com os
  argumentos certos, **mais um teste de cenário completo end-to-end** (Prisma falso com estado
  real, não só mocks de chamada única) reproduzindo literalmente a sequência pedida pela tarefa:
  conteúdo A → A (repetido) → B → C, confirmando 3 versões no histórico final (não 4), na ordem
  certa, com `changeDetected` correto em cada uma.

## Resultado da validação

- `npx tsc --noEmit`: sem erros.
- `npx jest game-document --silent`: 3 suítes, 22 testes, todos PASS.
- `npx jest --silent` (regressão completa da API): **101 suítes / 776 testes PASS** (antes desta
  tarefa: 100/768).
- `npx nest build`: sem erros.
- `npm run test:e2e`: 1 suíte, 8 testes, todos PASS (módulo eFootball clássico intacto).

## Riscos e decisões em aberto

- **Sem transação atômica** entre a escrita em `GameDocument` e a escrita em
  `GameDocumentVersion`, e a atribuição de `versionNumber` é "ler o máximo, gravar +1" sem lock —
  correto pro volume atual (admin/coletor disparado manualmente, baixa concorrência), mas uma
  corrida de duas ingestões simultâneas pro mesmo documento poderia, em teoria, colidir. A
  constraint `@@unique([documentId, versionNumber])` pelo menos garante que uma colisão falha
  alto (erro de constraint) em vez de silenciosamente perder uma versão.
- Diff entre versões (o que mudou, não só que mudou) é a Tarefa 6, fora de escopo aqui — por ora
  o histórico guarda o texto completo de cada versão, não um delta.

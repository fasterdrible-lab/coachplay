# Detector de Alterações — `DocumentationDiffService` (Tarefa 6)

## Objetivo

Comparar duas versões (`GameDocumentVersion`, Tarefa 5) do mesmo documento e detectar, com
precisão, o que mudou: texto adicionado, texto removido, texto alterado, seção nova, seção
removida. Cada mudança encontrada vira uma linha `DocumentChange`, sempre `PENDING` — nada entra
em produção sozinho; a decisão de aprovar/rejeitar é humana (Tarefa 8, fora de escopo aqui).

## Correção retroativa necessária em `html-sanitizer.util.ts` (Tarefa 4)

Antes de construir o diff em si, descobri (via teste manual) que `htmlToPlainText()` da Tarefa 4
tinha um defeito que inviabilizava completamente a detecção de seção: `sanitizeHtml(html, {
allowedTags: [] })` concatena o texto de elementos de bloco adjacentes **sem nenhum separador** —
`<p>A</p><p>B</p>` virava `"AB"`, não `"A\nB"`. Um documento real com vários parágrafos normalizava
pra uma única linha corrida, sem nenhuma fronteira de "seção" pro detector encontrar.

**Corrigido nesta tarefa** (não uma tarefa nova — é um defeito na fundação que a própria Tarefa 6
depende de ter certa): `htmlToPlainText()` agora insere quebra de linha após cada elemento de
bloco (`p`, `div`, `h1`–`h6`, `li`, `tr`, `blockquote`, `section`, `article`) e após `<br>`, antes
de remover as tags. Cada elemento de bloco vira exatamente 1 linha no `normalizedContent` — e cada
linha é a unidade que este detector trata como "seção". 2 testes novos em
`html-sanitizer.util.spec.ts` cobrem isso; os 11 testes já existentes continuam passando sem
alteração de expectativa.

## `content-diff.util.ts` — o algoritmo (puro, sem I/O)

1. **Nível de linha/seção**: `splitIntoLines()` quebra o conteúdo em linhas não-vazias. Um diff
   clássico por LCS (subsequência comum mais longa) — a mesma técnica do `diff`/`git diff` —
   compara as linhas antigas contra as novas, produzindo uma sequência de operações
   `equal`/`remove`/`add` preservando a ordem.
2. **Pareamento remove+add adjacentes**: quando uma linha só existe na versão antiga e outra só na
   nova aparecem na mesma posição do diff, calcula a similaridade de palavras entre elas (Jaccard:
   interseção/união de palavras). Se ≥ 40%, trata como **a mesma seção com texto alterado**; abaixo
   disso, são duas seções sem relação (uma removida, outra nova, sem ligação entre si).
3. **Nível de palavra** (dentro de um par pareado): outro diff LCS, agora em palavras, decide se a
   mudança foi só adição (`TEXT_ADDED`), só remoção (`TEXT_REMOVED`), ou substituição de palavra(s)
   (`TEXT_MODIFIED`) — é assim que "5 habilidades" → "6 habilidades" é detectado como
   `TEXT_MODIFIED`, não como uma seção inteira trocada.
4. Linhas de `remove`/`add` que sobram sem par (sem similaridade suficiente, ou sem contraparte no
   outro lado) viram `SECTION_REMOVED`/`SECTION_ADDED`.

Linhas idênticas nunca geram uma entrada — só o que realmente mudou.

## `DocumentationDiffService.detectChanges()`

```
detectChanges(documentId, oldVersionNumber, newVersionNumber)
  → GameDocumentsService.findOne(documentId)        // 404 se o documento não existe
  → GameDocumentVersionsService.findVersion(...) x2  // 404 se alguma versão não existe
  → diffDocumentContent(oldVersion.content, newVersion.content)
  → 0 mudanças → [] (nenhum DocumentChange criado)
  → N mudanças → N linhas DocumentChange, cada uma reviewStatus: PENDING
```

Uma linha por mudança detectada — não um resumo agregado. `oldVersion`/`newVersion` armazenam o
**número** da versão (não o id), porque o par descreve a comparação, não uma versão isolada.

## Endpoints (`admin`-only)

- `POST /documentation-diff` — `{ documentId, oldVersionNumber, newVersionNumber }`.
- `GET /documentation-diff?documentId=&reviewStatus=` — lista, com filtros opcionais.
- `GET /documentation-diff/:id`.

Disparo é manual — nada aqui chama isso automaticamente após uma ingestão (Tarefa 4). Ligar os
dois pipelines fica marcado como decisão em aberto (ver Riscos).

## Testes (18 testes, 2 suítes)

- `content-diff.util.spec.ts` (11) — exatamente as fixtures pedidas pela tarefa: nenhuma
  alteração, uma frase alterada, uma seção removida, nova regra, **mudança de número ("5
  habilidades" → "6 habilidades" detectada como `TEXT_MODIFIED`)** — mais casos extras de
  cobertura (texto só-adicionado, texto só-removido, duas seções sem relação nenhuma, múltiplas
  mudanças no mesmo documento, documento vazio nos dois lados, documento inteiramente novo).
- `documentation-diff.service.spec.ts` (7) — nenhuma alteração não cria `DocumentChange`, uma
  alteração cria com `PENDING`/`oldVersion`/`newVersion` corretos, documento inexistente e versão
  inexistente propagam `NotFoundException` sem tocar o banco de mudanças, múltiplas mudanças
  criam múltiplas linhas, filtros de `findAll`, `NotFoundException` de `findOne`.

## Resultado da validação

- `npx tsc --noEmit`: sem erros.
- `npx jest documentation-diff --silent`: 2 suítes, 18 testes, todos PASS.
- `npx jest --silent` (regressão completa da API): **103 suítes / 796 testes PASS** (antes desta
  tarefa: 101/776).
- `npx nest build`: sem erros.
- `npm run test:e2e`: 1 suíte, 8 testes, todos PASS (módulo eFootball clássico intacto).

## Riscos e decisões em aberto

- **Detecção de seção depende inteiramente da granularidade de linha do `normalizedContent`** —
  se dois parágrafos inteiros forem reescritos como um só, ou um parágrafo for quebrado em dois,
  o pareamento por similaridade pode classificar errado (ex.: como duas seções sem relação em vez
  de uma reorganização). Um limite fixo (40% de sobreposição de palavras) é uma heurística, não uma
  garantia — casos-limite serão jogados pra revisão humana (Tarefa 8) como `SECTION_ADDED` +
  `SECTION_REMOVED` em vez de `TEXT_MODIFIED`, o que é o lado seguro do erro (mais visibilidade
  pro revisor, não menos).
- **Pipeline não está automaticamente encadeado**: ingestão (Tarefa 4) grava uma versão nova
  (Tarefa 5), mas nada dispara `detectChanges()` sozinho — é uma chamada manual separada. Ligar os
  dois é uma decisão de produto (rodar sempre? só quando `changeDetected: true`?) melhor deixada
  pra quando o pipeline completo até a Tarefa 8 (revisão) existir de ponta a ponta.
- `changeSummary` é texto livre, sem nenhuma estrutura pra diff programático (ex.: um front-end
  não consegue re-renderizar um highlight preciso a partir dele) — suficiente pra leitura humana
  na tela de revisão (Tarefa 8), mas listado aqui como limitação conhecida.

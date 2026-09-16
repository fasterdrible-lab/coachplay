# Coletor de Documentação — `documentation-ingestion` (Tarefa 4)

## Objetivo

Buscar o HTML de uma URL de fonte (`DocumentationSource`, Tarefa 2), sanitizar, normalizar e
entregar o resultado a `GameDocumentsService.registerDocument()` (Tarefa 3), que decide
sozinho — por comparação de `contentHash` — se isso é um documento novo, uma atualização real, ou
"nada mudou" (não cria uma versão desnecessária).

O coletor **nunca altera regras do sistema diretamente** — ele só alimenta `GameDocument`.
Extração de regras a partir do texto (`GameRule`) é a Tarefa 7, fora de escopo aqui.

## Fluxo

```
URL → download (DocumentFetcherService) → sanitização (sanitizeRawHtml)
    → normalização (htmlToPlainText) → hash/comparação/armazenamento (GameDocumentsService, Tarefa 3)
```

**Decisão de reaproveitamento**: "hash", "comparação" e "armazenamento" já existiam inteiros na
Tarefa 3 (`registerDocument()` faz upsert por `(gameId, url)` comparando `contentHash`). Este
módulo não duplica essa lógica — `DocumentationIngestionService.ingest()` só cuida de fetch +
sanitize + normalize, e delega o resto.

## `DocumentFetcherService` — o "fetch"

Responsável por baixar uma URL com proteção completa contra abuso/SSRF:

- **Timeout**: `AbortController` + `setTimeout` (`DOCUMENTATION_FETCH_TIMEOUT_MS`, default 10s).
- **Retry limitado**: até `DOCUMENTATION_FETCH_MAX_RETRIES` tentativas (default 2), só para falhas
  transitórias (erro de rede/timeout, ou HTTP 5xx) — nunca para 404 ou outros 4xx, que são
  permanentes.
- **User-Agent configurável**: `DOCUMENTATION_FETCH_USER_AGENT` (default `CoachPlay-DocBot/1.0`).
- **Limite de tamanho**: `DOCUMENTATION_FETCH_MAX_BYTES` (default 2MB) — checado tanto via header
  `Content-Length` (rejeição antecipada) quanto **durante o download**, lendo o stream do corpo
  manualmente e abortando assim que o total de bytes lidos ultrapassa o limite. Nunca confia só no
  `Content-Length` (o servidor pode não mandar ou mentir).
- **Redirecionamentos**: seguidos manualmente (`redirect: 'manual'`), nunca pelo `fetch` nativo —
  **a segurança (SSRF + allowlist de domínio) é reavaliada em CADA salto**, não só na URL inicial.
  Um redirect pra um IP privado ou domínio fora da allowlist é bloqueado no meio do caminho.
  Limite de `DOCUMENTATION_FETCH_MAX_REDIRECTS` saltos (default 5) — protege contra loop de
  redirecionamento.
- **Proteção contra SSRF**: reaproveita `checkSourceUrlSafety()` e `isDomainAllowed()`/
  `parseAllowedDomains()` da Tarefa 2 — mesmo `DOCUMENTATION_SOURCE_ALLOWED_DOMAINS`, sem allowlist
  paralela. Verificado antes de CADA requisição HTTP (inicial e cada redirect).

## `html-sanitizer.util.ts` — "sanitize" e "normalize"

- `sanitizeRawHtml()` — usa a biblioteca `sanitize-html` (não regex — parser HTML de verdade é
  necessário pra sanitização ser confiável). Remove `<script>`, `<style>`, atributos de evento
  inline (`onerror`, `onclick`...), esquemas perigosos em `href`/`src` (`javascript:`), e qualquer
  tag fora de uma lista permitida pequena. O resultado é o que vira `GameDocument.rawContent`.
- `htmlToPlainText()` — remove toda marcação restante do HTML já sanitizado, colapsa espaços
  redundantes, produz o texto puro que vira `GameDocument.normalizedContent` (usado pro hash e,
  mais adiante, pra extração de regras da Tarefa 7).

**Decisão de dependência**: `sanitize-html@2.12.1` (não a última, `2.17.x`) — a partir da 2.13 a
dependência `htmlparser2` virou ESM-only e quebra o `ts-jest` do projeto (`SyntaxError: Cannot use
import statement outside a module`). `2.12.1` ainda usa `htmlparser2@^8`, CJS, compatível.

## `DocumentationIngestionService.ingest()` — orquestração

1. `DocumentFetcherService.fetchDocument(url)`.
2. `sanitizeRawHtml(html)` → `htmlToPlainText(sanitizedHtml)`.
3. Se o texto normalizado for vazio após `trim()` (HTML vazio, ou só marcação sem conteúdo
   textual) → `BadRequestException` explícita. Nunca chama `registerDocument()` com conteúdo
   vazio — "nunca corrige silenciosamente".
4. `GameDocumentsService.registerDocument({ ...dto, rawContent: sanitizedHtml, normalizedContent })`
   — hash/comparação/armazenamento (Tarefa 3).
5. Retorna o resultado do registro (`document`/`isNew`/`changed`) + metadados do fetch
   (`finalUrl`, `httpStatus`, `redirectCount`, `fetchAttempts`) — útil pra observabilidade
   (Tarefa 27) e pra debugar por que um documento acabou registrado sob uma URL diferente da
   pedida (seguiu redirect).

## Endpoint (`admin`-only)

- `POST /documentation-ingestion` — `IngestDocumentDto` (gameId, sourceId, title, url,
  documentType, language, gameVersion?, publishedAt?) — dispara o pipeline completo pra uma URL.

Disparo é **manual** nesta tarefa. Agendamento automático (cron/fila periódica) é a Tarefa 21
("Monitoramento de Alterações"), deliberadamente fora de escopo aqui.

## Testes (30 testes, 3 suítes)

- `html-sanitizer.util.spec.ts` (11) — remove `<script>`/`<style>`/atributos de evento/esquemas
  perigosos, preserva conteúdo e tags permitidas, HTML vazio/malformado não lança.
- `document-fetcher.service.spec.ts` (13) — cobre exatamente os cenários pedidos pela tarefa: 200
  OK, 404 (sem retry), 500 (retry até esgotar / recupera no retry), timeout, redirect (segue e
  revalida segurança/allowlist no destino), redirect loop (limite excedido), redirect pra domínio
  fora da allowlist / IP privado (bloqueado no salto), HTML vazio (não lança — validação de
  conteúdo é do orquestrador), conteúdo enorme (aborta o download ao ultrapassar o limite de
  bytes), URL insegura/domínio fora da allowlist bloqueados antes de qualquer fetch.
- `documentation-ingestion.service.spec.ts` (6) — HTML alterado (sanitiza/normaliza e repassa),
  **HTML idêntico → `changed:false`, não cria versão desnecessária** (resultado explicitamente
  pedido pela tarefa), HTML vazio/só-marcação → `BadRequestException` sem tocar
  `registerDocument`, erro de fetch propaga, metadados de fetch no resultado.

## Resultado da validação

- `npx tsc --noEmit`: sem erros.
- `npx jest documentation-ingestion --silent`: 3 suítes, 30 testes, todos PASS.
- `npx jest --silent` (regressão completa da API): **100 suítes / 768 testes PASS** (antes desta
  tarefa: 97/738).
- `npx nest build`: sem erros.
- `npm run test:e2e`: 1 suíte, 8 testes, todos PASS (módulo eFootball clássico intacto).

## Riscos e decisões em aberto

- **Sem validação de DNS** ainda — a checagem de SSRF (`checkSourceUrlSafety`) valida só a
  sintaxe da URL (protocolo, host literal), não resolve o hostname pra conferir se o IP resultante
  é privado. Um domínio autorizado que aponte (por DNS rebinding, ou reconfiguração maliciosa
  futura) pra um IP interno passaria por este coletor sem ser pego — a Tarefa 25 ("Segurança do
  Coletor") lista "DNS validation" explicitamente como pendência dela, não desta.
- **MIME validation ainda não existe** — o coletor não confere `Content-Type` da resposta antes de
  tratar o corpo como HTML; também listado na Tarefa 25.
- **`sanitize-html` fixado em 2.12.1** por incompatibilidade de ESM com o `ts-jest` atual — se o
  projeto migrar pra Jest com suporte a ESM no futuro, vale revisitar a versão mais recente.
- Nenhuma automação de disparo (cron/fila) existe ainda — cada ingestão é manual via
  `POST /documentation-ingestion`, até a Tarefa 21.

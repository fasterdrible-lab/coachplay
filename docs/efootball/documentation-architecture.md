# Auditoria — Base Oficial de Documentação do eFootball (Tarefa 1)

> Auditoria pré-implementação de um **novo** subdomínio (32 tarefas, prompt próprio) — feita
> ANTES de qualquer alteração de código, mesmo padrão já usado em
> [`docs/tactical-engine-current-state.md`](../tactical-engine-current-state.md) (Tactical
> Engine) e [`docs/efootball-architecture.md`](../efootball-architecture.md) (módulo eFootball,
> 24 tarefas, concluído em 2026-09-15). **Este é um prompt separado do módulo eFootball de 24
> tarefas já fechado** — objetivo diferente (documentação oficial versionada e auditável, não
> mais telas/engines de gameplay), mas convive no mesmo domínio de jogo (`Game`) e deve reaproveitar
> boa parte do que já existe.

## Baseline (antes de qualquer alteração)

| Comando | Resultado |
|---|---|
| `npm run build:api` | ✅ `prisma generate` + `nest build`, sem erros |
| `npm run build:web` | ✅ Next.js 14, 25 rotas geradas |
| `npm run test:api` | ✅ 91 suites / 682 testes |
| `npm run test:e2e` | ✅ 1 suite / 8 testes |
| `npm run test:desktop` | ✅ 2 suites / 15 testes |
| `npm run test:extension` | ✅ 9 suites / 51 testes |

**756 testes, zero falhas — critério de aceite da Tarefa 1 ("tudo deve estar verde antes de
iniciar a implementação") satisfeito.** Nenhum arquivo de código foi alterado pra chegar a este
resultado.

---

## 1. Arquitetura encontrada

### 1.1 Visão geral

Monolito modular (NestJS + Next.js + Prisma + PostgreSQL + Redis/BullMQ) — mapa completo em
`docs/ARCHITECTURE.md`. O módulo eFootball de 24 tarefas (`docs/efootball-architecture.md`,
concluído) já introduziu o domínio `Game`/`GameProvider` e 15 módulos novos (`games`, `players`,
`efootball-data-provider`, `player-build-engine`, `player-builds`, `player-scanner`,
`user-players`, `squad-builder`, `efootball-coach`, `economy-advisor`, `learning`, `onboarding`,
`ask-coach`, `progress`, `recommendations`) — todos flat (`<module>.module.ts` +
`<module>.service.ts` + `<module>.controller.ts` + `dto/`), nenhum em camadas
domain/application/infrastructure apesar de `docs/ARCHITECTURE.md` documentar esse padrão como
"oficial" (divergência já confirmada com o usuário desde a Fase 1 do Tactical Engine — **este
módulo novo deve seguir o mesmo padrão flat real**, não o documentado).

### 1.2 Achado crítico #1 — `GameVersion` já existe e é literalmente a `GameRelease` pedida

```prisma
model GameVersion {
  id, gameId, label, releasedAt, active, createdAt
}
```

Criado na Tarefa 2 do módulo de 24 tarefas, **nunca consumido por nenhum código até hoje** (só
existe no schema). A Tarefa 13 deste prompt novo pede `GameRelease { id, gameId, version,
releaseDate, notesDocumentId, active, createdAt }` — mesmo conceito, campos quase idênticos
(`label`≈`version`, `releasedAt`≈`releaseDate`). **Recomendação: reaproveitar `GameVersion` em
vez de criar `GameRelease` duplicada** — só adicionar `notesDocumentId?` (nullable, FK pra
`GameDocument` quando essa tabela existir, Tarefa 3 deste prompt) via migration aditiva. Criar
uma segunda tabela pra "versão do jogo" violaria a "Estratégia de gameId" já documentada em
`docs/efootball-architecture.md` seção 4 (nunca duplicar conceito que já tem uma FK pra `Game`).

### 1.3 Achado crítico #2 — `GameDataSource` existe mas não cobre o que este prompt precisa

```prisma
model GameDataSource {
  id, gameId, name, kind (official|community|manual), baseUrl?, active, createdAt, updatedAt
}
```

Também da Tarefa 4 do módulo de 24 tarefas — hoje só usado pelo pipeline de importação de
Player/PlayerCard (`efootball-data-provider`). **Não é diretamente reaproveitável como
`DocumentationSource`** por 3 motivos concretos:

1. `kind` é um enum Prisma **fechado de 3 valores** (`official`/`community`/`manual`) — a Tarefa
   2 deste prompt pede 4 (`OFFICIAL`/`VERIFIED_COMMUNITY`/`COMMUNITY`/`MANUAL`) mais um segundo
   enum de confiança **separado** (`trustLevel`: `AUTHORITATIVE`/`HIGH`/`MEDIUM`/`LOW`) que
   `GameDataSource` não tem — ampliar o enum existente quebraria a suposição implícita de
   `efootball-data-provider` (testado com os 3 valores atuais).
2. `GameDataSource` não tem `url` (só `baseUrl?` opcional), `domain`, `language`,
   `lastCheckedAt`/`lastSuccessAt`/`lastFailureAt`, nem `checksum` — todos exigidos pela Tarefa 2.
3. O relacionamento `importRuns: DataImportRun[]` amarra `GameDataSource` ao pipeline de
   **registros estruturados** (Player/PlayerCard), semanticamente diferente de uma fonte de
   **documento/texto**.

**Recomendação: `DocumentationSource` como tabela nova**, mas ancorada em `Game.id` (nunca
`gameId` solto) e com `kind` espelhando o vocabulário de `GameDataSourceKind` na medida do
possível (evitar dois vocabulários incompatíveis pro mesmo conceito de "fonte" dentro do mesmo
domínio de jogo) — decisão final documentada quando a Tarefa 2 deste prompt for executada.

### 1.4 Achado crítico #3 — `DataImportRun`/`DataImportChange` são o padrão a seguir, não a reusar

`EfootballDataProviderService.importBatch()` (Tarefa 4 do módulo de 24 tarefas) já implementa
**exatamente o princípio pedido** pela Tarefa 4 deste prompt (fetch → normalize → hash → compare
→ store, nunca reimporta lote idêntico via `checksum`) — mas hardcoded pra registros
**estruturados** de Player/PlayerCard: `DataImportChangeType` é um enum Prisma fechado de 4
valores (`player_created`/`card_created`/`card_updated`/`card_removed`), e
`DataImportRun`/`DataImportChange` contam registros em lote (`recordCount`/`createdCount`/
`updatedCount`/`removedCount`/`unchangedCount`), não "1 documento mudou de versão sim/não".

**Recomendação: `GameDocumentVersion`/`DocumentChange` como tabelas novas** (Tarefas 5–6 deste
prompt), mas **reaproveitar o utilitário de checksum** (`efootball-data-provider/checksum.util.ts`,
já testado) em vez de reescrever hashing do zero — generalizar pra aceitar texto de documento
além de lote de registros, se a assinatura permitir sem quebrar o uso existente.

### 1.5 Três sistemas de IA já existem — qual "AI Coach" este prompt quer dizer

| Módulo | Escopo | Cascata de provedores | Observabilidade |
|---|---|---|---|
| `ai-coach` (clássico) | 100% EA FC — narra vídeo de partida | Claude→GPT-4o→DeepSeek→Groq | `AIAnalysis.costEstimate` só |
| `efootball-coach` | Narra resultado do Squad Builder/Player Build Engine (Tarefas 10/14 do módulo de 24) | Mesma cascata, `runCascade()` compartilhado | `AiCallLog` completo (custo + latência, Tarefas 20–21) |
| `ask-coach` | Intent Router — texto livre → 1 dos 5 intents → motor correspondente (Tarefa 14 do módulo de 24) | Delega pra `efootball-coach` nas 2 intents que narram por IA | Herda de `efootball-coach` |

A Tarefa 17 deste prompt novo ("Intent Router → Game Knowledge Service → regra oficial → AI
Coach → explicação simples") descreve **exatamente** a arquitetura de `ask-coach` +
`efootball-coach` já existente — nunca `ai-coach` clássico (EA FC, fora de escopo, risco 2 do
audit original). **Recomendação**: tratar como uma 6ª intent nova em `ask-coach`
(`RULE_EXPLANATION`, ao lado de `PLAYER_SEARCH`/`BUILD_RECOMMENDATION`/`SQUAD_ADVICE`/
`ECONOMY_ADVICE`/`LEARNING_RECOMMENDATION`), com um novo método em `EfootballCoachService` (ex.
`explainRule()`) reaproveitando o `runCascade()` já existente — herda **de graça** custo (Tarefa
20) e log em `AiCallLog` (Tarefa 21), sem reescrever nada disso.

### 1.6 Cache — nada existe hoje além de filas

Nenhum `CacheModule`/`cache-manager`/uso direto de Redis fora do BullMQ (`BullModule.forRootAsync`
em `app.module.ts`, só filas). A Tarefa 24 deste prompt ("cache de regras ativas/documentos
frequentes/versão atual, invalidar ao aprovar") não tem nada pra reaproveitar — é capacidade
nova. Duas opções, nenhuma decidida ainda (mesmo padrão de "decisão em aberto" do risco 1 do
audit original):
- **Cache em memória** (`Map` com TTL) — simples, correto pro modelo de deploy atual (1
  instância, `docs/DEPLOY_SHARED_VPS.md`), mas não sobrevive restart nem escala horizontal.
- **Cache via Redis** (reaproveitando a conexão já configurada por `REDIS_URL`) — mais robusto,
  mais trabalho.

Fica em aberto pra quando a Tarefa 24 deste prompt for executada.

### 1.7 Autenticação e permissões — 100% reaproveitável sem alteração

`JwtAuthGuard`/`RolesGuard` globais (`APP_GUARD` em `app.module.ts`), `@Roles('admin')`,
`@CurrentUser()` — mesmo padrão usado em todo o módulo eFootball de 24 tarefas. Precedente pra
"onde vivem as ações de admin de um domínio": `SettingsController` (`@Roles('admin')`) mora
**dentro do módulo `settings`**, não dentro de `AdminModule` — `AdminModule` é reservado pra
visões agregadas **cross-domínio** (`GET /admin/overview`, `GET /admin/usage`, e o
`GET /admin/efootball-ai-usage` da Tarefa 21 do módulo de 24 tarefas). **Recomendação**: ações de
revisão/aprovação de regra (Tarefa 8 deste prompt) vivem dentro do módulo de regras
(`game-rules`), marcadas `@Roles('admin')`, seguindo o padrão de `SettingsController` — não
dentro de `AdminModule`. Um card agregado de "saúde geral"/"alterações pendentes" no painel
admin (Tarefa 12) pode, opcionalmente, virar mais um método em `AdminService`, do jeito que
`getEfootballAiUsage()` já faz.

### 1.8 Segurança do coletor — superfície inteiramente nova, sem nada pra reaproveitar

Nenhuma dependência de HTTP client (`axios`/`node-fetch`/`got`) além do `fetch` nativo do Node 20
(confirmado disponível: `typeof fetch === 'function'`). **Nenhuma biblioteca de sanitização de
HTML** (`sanitize-html`/`cheerio`/`jsdom`/`dompurify`) instalada — a Tarefa 4 deste prompt exige
sanitização de HTML arbitrário vindo de uma URL configurada por admin, o que **exige uma
dependência nova**, escolhida com cuidado (não hand-rolled com regex — sanitização de HTML via
regex é conhecidamente insegura/incompleta). Nenhum utilitário existente de proteção contra SSRF
(bloqueio de `localhost`/IP interna/`file://`/`ftp://`, validação de DNS, limite de redirect) —
tudo isso é capacidade nova, de alto risco de segurança por natureza (é a única parte do sistema
que faz requisição HTTP pra uma URL não fixa no código, configurável por um admin). **Recomendação
de sequenciamento**: implementar o núcleo de proteção (allowlist de domínio, timeout, limite de
tamanho) já na Tarefa 4 (o "coletor"), não esperar a Tarefa 25 — a Tarefa 25 deste prompt adiciona
proteções mais exaustivas (validação de DNS, limite de redirect, validação de MIME) por cima de
uma base seguros desde o primeiro commit, nunca "fetch primeiro, protege depois".

### 1.9 Player Build Engine / Tactical Engine — nenhum dos dois consulta fonte externa hoje

`PlayerBuildEngineService`/`player-build-engine.config.ts` (Tarefa 5 do módulo de 24) é
**100% determinístico com pesos hardcoded no próprio código** (`STRATEGY_WEIGHTS`,
`POSITION_STAT_PROFILES`) — nunca consulta nenhuma fonte de regra em tempo de execução.
`tactical-engine` (39 tarefas próprias, concluído antes do módulo eFootball) é geometria/scoring
puro, também sem nenhuma consulta externa. A Tarefa 16 deste prompt ("antes de calcular build,
consultar regras verificadas... se STALE/UNKNOWN, retornar `DATA_UNAVAILABLE`") é uma mudança de
arquitetura real nesses dois motores — não um acréscimo aditivo isolado. **Risco**: `tactical-engine`
tem 200+ testes determinísticos que assumem "config fixa, sem I/O"; introduzir uma consulta a
`GameRule` no meio do cálculo muda essa garantia. O objetivo geral do prompt menciona "alimentar
o Tactical Engine", mas **nenhuma das 32 tarefas concretas cobre essa integração** (só Player
Build Engine, Tarefa 16, e Ask Coach, Tarefa 17) — mesma inconsistência entre objetivo/tarefas já
observada no prompt original de 24 tarefas (lá, "alimentar o Tactical Engine" também aparecia na
lista de objetivos sem nenhuma tarefa dedicada). Tratar como está: só Player Build Engine e Ask
Coach ganham integração concreta; Tactical Engine fica de fora até (se) uma tarefa nova pedir
explicitamente.

---

## 2. Onde o módulo vai morar

Estrutura flat, mesmo padrão dos 15 módulos existentes — nomes já sugeridos pelo próprio prompt
onde ele sugere, preenchidos onde não:

```
apps/api/src/modules/
  documentation-sources/     DocumentationSource (Tarefa 2)
  game-documents/            GameDocument + GameDocumentVersion + DocumentChange (Tarefas 3, 5, 6)
  documentation-ingestion/   coletor — fetch/sanitize/normalize/hash/compare/store (Tarefa 4)
  game-rules/                GameRule + RuleConflict + matriz de confiança + revisão admin (Tarefas 7–10)
  data-health/               cálculo de saúde por categoria (Tarefa 11)
  game-knowledge/            API pública de leitura (Tarefa 15)
```

`GameRelease` (Tarefa 13) **não vira módulo novo** — é um campo aditivo em `GameVersion`,
já dentro do módulo `games` existente. Admin (Tarefas 8, 12) e frontend (telas) entram dentro dos
módulos acima (`@Roles('admin')`) + `apps/web/src/app/(admin)/admin/...`, sem módulo dedicado.

## 3. Fluxo de dados (mapeado pra classes concretas, quando existirem)

```
DocumentationSource (admin cadastra)
  ↓ DocumentationIngestionService.collect()  [Tarefa 4]
GameDocument + GameDocumentVersion (checksum decide se é v.next ou reimportação idêntica)
  ↓ DocumentationDiffService.compare()  [Tarefa 6]
DocumentChange (status PENDING)
  ↓ admin revisa e aprova  [Tarefa 8, @Roles('admin')]
GameRule (status VERIFIED, sourceDocumentId/sourceVersionId preenchidos)  [Tarefa 7]
  ↓ consumido por
  ├─ GameKnowledgeService (GET /game-knowledge/rules)  [Tarefa 15]
  ├─ PlayerBuildEngineService (consulta antes de calcular)  [Tarefa 16]
  └─ AskCoachService (nova intent RULE_EXPLANATION) → EfootballCoachService.explainRule()
       → cascata de IA já existente (custo + latência em AiCallLog, de graça)  [Tarefa 17]
```

## 4. Riscos identificados

1. **Fonte real de documentação (mesmo risco 1 do audit original, agora pra texto em vez de
   carta).** O prompt pede "documentação oficial da Konami" como fonte prioritária — este
   documento **não afirma nem assume nenhuma URL real**, por 2 motivos: (a) checar se existe uma
   base de documentação pública, estável e cujos Termos de Uso permitam coleta automatizada é
   decisão de produto/legal que bloqueia a Tarefa 4, igual bloqueava a Tarefa 4 do módulo de 24
   tarefas pra dados de carta; (b) instrução do operador deste agente proíbe inventar/adivinhar
   URLs. **A Tarefa 2 (cadastro de fonte) pode avançar com fixture/URL de teste — a Tarefa 4
   (coleta de verdade) fica bloqueada até uma URL real e aprovada existir**, mesmo padrão adotado
   pelo módulo de 24 tarefas (fixture primeiro, fonte real como decisão separada).
2. **`GameVersion` vs `GameRelease`, `GameDataSource` vs `DocumentationSource` — risco de
   duplicação de conceito dentro do mesmo domínio de jogo.** Já endereçado nas seções 1.2–1.3 —
   decisão final tomada quando as Tarefas 2 e 13 forem executadas, não antes.
3. **Superfície de SSRF é o ponto de maior risco de segurança de todo este prompt.** Nenhuma
   proteção existe hoje porque nenhum outro módulo do sistema faz fetch de URL configurável por
   usuário/admin. Tratar com o mesmo rigor que a Tarefa 19 (segurança) do módulo de 24 tarefas já
   tratou upload de arquivo — só que aqui o vetor é pior (requisição de saída, não entrada).
4. **Modificar `PlayerBuildEngineService`/`tactical-engine` pra consultar `GameRule` é mudança de
   arquitetura em código maduro e 100% testado, não acréscimo isolado.** Ver seção 1.9. Fazer
   isso com um teste de regressão explícito garantindo que os testes determinísticos existentes
   continuam passando sem `GameRule` (fallback gracioso).
5. **32 tarefas é maior que o módulo eFootball inteiro (24 tarefas).** Mesmo cuidado de ritmo já
   combinado com o usuário na Tarefa 18 do módulo anterior (frontend) — seguir "uma tarefa por
   vez", sem acumular escopo, e sinalizar se o tamanho começar a exigir uma pausa de alinhamento.
6. **Dependência nova pra sanitização de HTML precisa ser escolhida com critério** (manutenção
   ativa, sem CVE conhecida, tamanho razoável) — decisão fica pra quando a Tarefa 4 for
   implementada, não adiantada aqui.

## 5. Dependências entre tarefas (ordem real)

```
Tarefa 2 (DocumentationSource)     bloqueia 3, 4
Tarefa 3 (GameDocument)            bloqueia 5, 6, 7
Tarefa 4 (coletor)                 bloqueado por decisão de fonte real (risco 1) — schema/DTO
                                     podem avançar com fixture, coleta de verdade não
Tarefa 5 (GameDocumentVersion)     bloqueia 6
Tarefa 6 (diff)                    bloqueia 7 (regra referencia sourceVersionId)
Tarefa 7 (GameRule)                bloqueia 8, 9, 10, 15, 16, 17, 19
Tarefa 9 (matriz de confiança)     depende de 2 (trustLevel já cadastrado na fonte)
Tarefa 11 (data health)            depende de 2–7 (precisa ter o que medir)
Tarefa 13 (GameVersion.notes...)   independente — pode entrar a qualquer momento após a Tarefa 3
Tarefa 15 (game-knowledge)         depende de 7
Tarefa 16 (Player Build Engine)    depende de 15, risco arquitetural próprio (seção 1.9)
Tarefa 17 (Ask Coach)              depende de 15, reaproveita EfootballCoachService.runCascade()
Tarefa 19 (Academia)               depende de 7
Tarefa 24 (cache)                  depende de 7, decisão em aberto (seção 1.6)
Tarefa 25 (segurança do coletor)   deveria estar parcialmente DENTRO da Tarefa 4, não só depois
```

---

## Checkpoint

```
TAREFA 1 — CONCLUÍDA

Objetivo:
- Auditar a arquitetura existente antes de implementar a Base Oficial de Documentação do eFootball

Arquivos criados:
- docs/efootball/documentation-architecture.md

Arquivos modificados:
- (nenhum)

Migration:
- (nenhuma)

Testes criados:
- (nenhum — tarefa é só auditoria)

Testes executados:
- npm run build:api, build:web, test:api, test:e2e, test:desktop, test:extension

PASS:
- 756/756 (91 suites API + 1 e2e + 2 desktop + 9 extension)

FAIL:
- 0

Cobertura:
- Não alterada (nenhum código novo)

Riscos encontrados:
- 6 (seção 4) — destaque pra fonte real de documentação (risco 1) e SSRF (risco 3),
  ambos exigem decisão/cuidado antes da Tarefa 4

Correções:
- N/A

Documentação atualizada:
SIM

Pode avançar:
SIM
```

# Revisão de segurança — módulo eFootball (Tarefa 19)

> Transversal, como já documentado em `docs/efootball-architecture.md` ("Tarefa 19 (Segurança)
> transversal — aplicar em cada tarefa, não só ao final"). Como a Tarefa 19 só chegou depois de
> todo o resto (Tarefas 2–18) estar pronto, essa aplicação virou uma auditoria dedicada dos 15
> módulos existentes — controllers, DTOs, ownership, upload — em vez de checagens espalhadas
> tarefa a tarefa.

## Método

Leitura direta de todos os `*.controller.ts` do módulo eFootball (15 módulos) buscando:
ownership/IDOR em recursos endereçados por id, mass-assignment, query params sem validação, rate
limiting em endpoints caros/de IA, validação de upload, exposição de dado sensível, SQL cru.

## Achados corrigidos

### 1. Sem rate limit dedicado em 3 endpoints caros

`POST /matches/:id/video` já tinha `@Throttle` desde a Task 7.3 ("endpoint caro (I/O de disco +
fila)") — o padrão nunca foi replicado pro módulo eFootball, que ganhou 2 endpoints que sempre ou
às vezes chamam IA generativa (custo real por chamada) e 1 que é pesado em CPU:

| Endpoint | Motivo | Limite |
|---|---|---|
| `POST /ask-coach` | 2 das 5 intents chamam IA (Tarefa 14) | 15/min |
| `GET /squad-builder/squads/:id/explain` | Sempre chama IA (Tarefa 10) | 10/min |
| `POST /player-scanner/scan` | sharp + OCR/matching por chamada (Tarefa 7) | 10/min |

Todos abaixo do default global (`ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }])`).

### 2. `AskCoachDto.question` sem limite de tamanho

Texto livre do usuário vai direto pro prompt de IA em `BUILD_RECOMMENDATION`/`SQUAD_ADVICE` (via
`buildBuildCoachPrompt`/`buildSquadCoachPrompt`) sem nenhum cap antes disso — um texto muito longo
vira custo de tokens de entrada sem limite. Adicionado `@MaxLength(500)`.

### 3. `gameId` como query param solto, sem validação, em 2 lugares

`GET /squad-builder/formations`, `GET /squad-builder/squads` e `GET /economy-advisor/packs` (esse
último criado na própria Tarefa 18) usavam `@Query('gameId') gameId: string` sem nenhum decorator
de validação. Omitir o parâmetro faz o Prisma tratar `gameId: undefined` como "sem filtro" —
devolvendo dados de TODOS os jogos em vez de rejeitar a requisição. **Sem impacto real hoje** (só
existe 1 `Game`, `GameProvider.EFOOTBALL`), mas é um vazamento de dados entre jogos latente, pronto
pra virar real assim que um segundo jogo existir — contradiz a "Estratégia de gameId" da seção 4
deste documento ("toda tabela de domínio de jogo referencia `Game.id` via FK... evita repetir
`game = "efootball"` como string solta").

Corrigido com DTOs dedicados (`GameIdQueryDto` em `squad-builder/dto/`, `ListPacksQueryDto` em
`economy-advisor/dto/`, ambos só `@IsString() @IsNotEmpty() gameId!`) — omitir `gameId` agora
retorna HTTP 400 via `ValidationPipe` global, em vez de silenciosamente misturar dados de jogos
diferentes. `GET /learning/paths` já fazia isso certo desde a Tarefa 12 (`FindPathsQueryDto`) — os
outros dois não seguiram o mesmo padrão quando foram escritos.

### 4. Player Scanner sem teste dedicado pro filtro de upload

Já era o risco 5 documentado na auditoria original (seção 6 deste arquivo). `videoFileFilter` tem
`video.config.spec.ts` desde a Task 7.2 (formatos aceitos/rejeitados); `imageFileFilter`
(`player-scanner/image.config.ts`) não tinha equivalente — só cobertura indireta via
`player-scanner.service.spec.ts`/`preprocess-image.spec.ts`, que testam o CONTEÚDO da imagem
(bytes corrompidos), não o filtro de MIME type do multer em si.

Novo `image.config.spec.ts`: aceita `image/png`/`image/jpeg`/`image/webp`; rejeita `video/mp4`,
`application/pdf`, `text/html`, `image/svg+xml` (SVG pode carregar `<script>` embutido —
caso deliberado de "formato perigoso", não só "formato errado") e `application/octet-stream`.

## Confirmado sem necessidade de mudança

- **Ownership (IDOR)** — os 3 únicos recursos do módulo endereçados por id E pertencentes a um
  usuário específico (`UserPlayer`/Tarefa 8, `UserSquad`/Tarefa 9, `LearningRecommendation`/
  Tarefa 17) já verificam `assertOwner`/`recommendation.userId !== currentUser.id` →
  `ForbiddenException`, todos com teste "usuário diferente" explícito. Os demais módulos operam só
  sobre `currentUser.id` (nunca aceitam um id de recurso alheio) ou sobre dado de catálogo
  compartilhado (`Player`/`PlayerCard`/`LearningPath`/`Pack`/`Formation` — não pertencem a nenhum
  usuário, leitura é intencionalmente aberta pra qualquer usuário autenticado).
- **Mass assignment** — `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform:
  true })` é global desde a Fase 1 (`main.ts`) e cobre todos os DTOs novos das Tarefas 2–18: um
  campo extra no corpo (ex.: um `userId` forjado) é REJEITADO com HTTP 400, não silenciosamente
  ignorado.
- **SQL cru** — nenhum `$queryRaw`/`$executeRaw` em módulo nenhum do eFootball; todo acesso a
  banco é via Prisma parametrizado.
- **Path traversal no upload** — `imageStorage = memoryStorage()` (Tarefa 7): o buffer nunca toca
  o disco com um nome vindo do cliente, estruturalmente imune à classe de risco que o upload de
  vídeo mitiga via `diskStorage` + nome de arquivo derivado só da extensão
  (`matchId-timestamp.ext`, nunca o `originalname` bruto).
- **Exposição de dado sensível** — nenhuma resposta de nenhum endpoint do módulo inclui
  `passwordHash` ou equivalente; `include`s de `user`/relações sempre trazem só os campos
  necessários (ex.: `player: { select: { name: true } }` no Ask Coach, nunca `include: { user:
  true }` completo).

## Fora de escopo desta tarefa (decisão deliberada)

- **Controle de custo de IA por usuário/plano** — rate limit aqui é abuso/DoS (segurança), não
  contabilização de custo por usuário nem integração com `PlansService`/`AnalysisLimitGuard`. Isso
  é o escopo específico da Tarefa 20 ("controle de custo de IA"), próxima no roadmap.
- **Observabilidade por chamada de IA** (`llm_cost`/`llm_latency`) — já identificado como gap
  pré-existente na auditoria original (risco 7, seção 6) e reservado pra Tarefa 21.

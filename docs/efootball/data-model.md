# eFootball — Modelo de dados (Tarefas 2–4)

> Cobre o schema Prisma introduzido pelas Tarefas 2 (domínio Game), 3 (Players/PlayerCards) e 4
> (pipeline de importação). Ver [`docs/efootball-architecture.md`](../efootball-architecture.md)
> para a auditoria original e o racional de design completo.

## Domínio Game (Tarefa 2)

```
Game            — 1 linha por jogo suportado (provider único, ex. EFOOTBALL)
GameVersion     — versões do jogo (patches/temporadas)
GameDataSource  — fontes de dados registradas para um jogo (kind: official/community/manual)
```

Toda tabela de domínio de jogo referencia `Game.id` via FK — nunca uma string solta tipo
`game = "efootball"`. `GamesService.findByProvider()` só retorna jogos `active: true`; provider
desconhecido lança `BadRequestException` antes de qualquer query.

`GET /games` (autenticado, sem role específica) lista os jogos ativos.

## Players / PlayerCards (Tarefa 3)

```
Player       — o atleta (id, gameId, externalId, name, normalizedName, nationality,
                preferredFoot, height)
PlayerCard   — uma versão específica do atleta (playerId, externalId, cardType, version,
                overallBase, maxLevel, position, dataVersion, source/sourceVersion/validFrom/
                validUntil/lastVerifiedAt)
PlayerPosition, PlayerStat, PlayerSkill, PlayerPlayStyle — atributos por carta (1:N)
CardVersion  — snapshot do estado de uma carta em cada importação (histórico, usado pela Tarefa 4)
```

**Regra dura:** duas cartas do mesmo atleta nunca são fundidas — `@@unique([playerId,
externalId])`. `Player` também é único por `(gameId, externalId)`.

Busca (`PlayersService.search`) usa `normalizedName` (sem acento, minúsculo) com
`contains`+`mode: 'insensitive'` — encontra "Kvara" dentro de "Khvicha Kvaratskhelia" por
substring, sem IA. Filtros de `PlayerCard` (`findCards`) aceitam `position`/`cardType`/`playerId`.

Endpoints (autenticado): `GET /players?query=&gameId=`, `GET /players/:id`, `GET
/player-cards?playerId=&position=&cardType=`, `GET /player-cards/:id`.

## Pipeline de importação — `efootball-data-provider` (Tarefa 4)

```
fetch (EfootballDataSource.fetch())
  ↓
normalize (normalizeRecord — normaliza nome)
  ↓
validate (validateRecord — schema Zod: overallBase 1-99, maxLevel>=1, cartas obrigatórias)
  ↓
version (computeBatchChecksum — sha256 estável, independente de ordem)
  ↓
import (EfootballDataProviderService.importBatch)
```

`importBatch` assume que o lote recebido representa o **catálogo completo atual** da fonte para
aquele jogo — cartas ativas não presentes no lote são marcadas `active: false` (`card_removed`).
Cada execução gera 1 `DataImportRun` (source/sourceVersion/checksum/recordCount/status/contadores)
e N `DataImportChange` (`player_created`/`card_created`/`card_updated`/`card_removed`) — trilha de
auditoria completa de "o que mudou nesta importação".

**Nenhuma fonte real de dados está integrada ainda** (risco 1 de
`docs/efootball-architecture.md`) — só existe `FixtureEfootballDataSource`, usada em teste. Uma
implementação real de `EfootballDataSource` (scraping aprovado, dataset comunitário ou entrada
manual curada) é decisão de produto/legal pendente.

## Diagrama de relações

```
Game 1───N Player 1───N PlayerCard 1───N { PlayerPosition, PlayerStat, PlayerSkill,
                                            PlayerPlayStyle, CardVersion, CardScan }
Game 1───N GameDataSource 1───N DataImportRun 1───N DataImportChange
```

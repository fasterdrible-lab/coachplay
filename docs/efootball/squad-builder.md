# Squad Builder (Tarefa 9)

> Monta a escalação titular a partir do elenco do usuário (`UserPlayer`) e de uma formação —
> 100% determinístico, sem IA. Reaproveita `resolvePositionGroup` do `player-build-engine`
> (Tarefa 5) para decidir compatibilidade de posição.

## Catálogo de formações

6 formações (`formations.catalog.ts`, versionado — `FORMATIONS_CATALOG_VERSION`): `4-3-3`,
`4-2-3-1`, `4-2-1-3`, `4-4-2`, `3-4-3`, `3-5-2`. Cada uma tem **exatamente 11 slots e exatamente 1
slot GK** — é essa invariante do catálogo (não uma checagem em tempo de execução) que garante que
o motor nunca escala mais de 11 jogadores nem 2 goleiros ao mesmo tempo. Layout padrão de
futebol (conhecimento genérico do esporte) — não um dump de dados proprietários do eFootball.
Seed idempotente em `prisma/seed.ts` (upsert por `(gameId, code)` / `(formationId, slot)`).

## Motor (`squad-builder.engine.ts`)

```
buildSquad(formation, roster) → { startingXI, bench, weakPositions, alternatives }
```

Slot a slot, na ordem do catálogo: filtra candidatos ainda não escalados, calcula
`positionCompatibility × (0.5 + 0.5 × overallBase/99)`, escolhe o maior score (empate por
`userPlayerId` — determinístico). Candidato com compatibilidade 0 (grupo posicional diferente)
nunca é elegível — um zagueiro nunca preenche a vaga de goleiro, um centroavante nunca preenche a
vaga de ponta. Slot sem nenhum candidato compatível fica em `weakPositions` (`reason: EMPTY`);
slot preenchido por compatibilidade parcial (mesmo grupo, posição diferente — ex.: LWF numa vaga
RWF) também entra em `weakPositions` (`reason: OUT_OF_POSITION`), sinalizando a "necessidade do
elenco". `alternatives` traz até 3 próximos candidatos por slot preenchido.

`positionCompatibility` (`position-compatibility.ts`): 1 = posição exata, 0.7 = mesmo grupo
posicional, 0 = grupos diferentes (nunca escala).

## Endpoints (`JwtAuthGuard`, ownership via `assertOwner()` nos que tocam `UserSquad`)

```
GET  /squad-builder/formations?gameId=       catálogo de formações ativas
POST /squad-builder/generate                  gera startingXI/bench/weakPositions (preview, não salva)
POST /squad-builder/squads                    gera e persiste como UserSquad + SquadPlayer
GET  /squad-builder/squads?gameId=            lista os elencos salvos do usuário
GET  /squad-builder/squads/:id
DELETE /squad-builder/squads/:id
```

## Persistência

`UserSquad` (nome, formação, jogo) 1:N `SquadPlayer` (`isStarting` + `slot` quando titular,
`slot: null` quando banco). `saveSquad()` roda o mesmo `generate()` e grava o resultado — nunca
recalcula a escalação de outra forma.

# Meus Jogadores — `user-players` (Tarefa 8)

> "Meu Elenco": jogadores que o usuário adicionou ao próprio time. Módulo puramente de
> persistência/ownership — nenhum cálculo novo (builds são geradas pelo `player-build-engine`,
> Tarefa 5, e só salvas aqui como snapshot).

## Modelos

```
UserPlayer      — 1 linha por (userId, playerCardId), nunca duplicado
  currentLevel, favoritePosition?, userNotes?, isFavorite, currentBuildId?
UserPlayerBuild  — snapshot de uma build salva (resultado do Player Build Engine ou alocação manual)
  strategy, position, level, allocation (Json), computedAttributes (Json), roleScore,
  totalPointsUsed, totalPointsAvailable
```

`currentBuildId` é um campo escalar simples (sem relação formal Prisma) apontando para uma das
`UserPlayerBuild` do mesmo `UserPlayer` — validado em `activateBuild()`, não por FK do banco.

## Endpoints (todos atrás de `JwtAuthGuard`, ownership via `assertOwner()`)

```
POST   /user-players                          adicionar carta ao elenco (pesquisa/scanner/manual
                                                 convergem para playerCardId — origem não é persistida)
GET    /user-players?position=&cardType=&minOverall=&maxOverall=&level=&favorite=
GET    /user-players/:id
PATCH  /user-players/:id                       editar nível/posição favorita/notas/favorito
DELETE /user-players/:id
POST   /user-players/:id/builds                salvar uma build
PATCH  /user-players/:id/builds/:buildId/activate   trocar qual build está ativa
```

`cardType` cobre tanto "tipo" quanto "raridade" dos filtros pedidos — não existe um campo de
raridade separado em `PlayerCard` (Tarefa 3).

## Segurança

Mesmo padrão de `MatchesService.assertOwner()`: busca só `{ userId }`, `NotFoundException` se não
existe, `ForbiddenException` se pertence a outro usuário — aplicado em `findOne`/`update`/
`remove`/`addBuild`/`activateBuild`. `findAll` sempre filtra por `currentUser.id`, nunca aceita um
`userId` vindo do cliente. Testado explicitamente (usuário A nunca acessa elenco do usuário B).

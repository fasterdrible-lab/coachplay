# Recomendação adaptativa — `recommendations` (Tarefa 17)

> `GET /recommendations/next-best-action` — a UMA próxima ação mais valiosa pro usuário fazer,
> decidida por uma cadeia de prioridade 100% determinística sobre sinais já calculados por todos
> os engines anteriores. Sem IA generativa — "adaptativa" no sentido de reagir ao estado real do
> usuário, não de gerar texto livre.

## Cadeia de prioridade

```
1. Onboarding pendente (Tarefa 13)         → COMPLETE_ONBOARDING
2. Elenco vazio (Tarefa 8)                 → ADD_PLAYERS
3. Nenhum squad salvo (Tarefa 9)           → BUILD_SQUAD
4. Aula informada pelo Match Analysis (15) → DO_LESSON (lessonId preenchido)
5. Próxima aula sequencial da Academia (12)→ DO_LESSON (lessonId preenchido)
6. Nada pendente                           → ALL_CAUGHT_UP
```

Implementada em `computeNextBestAction()` (`next-best-action.util.ts`), função pura — a mesma
regra de todo avaliador puro do projeto (Tactical Engine, Player Build Engine): recebe sinais já
resolvidos, nunca consulta banco nem IA.

## Por que reaproveita o Progresso em vez de recontar

`RecommendationsService.getNextBestAction()` chama `ProgressService.getMyProgress()` (Tarefa 16)
pra obter `onboardingCompletedAt`/`playersOwned`/`squadsSaved`/`worstCategory` — os mesmos 3
primeiros sinais da cadeia de prioridade. Evita duplicar toda contagem que o Progresso já faz, ao
custo de sempre atualizar o `UserProgressSnapshot` (efeito colateral do próprio `getMyProgress`,
já esperado) a cada chamada de `next-best-action`.

**Otimização deliberada:** só consulta a Academia (`getMatchInformedRecommendation`/`listPaths`/
`getPath`) quando as 3 condições de maior prioridade (onboarding/elenco/squad) já estão
satisfeitas — uma consulta cujo resultado a cadeia descartaria de qualquer forma nunca é feita.

## Persistência e dismiss

`LearningRecommendation` — 1 linha por usuário (`@unique(userId)`), sempre sobrescrita quando a
ação computada muda; ganhou um campo `type` além do esboço original de
`docs/efootball-architecture.md` (que só previa `reason`/`lessonId`) pra tornar a linha
auto-descritiva, mesmo motivo da Tarefa 13 ter adicionado `onboardingCompletedAt` ao
`UserLearningProfile`.

```
POST /recommendations/:id/dismiss
```

Marca `dismissedAt`. Na próxima `GET /recommendations/next-best-action`, se a ação recalculada for
EXATAMENTE a mesma (`type`+`reason`+`lessonId` idênticos) de antes, `dismissedAt` é preservado —
a resposta continua vindo com `dismissed: true`, sem re-notificar o usuário sobre algo que ele já
disse "não agora". Assim que o estado muda de verdade (ex.: usuário finalmente adiciona um
jogador, ou uma nova partida analisada muda o `worstCategory`), a cadeia de prioridade calcula uma
ação diferente e a linha é sobrescrita com `dismissedAt: null`.

## Segurança

`dismiss()` verifica ownership (`recommendation.userId !== currentUser.id` → `ForbiddenException`),
mesmo padrão `assertOwner` usado em `MatchesService`/`SquadBuilderService` desde o MVP original.

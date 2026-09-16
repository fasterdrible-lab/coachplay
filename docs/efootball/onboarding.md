# Onboarding — `onboarding` (Tarefa 13)

> Primeiro contato do usuário com o módulo eFootball. Sem IA — reaproveita o `UserLearningProfile`
> da Academia (Tarefa 12) e resolve a trilha inicial correspondente numa única chamada.

## Por que um módulo próprio em vez de só `PATCH /learning/profile`

`PATCH /learning/profile` (Tarefa 12) já permite ao usuário declarar nível/objetivos, e
`GET /learning/paths?gameId=&level=` já permite buscar a trilha correspondente — o onboarding não
duplica essa lógica, só combina as duas chamadas numa (evitando o cliente ter que encadeá-las) e
resolve o `Game` do eFootball internamente (o endpoint é `/onboarding/efootball`, não recebe
`gameId` do corpo).

## Endpoint

```
POST /onboarding/efootball
  { level: LearningLevel, goals?: string[] }
  → { profile: UserLearningProfile, recommendedPath: LearningPath | null }
```

`recommendedPath` vem `null` (não lança erro) quando não existe `LearningPath` cadastrada para o
`(gameId, level)` informado — o perfil ainda é salvo normalmente.

## `onboardingCompletedAt`

Novo campo em `UserLearningProfile` (migration `20260915120000_add_onboarding_completed_at`).
Preenchido só na primeira conclusão; chamar o endpoint de novo (usuário reavalia o próprio nível)
atualiza `level`/`goals` sem sobrescrever a data original — mesmo padrão de "primeira vez" já
usado em `TacticalPattern.firstDetectedAt` (Tactical Engine, Fase 4).

`GET /learning/profile` (Tarefa 12) passa a incluir `onboardingCompletedAt` também no valor
padrão devolvido quando o perfil ainda não existe (`null`) — o frontend decide se mostra a tela
de onboarding sem precisar de um endpoint de status dedicado.

## Segurança

Mesmo padrão do resto do módulo: filtra sempre por `currentUser.id` (via `@CurrentUser()`), nunca
aceita `userId` do cliente — testado explicitamente (onboarding de um usuário nunca afeta outro).

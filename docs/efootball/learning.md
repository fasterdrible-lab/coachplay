# Academia CoachPlay — `learning` (Tarefa 12)

> Trilhas de aprendizado por nível, com desbloqueio sequencial de aulas. Sem IA — conteúdo
> curado (texto didático próprio do CoachPlay, conceitual, nunca uma alegação específica sobre
> mecânica exata do eFootball que exigiria fonte validada).

## Modelos

```
LearningPath   — 1 por (gameId, level); level = BEGINNER/CASUAL/INTERMEDIATE/ADVANCED/COMPETITIVE
LearningModule — dentro de uma trilha, ordenado
Lesson         — dentro de um módulo, ordenado
Exercise       — dentro de uma aula (schema pronto; seed inicial não popula ainda)
UserLessonProgress  — 1 por (userId, lessonId), nunca duplicada
UserLearningProfile — 1 por usuário (nível atual + objetivos)
```

## Conteúdo inicial (`learning-content.catalog.ts`, versionado)

Os 12 tópicos exigidos, distribuídos por complexidade crescente entre as 5 trilhas:

| Trilha | Módulos |
|---|---|
| BEGINNER — Primeiros Passos no eFootball | Fundamentos, Passe, Finalização, Defesa |
| CASUAL — Evoluindo no Jogo | Drible, Movimentação |
| INTERMEDIATE — Táticas e Estilo de Jogo | Formações, Estilos de jogo |
| ADVANCED — Evoluindo Jogadores | Progressão de jogadores, Skills |
| COMPETITIVE — Montagem de Elenco e Economia | Montagem de elenco, Economia |

Seed idempotente (upsert por `(gameId, level)` / `(learningPathId, order)` /
`(learningModuleId, order)`), rodado a partir de `prisma/seed.ts`.

## Desbloqueio sequencial (`learning-progress.util.ts`, puro)

```
flattenLessons(modules) → ordem canônica: LearningModule.order, depois Lesson.order
isLessonUnlocked(flat, lessonId, completedIds) → 1ª aula sempre desbloqueada;
                                                   as demais exigem a aula anterior concluída
computePathProgress(flat, completedIds) → { completed, total, percent }
```

`LearningService.completeLesson()` é idempotente: concluir uma aula já concluída ("repetir
aula") nunca cria uma segunda `UserLessonProgress` — só atualiza `completedAt`/`attempts` via
upsert em `(userId, lessonId)`. Tentar concluir uma aula bloqueada lança `BadRequestException`.

## Segurança

Todo método de `LearningService` recebe `AuthUser` e filtra por `currentUser.id` — nunca aceita
um `userId` vindo do cliente. Progresso e nível de um usuário nunca são visíveis/afetáveis por
outro (testado explicitamente).

## Endpoints

```
GET   /learning/paths?gameId=&level=
GET   /learning/paths/:id                 (com unlocked/completed por aula, pro usuário atual)
GET   /learning/paths/:id/progress
POST  /learning/lessons/:id/complete
GET   /learning/profile
PATCH /learning/profile                    { level, goals? }
```

# Testes E2E (Tarefa 22)

> `apps/api/test/` nunca existiu no repositório — `npm run test:e2e` sempre falhava por ausência
> de configuração, não por regressão (risco 4 da auditoria original, `docs/efootball-architecture.md`).
> Fechado nesta tarefa: nada a regredir, criado do zero.

## O que existe agora

```
apps/api/test/
  jest-e2e.json                              — config padrão do template oficial do Nest CLI
  efootball-recommendation-flow.e2e-spec.ts  — 8 passos, módulos reais encadeados
```

`npm run test:e2e` (dentro de `apps/api`) roda essa suíte isoladamente da suíte unitária
(`npm test`, `rootDir: "src"`, `*.spec.ts`) — configs e diretórios separados, sem sobreposição.

## Por que "e2e" aqui não é o mesmo que os `*.controller.integration.spec.ts` já existentes

Os testes de integração já existentes no projeto (`games.controller.integration.spec.ts`,
Tarefa 2; `player-builds.controller.integration.spec.ts`, Tarefa 18;
`throttler-wiring.integration.spec.ts`, Task 7.3) sobem uma aplicação Nest real, mas testam **1
módulo por vez**, com o service inteiro substituído por um mock (`useValue`). Provam que o HTTP
→ controller → DTO/validação → service (mockado) funciona, mas não provam que módulos DIFERENTES
se encaixam corretamente via injeção de dependência real.

`efootball-recommendation-flow.e2e-spec.ts` sobe uma aplicação real importando os **módulos de
verdade** encadeados: `OnboardingModule` → `RecommendationsModule` (que importa `ProgressModule`,
que importa `LearningModule` + `ReportsModule` + `GamesModule`) — todas as classes de serviço são
as reais, unidas pelo container de DI de verdade. Só 2 substituições:

- `PrismaService` → fake em memória (sem Postgres disponível neste ambiente/CI)
- `ReportsService` → mock (Match Analysis é EA FC, fora do escopo deste fluxo eFootball)

Isso é o que prova que a fiação `@Module({ imports: [...] })` está correta — um import esquecido
ou uma dependência circular só aparece aqui, nunca num teste unitário que instancia a classe
diretamente via `new XService(mockA, mockB)`.

## O fluxo testado (8 passos)

```
1. Usuário novo, sem onboarding          → GET  /recommendations/next-best-action → COMPLETE_ONBOARDING
2. Completa onboarding                   → POST /onboarding/efootball {level: BEGINNER}
3. Onboarding feito, elenco vazio        → GET  .../next-best-action → ADD_PLAYERS
4. Com jogador, sem squad                → GET  .../next-best-action → BUILD_SQUAD
5. Com jogador e squad                   → GET  .../next-best-action → DO_LESSON (aula real da Academia)
6. Dispensa a recomendação               → POST /recommendations/:id/dismiss → 204
7. Mesmo estado                          → GET  .../next-best-action → mesma ação, dismissed: true
8. Conclui a aula recomendada            → GET  .../next-best-action → ALL_CAUGHT_UP, dismissed: false
```

Passo 5 é o mais importante do ponto de vista de "e2e de verdade": `RecommendationsService` chama
`ProgressService.getMyProgress()` que chama `LearningService.getProfile()`, e separadamente chama
`LearningService.listPaths()` + `LearningService.getPath()` — 3 serviços reais, através de 2
módulos importados um dentro do outro, produzindo o nome exato da aula (`"Fundamentos > Como o
jogo funciona"`) que só existe porque o fixture de `LearningPath`/`LearningModule`/`Lesson` foi
atravessado corretamente pela cadeia real de chamadas.

Passo 8 prova a regra de dismiss da Tarefa 17 (`dismissedAt` só é limpo quando a ação computada
muda de verdade) através de HTTP real, não de uma chamada direta ao service.

## O fake de `PrismaService`

Não é um mock genérico — é um pequeno banco em memória (`Map`s + arrays) com semântica real pros
poucos modelos que este fluxo toca: `game` (fixo), `userLearningProfile`, `learningPath` (com
`modules`/`lessons` aninhados, fixture estático), `lesson`/`userLessonProgress`,
`userProgressSnapshot`, `learningRecommendation` — mais `count()` simples (retornando uma
variável mutável) para `userPlayer`/`userPlayerBuild`/`userSquad`/`economyRecommendation`, que
este fluxo só precisa contar, nunca ler de verdade.

## Achado ao rodar o primeiro `nest build` depois de `apps/api/test/` existir

Sem `tsconfig.build.json`, `nest build` sempre compilou **todo** `*.spec.ts` de `src/` pra dentro
de `dist/` — 91 arquivos confirmados, condição pré-existente desde a Fase 1 do projeto original,
nunca notada porque `dist/src/main.js` (o único arquivo que a imagem Docker realmente usa)
funcionava normalmente apesar do lixo extra. O novo `test/*.e2e-spec.ts` teria se somado a essa
lista. Corrigido com `apps/api/tsconfig.build.json` — conteúdo padrão do template oficial do
Nest CLI (`exclude: ["node_modules", "test", "dist", "**/*spec.ts"]`), o arquivo que deveria ter
existido desde o scaffold inicial (Task 1.3) e nunca existiu. `dist/` agora contém só código de
produção.

## Fora de escopo desta tarefa

- **Cobertura e2e de todo o módulo** — só o fluxo Onboarding → Progresso → Recomendação foi
  coberto (o mais representativo, por atravessar mais módulos reais de uma vez). Squad Builder,
  Economy Advisor, Player Scanner, Ask Coach continuam só com cobertura unitária/integração de
  1 módulo — suficiente pra essa tarefa, mas não é um substituto completo de e2e pra cada fluxo.
- **E2e contra Postgres/Redis reais** — este ambiente não tem Docker disponível; o fake em
  memória é fiel ao schema mas não substitui validar contra um banco de verdade (constraints,
  índices únicos, cascade deletes) — mesma ressalva que já valia pros testes unitários existentes.

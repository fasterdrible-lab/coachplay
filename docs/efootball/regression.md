# Regressão (Tarefa 23)

> Sem mudança de código — validação de ponta a ponta do monorepo inteiro depois das Tarefas
> 1–22, confirmando "aditivo e isolado" na prática (não só como intenção documentada desde a
> auditoria original, risco 2).

## Os 4 alvos de build do monorepo — todos limpos

| Comando | Resultado |
|---|---|
| `npm run build:api` | ✅ `prisma generate` + `nest build`, sem erros |
| `npm run build:web` | ✅ Next.js 14 — lint + `tsc` + 25 rotas geradas (10 novas do módulo eFootball) |
| `npm run build:desktop` | ✅ Electron — `tsc` (main) + esbuild (renderer, bundle 1.0 MB) |
| `npm run build:extension` | ✅ Chrome MV3 — `tsc` + 4 bundles esbuild (background/content/popup/offscreen) |

## Os 4 alvos de teste do monorepo — todos verdes, 756 testes no total

| Comando | Resultado |
|---|---|
| `npm run test:api` | ✅ 91 suites / 682 testes |
| `npm run test:e2e` | ✅ 1 suite / 8 testes (novo desde a Tarefa 22) |
| `npm run test:desktop` | ✅ 2 suites / 15 testes |
| `npm run test:extension` | ✅ 9 suites / 51 testes |

Nenhuma dessas 4 suítes de teste foi criada ou alterada especificamente pra esta tarefa — rodar
todas juntas é o próprio ato de regressão.

## "Aditivo e isolado" confirmado via diff, não só por leitura de código

```
git diff --stat HEAD -- \
  apps/api/src/modules/ai-coach apps/api/src/modules/game-analysis \
  apps/api/src/modules/capture-sessions apps/api/src/modules/tactical-engine \
  apps/api/src/modules/matches apps/api/src/modules/auth apps/api/src/modules/plans \
  apps/api/src/modules/reports \
  "apps/web/src/app/(dashboard)/matches" "apps/web/src/app/(dashboard)/dashboard" \
  "apps/web/src/app/(dashboard)/evolution" \
  apps/desktop apps/extension
→ (saída vazia — zero linhas alteradas)
```

Nenhuma das 22 tarefas anteriores do módulo eFootball tocou o pipeline clássico de EA FC
(`ai-coach`, `game-analysis`, `capture-sessions`, `tactical-engine`, `matches`, `auth`, `plans`,
`reports` — este último só foi **lido**, nunca modificado, pela integração da Tarefa 15) nem os
outros dois clientes do monorepo (`apps/desktop`, `apps/extension`). `docs/efootball-architecture.md`
(risco 2) exigia exatamente isso desde a auditoria original — confirmado por diff, não só por
memória de "eu não toquei nesses arquivos".

## Cadeia de migrations — sem colisão, ordem sequencial

```
...20260915001446_add_learning                    (Tarefa 12, já existente)
   20260915120000_add_onboarding_completed_at      (Tarefa 13)
   20260915140000_add_user_progress_snapshot       (Tarefa 16)
   20260915160000_add_learning_recommendation      (Tarefa 17)
   20260915180000_add_ai_call_log                  (Tarefa 21)
```

5 migrations novas nesta sessão, timestamps estritamente crescentes, sem sobreposição. Cada uma
validada por `prisma generate` no momento em que foi criada (sintaxe do schema correta).

## Limitação que segue sem solução — mesma de toda a sessão

Sem Docker disponível neste ambiente, **nenhuma migration foi de fato aplicada contra um
Postgres real** nesta sessão inteira (Tarefas 13–23). A validação praticada foi:

- `prisma generate` — valida a sintaxe do `schema.prisma`, não a SQL das migrations em si
- Os fakes de `PrismaService` usados nos testes unitários/e2e — validam a **semântica** de como
  cada service usa o Prisma Client (formato de `where`/`include`/`upsert`), não que a tabela real
  no Postgres aceite exatamente essa SQL

Isso não é uma lacuna nova desta tarefa — é uma limitação de ambiente carregada desde a Tarefa 13
(primeira vez que uma migration nova foi criada nesta sessão) e documentada em cada tarefa
subsequente que criou uma tabela. Regra prática antes de deploy: rodar `prisma migrate deploy`
contra um Postgres real (dev ou staging) antes de considerar essas 5 migrations prontas pra
produção — mesmo passo que `docs/DEPLOY.md`/`docs/DEPLOY_SHARED_VPS.md` já descrevem pro resto
do projeto.

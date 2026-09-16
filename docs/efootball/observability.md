# Observabilidade (Tarefa 21)

> Fecha a lacuna que a Tarefa 20 deixou explicitamente em aberto: custo calculado e logado por
> chamada de IA, mas nunca persistido — sem histórico consultável. `AiCallLog` é exatamente a
> tabela que a auditoria original (`docs/efootball-architecture.md`, risco 7) já previa: "vai
> exigir uma tabela nova (`AiCallLog` ou similar) que hoje não existe".

## Modelo — `AiCallLog`

```
AiCallLog {
  id, feature, provider?, success, costEstimate, latencyMs, errorMessage?, userId?, createdAt
}
```

1 linha por chamada a `EfootballCoachService.runCascade()` — **sucesso OU falha total**, nunca só
sucesso, porque taxa de falha é uma métrica de observabilidade tão relevante quanto custo.

| Campo | Preenchido quando |
|---|---|
| `feature` | Sempre — `'squad_coach'` (Tarefa 10) ou `'build_coach'` (Tarefa 14) |
| `provider` | Só quando `success: true` — modelo que respondeu (`claude-sonnet-4-6`, `gpt-4o`, ...) |
| `costEstimate` | `0` quando `success: false` (nenhuma chamada teve `usage` pra cobrar) |
| `latencyMs` | Sempre — tempo total da cascata, não só do provedor vencedor (ver abaixo) |
| `errorMessage` | Só quando `success: false` — hoje sempre `"todos os provedores de IA falharam"` |
| `userId` | Opcional (mesmo padrão de `AuditLog`) — nunca bloqueia a gravação se ausente |

`userId` é sempre preenchido na prática (`explainSquad`/`explainBuild` agora exigem o parâmetro),
mas o campo é opcional no schema pelo mesmo motivo que `AuditLog.userId` é — best-effort não deve
depender de uma FK nunca falhar.

## Por que `latencyMs` mede a cascata inteira, não só o provedor vencedor

Um `runCascade()` que tenta Claude (falha em 2s) e depois GPT-4o (sucesso em 1s) levou 3s do ponto
de vista de quem fez a pergunta — é isso que afeta a experiência percebida, não só o tempo do
provedor que respondeu por último. `latencyMs = Date.now() - startedAt`, medido desde antes do
primeiro `provider.call()`.

## Gravação best-effort

Mesmo padrão de `AuditLogsService.log()`: `logAiCall()` está dentro de um `try/catch` que só loga
um aviso (`Logger.warn`) se a escrita falhar — nunca propaga o erro, nunca derruba a resposta que
o usuário já está esperando. Testado explicitamente (`efootball-coach.service.spec.ts`).

## Quem alimenta o log — `explainSquad`/`explainBuild` ganharam `userId`

Antes da Tarefa 21, nem `EfootballCoachService.explainSquad()` nem `explainBuild()` sabiam QUEM
fez a chamada (só recebiam o contexto já resolvido). Agora ambos exigem `userId: string` como
segundo parâmetro:

- `SquadBuilderService.explainSquad(userSquadId, currentUser)` — já tinha `currentUser` em
  escopo (ownership check), só passou a repassar `currentUser.id` pro Coach
- `AskCoachService.handleBuildRecommendation()` — não recebia `currentUser` antes (só usava
  `dto`); ganhou o parâmetro, propagado desde `ask()`

## `GET /admin/efootball-ai-usage`

```
@Roles('admin')
  → {
      totalCalls, successCalls, failureRate, totalCost, avgLatencyMs,
      byFeature: [{ feature, calls, totalCost, avgLatencyMs }],
      recentCalls: [{ id, feature, provider, success, costEstimate, latencyMs, errorMessage, createdAt, user }]
    }
```

Endpoint novo em `AdminModule` — **separado** de `GET /admin/usage` (que é 100% EA FC, agrega
`AIAnalysis`/`Match`, e não foi alterado). `byFeature` via `Prisma.groupBy`; `recentCalls` traz as
20 chamadas mais recentes, mais recente primeiro.

Frontend: nova seção "eFootball — Custo de IA" em `(admin)/admin/usage/page.tsx`, abaixo da seção
clássica (Provedores de IA + Uso por usuário) — completa o ciclo observabilidade de ponta a ponta:
log estruturado (Tarefa 20) → persistência (`AiCallLog`) → agregação (`getEfootballAiUsage`) →
visibilidade admin.

## Fora de escopo desta tarefa

- **Alertas automáticos** (ex.: taxa de falha acima de X%, custo diário acima de Y) — a UI admin
  mostra a taxa de falha com destaque visual quando > 10%, mas não há nenhum mecanismo de
  notificação proativa.
- **Retenção/expurgo de `AiCallLog`** — a tabela cresce indefinidamente; nenhuma política de
  limpeza foi definida (mesmo padrão de `TacticalSnapshot`, que já documentava essa lacuna desde
  o Tactical Engine Fase 1 — "preparando futura rotina de expurgo, sem política implementada").

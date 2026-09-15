# Coach de Elenco — `efootball-coach` (Tarefa 10)

> Primeira integração de IA generativa do módulo eFootball. Segue à risca o Princípio 2
> ("separar cálculo de explicação"): a IA nunca escolhe jogador nem recalcula nada do Squad
> Builder (Tarefa 9) — só recebe o resultado já pronto e narra em texto.

## Isolamento do `AiCoachService` "clássico"

Módulo novo e separado (`efootball-coach`), não uma extensão do `ai-coach` existente — o
`AiCoachService` de hoje é 100% EA FC (prompts de narração de partida) e não deve ser tocado por
este trabalho (risco 2 de `docs/efootball-architecture.md`). Só reaproveita `SettingsService`
(chaves de API por provedor, painel admin > env var).

## Cascata de provedores (mesmo padrão do `AiCoachService`)

```
Claude Sonnet 4.6 → GPT-4o → DeepSeek → Groq (llama-3.3-70b-versatile)
```

Best-effort: se todos falharem, `explainSquad()` retorna `null` (nunca lança) — uma explicação
perdida não pode derrubar quem a chama.

## Fluxo

```
SquadBuilderService.explainSquad(userSquadId, user)
  ↓ reexecuta buildSquad() (Tarefa 9) contra o elenco ATUAL — reflete qualquer troca de jogador
  ↓   desde que o elenco foi salvo, em vez de reler startingXI/bench já persistidos
  ↓ resolve nomes de jogador + composição do elenco por grupo posicional (resolvePositionGroup,
  ↓   reaproveitado do player-build-engine, Tarefa 5)
  ↓ monta SquadCoachContext (100% resolvido — a IA nunca consulta o banco)
  ↓ buildSquadCoachPrompt() — função pura, todo fato vem do contexto
  ↓ EfootballCoachService.explainSquad() — cascata de provedores
```

`GET /squad-builder/squads/:id/explain` (ownership via `assertOwner`, mesmo padrão de
`MatchesService`).

## Exemplo (do enunciado da Tarefa 10)

> "Seu elenco possui muitos atacantes e poucos laterais. Por isso recomendo priorizar um
> lateral-direito."

O motor (Tarefa 9) já sabe EXATAMENTE qual slot ficou vazio (`weakPositions`, ex.: `RB: EMPTY`) —
a IA não precisa adivinhar qual posição falta, só fraseia naturalmente o que já foi decidido. O
prompt instrui explicitamente a nunca recomendar além das posições fracas listadas.

## Testes

`squad-coach-prompt.builder.spec.ts` valida o contexto enviado (formação, jogador, posição fraca
corretos no prompt, nenhum jogador fora do contexto mencionado). `efootball-coach.service.spec.ts`
mocka as SDKs (`@anthropic-ai/sdk`, `openai`) e valida os 4 níveis de fallback + `null` quando
todos falham, além de inspecionar o prompt realmente enviado à primeira chamada.

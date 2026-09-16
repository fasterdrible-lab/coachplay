# Ask Coach / Intent Router — `ask-coach` (Tarefa 14)

> Pergunta em texto livre → intent determinístico → motor correspondente. Só narra em texto o que
> um motor já calculou; nunca deixa a IA inventar dado de jogo ou decidir por conta própria.

## Fluxo

```
POST /ask-coach
  { question: string, userSquadId?, packId?, userCoins?, playerCardId?, level?,
    availableProgressionPoints?, strategy? }
  → { intent, answer, modelUsed: string | null, costEstimate: number }
```

`costEstimate` (Tarefa 20, USD) é sempre `0` nas intents determinísticas e em `UNKNOWN` — só
`BUILD_RECOMMENDATION`/`SQUAD_ADVICE` podem devolver um valor `> 0`, herdado de
`EfootballCoachService` (ver `docs/efootball/ai-cost-control.md`).

```
question → routeIntent() (intent-router.ts, sem IA — busca de palavra-chave sobre texto
                           normalizado, reaproveita normalizePlayerName da Tarefa 3)
         → um dos 5 intents conhecidos, ou UNKNOWN
         → handler correspondente em AskCoachService
```

| Intent | Motor chamado | Usa IA? |
|---|---|---|
| `PLAYER_SEARCH` | `PlayersService.search` (Tarefa 3) | Não |
| `BUILD_RECOMMENDATION` | `PlayerBuildEngineService.generateBuild` (Tarefa 5) | Sim — `EfootballCoachService.explainBuild` (novo) |
| `SQUAD_ADVICE` | `SquadBuilderService.explainSquad` (Tarefa 9/10) | Sim — já existente (Tarefa 10) |
| `ECONOMY_ADVICE` | `EconomyAdvisorService.evaluate` (Tarefa 11) | Não — `reasons` do motor já é texto |
| `LEARNING_RECOMMENDATION` | `LearningService` (Tarefa 12) | Não |
| `UNKNOWN` | nenhum | Não — resposta fixa |

## Por que só 2 das 5 intents usam IA

Regra de dados do projeto (repetida em todo o módulo eFootball): nunca deixar uma IA generativa
inventar ou recalcular um fato de jogo. `PLAYER_SEARCH`, `ECONOMY_ADVICE` e
`LEARNING_RECOMMENDATION` já produzem uma resposta textual suficiente a partir de dado 100%
determinístico — chamar IA ali só custaria dinheiro sem agregar (adianta parte da Tarefa 20,
controle de custo de IA). `SQUAD_ADVICE`/`BUILD_RECOMMENDATION` são os únicos casos em que o motor
produz uma estrutura rica demais pra virar frase sozinha (posições fracas + composição do elenco;
atributos priorizados + ganhos) — aí a IA só narra, nunca decide.

`UNKNOWN` (pergunta fora do vocabulário reconhecido) também nunca chama IA — uma IA generativa sem
grounding tentando responder sobre mecânica de jogo arriscaria inventar informação; a resposta é
sempre um texto fixo orientando os temas que o Ask Coach sabe responder.

## Coach de Build — `EfootballCoachService.explainBuild()` (novo)

Estende o `EfootballCoachService` (Tarefa 10, antes só `explainSquad`) com um segundo método que
narra a saída do Player Build Engine (Tarefa 5) — primeira vez que `PlayerBuildExplanationData`
(prioritizedStats/topGains, existente desde a Tarefa 5 mas sem consumidor de texto) vira frase. O
loop de cascata (Claude → GPT-4o → DeepSeek → Groq) foi extraído para um método privado
`runCascade()` compartilhado entre os dois métodos — mesmo comportamento de antes, só reuso.

## Slots opcionais no corpo — por que não extrair da pergunta

`userSquadId`/`packId`/`userCoins`/`playerCardId`/`level`/`availableProgressionPoints`/`strategy`
nunca são inferidos a partir do texto da pergunta — não existe fórmula confiável e sem IA pra virar
"aquele pack ali" num `packId` real, e "quantos pontos de progressão estão disponíveis" não é um
dado que o motor possa adivinhar (não existe fórmula publicada nível→pontos, ver
`docs/efootball/player-build-engine.md`). O frontend preenche esses campos quando a pergunta parte
de uma tela específica (ex.: usuário já está vendo um pack e pergunta "vale a pena?"). Sem os
slots necessários, a resposta é uma pergunta de esclarecimento determinística — nunca uma tentativa
de adivinhar o que falta.

`SQUAD_ADVICE` é a exceção parcial: sem `userSquadId`, o serviço busca o elenco padrão do usuário
(`isDefault: true`, senão o mais recente) antes de desistir — só pede pra montar um elenco no
Squad Builder se o usuário realmente não tiver nenhum.

## Best-effort sem resposta vazia

Diferente do resto do módulo eFootball-coach (que retorna `null` quando toda a cascata de IA
falha), o Ask Coach nunca devolve uma resposta vazia: `BUILD_RECOMMENDATION` cai pra um texto
determinístico montado com os mesmos fatos do motor (`fallbackBuildAnswer`) quando a IA falha;
`SQUAD_ADVICE` cai pra uma mensagem genérica orientando a ver os detalhes na tela do Squad Builder.
`modelUsed` vem `null` nesses casos (e em toda intent que nunca chama IA), permitindo o frontend
diferenciar uma resposta narrada por IA de uma resposta determinística.

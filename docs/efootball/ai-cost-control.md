# Controle de custo de IA (Tarefa 20)

> `EfootballCoachService` — único ponto do módulo eFootball que chama IA generativa (Coach de
> Elenco/Tarefa 10, Coach de Build/Tarefa 14) — descartava `response.usage` inteiramente. Nenhuma
> chamada de IA do módulo eFootball tinha custo calculado, diferente do `AiCoachService` clássico
> (`AIAnalysis.costEstimate`, calculado desde a Fase 4 original do projeto).

## O que mudou

`runCascade()` (privado, compartilhado entre `explainSquad`/`explainBuild`) agora lê o `usage` da
resposta de cada provedor — `input_tokens`/`output_tokens` (Anthropic) ou `prompt_tokens`/
`completion_tokens` (SDK `openai`, reusado por GPT-4o/DeepSeek/Groq) — e calcula
`costEstimate = inputTokens × priceIn + outputTokens × priceOut`, com a mesma tabela de preços
(USD por token) já validada em `ai-coach.service.ts`:

| Modelo | Entrada (por 1M tokens) | Saída (por 1M tokens) |
|---|---|---|
| `claude-sonnet-4-6` | US$ 3,00 | US$ 15,00 |
| `gpt-4o` | US$ 2,50 | US$ 10,00 |
| `deepseek-chat` | US$ 0,27 | US$ 1,10 |
| `llama-3.3-70b-versatile` (Groq) | US$ 0,59 | US$ 0,79 |

Os preços são **duplicados**, não compartilhados entre `ai-coach` (clássico) e `efootball-coach`
— mesmo isolamento entre os dois módulos de IA já documentado desde a Tarefa 10 (risco 2 da
auditoria original: o pipeline clássico não deve ser tocado pelo módulo eFootball).

## Só a chamada que teve sucesso é cobrada

Mesmo princípio já usado em `AiCoachService.analyzeMatch`: se Claude falha e o Coach cai para
GPT-4o, o custo reportado é só o do GPT-4o — tentativas que falham antes de qualquer resposta não
têm `usage` pra calcular, e nunca são somadas ao custo final.

## Onde o custo aparece

```
SquadCoachExplanation  { explanation, modelUsed, costEstimate }   ← Tarefa 10
BuildCoachExplanation  { explanation, modelUsed, costEstimate }   ← Tarefa 14 (BUILD_RECOMMENDATION)
AskCoachAnswer         { intent, answer, modelUsed, costEstimate } ← Tarefa 14
```

`AskCoachAnswer.costEstimate` é sempre `0` nas 3 intents 100% determinísticas
(`PLAYER_SEARCH`/`ECONOMY_ADVICE`/`LEARNING_RECOMMENDATION`) e em `UNKNOWN` — só
`BUILD_RECOMMENDATION`/`SQUAD_ADVICE` podem devolver um valor `> 0`, herdado diretamente da
explicação de IA quando ela tem sucesso (`0` também quando a IA falha e a resposta cai pro
fallback determinístico, já que nenhuma chamada teve sucesso nesse caso).

Frontend: `formatAiCost()` (`lib/efootball.ts`) exibe o custo ao lado do `modelUsed` já mostrado em
`squads/[id]/page.tsx` (painel do Coach de Elenco) e `ask-coach/page.tsx` (chat) — "controle" no
sentido literal: o usuário vê quanto cada resposta de IA custou.

## Log por chamada (visibilidade antes da Tarefa 21)

Cada chamada bem-sucedida loga custo + tokens de entrada/saída (`Logger.log`), dando visibilidade
imediata via log antes de qualquer tabela dedicada existir. **Isso não é um histórico consultável**
— não há persistência em banco por chamada. A Tarefa 21 (observabilidade) já estava reservada
desde a auditoria original (`docs/efootball-architecture.md`, seção 1.9) pra fechar exatamente essa
lacuna: uma tabela tipo `AiCallLog` com `llm_cost`/`llm_latency` por chamada, consultável
depois — este documento não antecipa esse trabalho.

## Fora de escopo desta tarefa (decisão deliberada)

- **Limite/cap de gasto por usuário ou plano** — não existe hoje nenhuma integração com
  `PlansService`/`AnalysisLimitGuard` pro módulo eFootball (a tabela de componentes reutilizados
  já registrava isso como "se builds/scans entrarem em algum limite de plano futuramente" — ainda
  não é o caso). O rate limiting anti-abuso adicionado na Tarefa 19 (`@Throttle` em
  `POST /ask-coach`/`GET /squad-builder/squads/:id/explain`) é sobre frequência de chamadas
  (segurança/DoS), não sobre valor em dinheiro gasto.
- **Persistência/agregação de custo** (histórico por chamada, dashboard admin) — Tarefa 21.

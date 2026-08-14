# Tactical Engine — Algoritmo de Scoring

**Escopo:** documenta, de forma auditável, como o Tactical Engine chega da nota 0–100 de uma
`TacticalAction` (`DecisionScore`) até a classificação final (`DecisionClassification`) e até a
decisão de recusar uma avaliação (confiança insuficiente). Referenciado desde a Fase 3
(`decision-score.type.ts`, `decision-score.config.ts`) — este documento é o que faltava (Fase 7,
Tarefa 38). Pré-requisito: [`tactical-engine-domain.md`](tactical-engine-domain.md) para o
vocabulário (`DecisionScore`, `DecisionEvaluation`, `PitchZone` etc.).

---

## 1. Visão geral do fluxo

```
TacticalGameState + ballCarrierId          (DecisionContext)
        │
        ▼
generateActions()                          candidatas: PASS/SAFE_PASS/PROGRESSIVE_PASS/
                                            RECYCLE/SWITCH_SIDE/CARRY/HOLD (action-generator.ts)
        │
        ▼
evaluateConfidence()                       agrega confiança (Tarefa 29) — insuficiente → null,
        │                                  nenhuma nota é calculada (ver seção 5)
        ▼
calculateDecisionScore()                   6 componentes × pesos → total 0-100
        │                                  (decision-score.calculator.ts)
        ▼
classifyDecisionScore()                    total → 1 de 6 faixas (decision-classification.ts)
        │
        ▼
evaluateDecision()                         ação real × melhor alternativa → DecisionEvaluation
```

Tudo acima é **determinístico** — nenhuma chamada a IA generativa calcula ou influencia um
score. IA generativa (Claude/GPT-4o/DeepSeek, via `ai-coach`) só entra depois, para transformar
um `DecisionEvaluation` já calculado em texto (`AiCoachService.explainDecision`, Fase 5) — ver
seção 6.

---

## 2. Os 6 componentes do `DecisionScore`

Calculados em `decision-score.calculator.ts`, todos na escala 0–100. `total` é a soma ponderada
dos 6, clampada em `[0, 100]`.

| Componente | O que mede | Como é calculado |
|---|---|---|
| `possessionSafety` | Risco de perder a posse com esta ação | `100 - action.estimatedRisk` (o risco já vem calculado pelo `action-generator.ts` a partir de `obstructionRisk`/`pressureRisk` da linha de passe, ou da pressão sobre o portador para CARRY/HOLD) |
| `progression` | Quanto a ação avança o terço do campo | Compara o terço de origem (posição do portador) com o terço de destino (`action.targetZone`); avança 1 terço = +50, recua 1 terço = -50, mesmo terço = 0, tudo somado a 50 e clampado. Sem `targetZone` (HOLD) → 50 (neutro) |
| `spaceCreation` | Espaço livre na zona de destino | Lê `SpaceRegion.freeSpace` (Fase 2, `space.evaluator.ts`) da zona-alvo (ou da zona atual do portador, se a ação não tem `targetZone`) |
| `defensiveBalance` | Risco deixado atrás da bola | `DefensiveSafetyScore` (Fase 2, `defensive-balance.evaluator.ts`) — **mesmo valor para todas as candidatas do mesmo instante** (reflete o equilíbrio no momento da decisão, não uma projeção pós-ação; ver limitação na seção 4) |
| `futureOptions` | Quantas continuações boas se abririam depois desta ação | Reaproveita `evaluatePassingLanes` (Fase 2) a partir de quem ficaria com a bola após a ação; cada linha de passe com `score >= SAFE_PASS_SCORE_THRESHOLD` (70) soma 34 pontos, 3+ já satura em 100 |
| `pressureManagement` | Quão bem a ação lida com a pressão adversária no instante | `HOLD`: `100 - pressure.score` (segurar sob pressão é ruim). Qualquer outra ação: `100 - pressure.score * 0.3` (mover a bola já alivia a maior parte da pressão) — ver nota histórica na seção 4 |

### Pesos (versão `1.0.0`, `decision-score.config.ts`)

| Componente | Peso |
|---|---|
| `possessionSafety` | 0.25 |
| `progression` | 0.20 |
| `defensiveBalance` | 0.20 |
| `spaceCreation` | 0.15 |
| `futureOptions` | 0.10 |
| `pressureManagement` | 0.10 |
| **Soma** | **1.00** (validado por teste, `decision-score.config.spec.ts`) |

Alterar um peso é uma **mudança de produto** — recalibra a nota de toda decisão já avaliada.
Qualquer alteração deve subir `DECISION_SCORE_CONFIG_VERSION`.

---

## 3. Classificação (`decision-classification.ts`)

`DecisionScore.total` (0–100) → uma de 6 faixas, sempre nesta ordem (limite superior inclusivo):

| Faixa | `total` |
|---|---|
| `MAJOR_ERROR` | 0–19 |
| `ERROR` | 20–39 |
| `RISKY` | 40–59 |
| `ACCEPTABLE` | 60–74 |
| `GOOD` | 75–89 |
| `EXCELLENT` | 90–100 |

Tradução para PT-BR na UI é responsabilidade do frontend/`ai-coach` — os termos técnicos
internos nunca mudam (contrato estável para quem persiste/consulta `DecisionEvaluation`).

---

## 4. Limitações conhecidas (documentadas, não bugs)

- **`defensiveBalance` não muda entre candidatas do mesmo instante** — o motor não simula
  reação do adversário nem física do jogo (ver `docs/tactical-engine-current-state.md` e Tarefa
  40). O "próximo estado" usado por `decision-tree.evaluator.ts` só troca quem é o portador da
  bola, não reprojeta posições.
- **`pressureManagement` já passou por uma correção de viés** (CHANGELOG 0.41.0): a fórmula
  original dava 100 para `HOLD` e só 50 para qualquer outra ação mesmo sem pressão nenhuma,
  enviesando o motor a sempre preferir "segurar a bola". A fórmula atual (seção 2) só penaliza
  quando há pressão real a gerenciar.
- **A "diferença simples" foi descartada em outros pontos do motor pelo mesmo motivo de viés**
  (ex.: `initiative.evaluator.ts`, Fase 4) — sempre que uma fórmula usar subtração entre dois
  sinais, os testes precisam cobrir o cenário onde os dois sinais estão "do mesmo lado" (ambos
  altos ou ambos baixos), não só o caso onde divergem.

---

## 5. Quando o motor se recusa a pontuar (anti-falso-positivo)

Regra geral do plano original (Tarefa 15/30) — **implementação direta em código**, não uma
convenção informal:

| Situação | Onde | Resultado |
|---|---|---|
| Ação informada não corresponde a nenhuma candidata gerada | `decision.evaluator.ts` | `evaluateDecision()` retorna `null` |
| Confiança agregada do estado < 0.5 (Tarefa 29/30, ver `confidence.evaluator.ts`) | `decision.evaluator.ts` | `evaluateDecision()` retorna `null`, mesmo com candidata válida |
| Princípio não está em jogo neste instante (ex.: `PROPHYLAXIS` sem pressão real) | `principle-adherence.evaluator.ts` | `PrincipleAdherence.adhered = null` (nunca `true`/`false` inventado) |
| Amostra insuficiente (< 3 observações) ou taxa inconclusiva entre 60–85% | `tactical-pattern.detector.ts` | Nenhum `TacticalPattern` reportado para aquele princípio |
| Ninguém tem a bola / posse desconhecida | domínio (`DecisionContext`) | Não existe `DecisionContext` a avaliar — regra estrutural, não um score baixo |

**Nunca**: o motor corrige silenciosamente um dado ruim, infere confiança de onde ela não existe,
ou preenche um campo obrigatório com um valor "razoável" quando falta informação real.

### Sistema de confiança (`confidence.evaluator.ts`, Tarefa 29)

```
EngineConfidence.score = MIN(gameState.confidence, ballCarrier.confidence, target?.confidence)
EngineConfidence.sufficient = score >= 0.5
```

Usa sempre o **menor** sinal disponível — nunca o mais otimista, porque uma decisão só é tão
confiável quanto o dado mais fraco que ela usa. Sinais ausentes (jogador não encontrado) não
entram na conta; se **nenhum** sinal existir, `score = 0` (nunca inventa confiança do nada).

---

## 6. Fronteira com IA generativa (`ai-coach`, Fases 5–6)

`AiCoachService.explainDecision()`/`deliverLiveTacticalFeedback()` consomem um `DecisionEvaluation`
**já calculado** por este algoritmo — a IA nunca recebe posições de jogadores nem recalcula
nota/classificação/princípios. O prompt (`buildDecisionExplanationPrompt`, `ai-coach.service.ts`)
inclui só: tipo da ação escolhida, nota total, classificação, diferença para a melhor
alternativa e os nomes dos princípios seguidos/violados (traduzidos via
`getStrategicPrinciple().name`). A IA produz exclusivamente `TacticalDecisionFeedback.explanation`
(texto livre) — todo o resto do objeto vem pronto do motor.

---

## 7. Exemplo de ponta a ponta

Cenário coberto por `decision.evaluator.spec.ts` (critério de sucesso do plano original) e
reutilizável via `pressuredCentralPassFixture()` (`tactical-fixtures.ts`, Tarefa 34):

- Portador no meio-campo, dois adversários pressionando de perto.
- Candidata real: passe central, bloqueado por um adversário no meio do caminho.
- Melhor alternativa: passe lateral, canal livre.
- Resultado: `actualScore.total < bestAlternativeScore.total`, `scoreDifference < 0`,
  `classification` em `RISKY`/`ERROR`/`MAJOR_ERROR` — o motor reconhece a decisão real como pior
  que a alternativa disponível, com a alternativa correta identificada.

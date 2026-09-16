# Integração com Match Analysis (Tarefa 15)

> A recomendação de aula da Academia (Tarefa 12, servida via Ask Coach — Tarefa 14) passa a
> considerar a categoria de erro mais frequente das partidas REAIS já analisadas, quando existem.

## Por que só agregação por categoria

`docs/efootball-architecture.md` (risco 3) já documentava, antes desta tarefa, que não existe em
nenhum lugar do projeto detecção real de posição de jogador/bola — nem no pipeline de vídeo
(`game-analysis`, Gemini aponta erro/timestamp mas não coordenada) nem no Tactical Engine
(`TacticalStateProvider` sem implementação real, `docs/tactical-engine-current-state.md`). Uma
correlação fina tipo "seu zagueiro sai de posição com frequência" exigiria exatamente esse dado, e
continua bloqueada. O que **já existe com dados reais** é a agregação por categoria que
`ReportsService.getSummary()` (módulo `reports`, Fase 5 do MVP original) já calcula a partir de
`DetectedError.category` de partidas EA FC analisadas pelo Gemini — `attack`/`defense`/`passing`/
`decision`. Esta tarefa usa exatamente essa agregação, nada além dela.

## Fluxo

```
AskCoachService.handleLearningRecommendation()
  → ReportsService.getSummary(userId) → worstCategory ('attack'|'defense'|'passing'|'decision'|null)
  → LearningService.getMatchInformedRecommendation(worstCategory, gameId, user)
      → mapWorstCategoryToModuleTitle(worstCategory)   (match-analysis-recommendation.util.ts, puro)
          attack → 'Finalização' | defense → 'Defesa' | passing → 'Passe' | decision → 'Movimentação'
      → busca o LearningModule com esse título (qualquer nível, não só o do perfil do usuário)
      → primeira aula do módulo: só recomenda se já desbloqueada E ainda não concluída
  → achou? responde com essa aula, citando a categoria diagnosticada
  → não achou (sem partida analisada, categoria sem módulo, módulo inexistente, aula
    bloqueada/já concluída)? cai pro comportamento anterior da Tarefa 14 — próxima aula
    sequencial da trilha do nível atual do usuário
```

## Por que nunca fura a ordem sequencial (Tarefa 12)

`getMatchInformedRecommendation` recomenda a primeira aula do módulo mapeado só se ela já estiver
desbloqueada pela regra de desbloqueio sequencial da própria trilha em que esse módulo vive (regra
inalterada desde a Tarefa 12: 1ª aula de cada trilha sempre liberada, as demais exigem a anterior
concluída). Isso pode significar recomendar uma aula de um nível diferente do nível atual do
usuário (ex.: usuário `ADVANCED` com `worstCategory: 'passing'` pode ser direcionado de volta pra
"Passe", que vive na trilha `BEGINNER`) — decisão deliberada: o diagnóstico vem de partidas reais,
não do autorrelato de nível, e módulos como "Passe" ou "Defesa" não têm um equivalente em nível
mais avançado no catálogo atual (`docs/efootball/learning.md`).

## Limitação conhecida (EA FC, não eFootball)

O pipeline de vídeo que gera `DetectedError` (`game-analysis`, Gemini) é 100% EA FC hoje — não há
análise de vídeo de partidas de eFootball no projeto (ver `docs/efootball-architecture.md`, risco
2: aditivo e isolado, sem tocar nesse pipeline). Um usuário sem nenhuma partida EA FC analisada
(`worstCategory: null`) simplesmente cai no comportamento anterior, sem erro nem mensagem
diferenciada — o valor desta tarefa é estritamente incremental para quem já usa os dois módulos.

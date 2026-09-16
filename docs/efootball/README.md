# Módulo eFootball — Documentação final (Tarefa 24)

**Status: 24/24 tarefas concluídas (2026-09-15).** Este documento é o ponto de entrada único do
módulo — reúne, num só lugar, a API HTTP completa, o mapa dos 19 documentos técnicos por engine,
o modelo de dados novo e as limitações conhecidas que sobrevivem ao fim do roadmap original.

Plano completo, domínio e auditoria pré-implementação em
[`docs/efootball-architecture.md`](../efootball-architecture.md) (Tarefas 1–2 vivem lá, não
aqui — é o documento vivo desde o início do módulo). Checklist tarefa a tarefa em
[`docs/TASKS.md`](../TASKS.md#módulo-efootball-em-andamento).

## O que é o módulo eFootball

Um novo subdomínio multi-jogo dentro do Coach Play, transformando o produto de "analisador de
partidas de EA FC" (o MVP original, Fases 1–7) numa plataforma de treinamento pra futebol virtual
que também cobre eFootball — sem tocar o pipeline clássico de EA FC (confirmado sem nenhuma
alteração até o fim, ver `docs/efootball/regression.md`). Cobre: banco de jogadores/cartas,
motor de build de jogador, scanner de carta por imagem, elenco do usuário, montador de
escalação, economia de packs, trilhas de aprendizado, onboarding, um coach conversacional
(Ask Coach), progresso agregado e recomendação adaptativa — todos determinísticos por padrão,
com IA generativa só pra narrar resultado já calculado (nunca pra decidir).

## Referência de API — todos os endpoints, por domínio

Todos atrás de `JwtAuthGuard` global (nenhum `@Public()`) — requerem `Authorization: Bearer
<token>`. `@Roles('admin')` marcado explicitamente onde se aplica.

### Domínio de jogo e catálogo (Tarefas 2–4)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/games` | Lista jogos ativos (só `EFOOTBALL` hoje) |
| `GET` | `/players?query=&gameId=` | Busca jogador por nome/apelido (substring, sem acento) |
| `GET` | `/players/:id` | Detalhe do jogador + suas cartas |
| `GET` | `/player-cards?playerId=&position=&cardType=` | Lista cartas com filtro |
| `GET` | `/player-cards/:id` | Detalhe da carta (atributos, skills, playstyles) |

### Player Build Engine (Tarefa 5) + comparador (Tarefa 6)

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/player-builds/generate` | Pré-visualiza uma build (não persiste — Tarefa 18) |
| `POST` | `/player-builds/compare` | Compara 2 builds já definidas pelo cliente |

### Player Scanner (Tarefa 7)

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/player-scanner/scan` | Identifica carta a partir de screenshot (multipart) — **10 req/min** |

### Meus Jogadores (Tarefa 8)

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/user-players` | Adiciona carta ao elenco |
| `GET` | `/user-players?position=&cardType=&minOverall=&maxOverall=&level=&favorite=` | Lista o elenco |
| `GET` | `/user-players/:id` | Detalhe |
| `PATCH` | `/user-players/:id` | Edita nível/posição favorita/notas/favorito |
| `DELETE` | `/user-players/:id` | Remove do elenco |
| `POST` | `/user-players/:id/builds` | Salva uma build (já calculada via `/player-builds/generate`) |
| `PATCH` | `/user-players/:id/builds/:buildId/activate` | Troca a build ativa |

### Squad Builder (Tarefa 9) + Coach de Elenco (Tarefa 10)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/squad-builder/formations?gameId=` | Lista formações do catálogo |
| `POST` | `/squad-builder/generate` | Gera preview de escalação (não persiste) |
| `POST` | `/squad-builder/squads` | Gera e salva um elenco |
| `GET` | `/squad-builder/squads?gameId=` | Lista elencos salvos |
| `GET` | `/squad-builder/squads/:id` | Detalhe de um elenco |
| `GET` | `/squad-builder/squads/:id/explain` | Narração por IA do resultado do motor — **10 req/min** |
| `DELETE` | `/squad-builder/squads/:id` | Remove um elenco |

### Economy Advisor (Tarefa 11)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/economy-advisor/packs?gameId=` | Lista packs disponíveis pra avaliação |
| `POST` | `/economy-advisor/evaluate` | Avalia se vale a pena abrir um pack |

### Academia CoachPlay (Tarefa 12)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/learning/paths?gameId=&level=` | Lista trilhas |
| `GET` | `/learning/paths/:id` | Trilha com unlocked/completed por aula |
| `GET` | `/learning/paths/:id/progress` | Progresso numérico numa trilha |
| `POST` | `/learning/lessons/:id/complete` | Conclui (ou repete) uma aula |
| `GET` | `/learning/profile` | Perfil de aprendizado (nível/objetivos/onboarding) |
| `PATCH` | `/learning/profile` | Altera nível/objetivos |

### Onboarding (Tarefa 13)

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/onboarding/efootball` | Registra nível/objetivos, retorna trilha inicial |

### Ask Coach (Tarefa 14)

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/ask-coach` | Pergunta em texto livre → intent router → motor correspondente — **15 req/min** |

### Progresso e Recomendação (Tarefas 16–17)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/progress/me` | Agrega métricas de todos os engines |
| `GET` | `/recommendations/next-best-action` | Próxima ação mais valiosa (cadeia de prioridade) |
| `POST` | `/recommendations/:id/dismiss` | Dispensa a recomendação atual |

### Admin — observabilidade de IA (Tarefa 21)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/admin/efootball-ai-usage` | `@Roles('admin')` — custo/latência/taxa de falha agregados |

Integração com Match Analysis (Tarefa 15) não tem endpoint próprio — é lógica dentro de
`LearningService.getMatchInformedRecommendation()`, consumida pelo Ask Coach e pela
Recomendação adaptativa. Ver [`match-analysis-integration.md`](match-analysis-integration.md).

## Mapa da documentação técnica

| Documento | Cobre |
|---|---|
| [`data-model.md`](data-model.md) | `Game`, `Player`/`PlayerCard` e domínio de importação (Tarefas 2–4) |
| [`player-build-engine.md`](player-build-engine.md) | Motor de build + comparador (Tarefas 5–6) |
| [`player-scanner.md`](player-scanner.md) | Identificação de carta por imagem (Tarefa 7) |
| [`user-players.md`](user-players.md) | Meu elenco (Tarefa 8) |
| [`squad-builder.md`](squad-builder.md) | Motor de escalação (Tarefa 9) |
| [`efootball-coach.md`](efootball-coach.md) | Coach de Elenco — narração por IA (Tarefa 10) |
| [`economy-advisor.md`](economy-advisor.md) | Avaliação de packs (Tarefa 11) |
| [`learning.md`](learning.md) | Academia CoachPlay (Tarefa 12) |
| [`onboarding.md`](onboarding.md) | Onboarding (Tarefa 13) |
| [`ask-coach.md`](ask-coach.md) | Intent Router + chat (Tarefa 14) |
| [`match-analysis-integration.md`](match-analysis-integration.md) | Recomendação informada por partidas reais (Tarefa 15) |
| [`progress.md`](progress.md) | Progresso agregado (Tarefa 16) |
| [`recommendations.md`](recommendations.md) | Recomendação adaptativa (Tarefa 17) |
| [`frontend.md`](frontend.md) | As 10 rotas de `apps/web` (Tarefa 18) |
| [`security-review.md`](security-review.md) | Auditoria de segurança transversal (Tarefa 19) |
| [`ai-cost-control.md`](ai-cost-control.md) | Custo por chamada de IA (Tarefa 20) |
| [`observability.md`](observability.md) | `AiCallLog` + painel admin (Tarefa 21) |
| [`e2e-testing.md`](e2e-testing.md) | `apps/api/test/`, criado do zero (Tarefa 22) |
| [`regression.md`](regression.md) | Validação do monorepo inteiro (Tarefa 23) |

## Modelo de dados — tabelas novas (Prisma)

```
Game, GameVersion, GameDataSource                          Tarefa 2
Player, PlayerCard, PlayerPosition, PlayerStat,
  PlayerSkill, PlayerPlayStyle                              Tarefa 3
DataImportRun, DataImportChange                             Tarefa 4
CardScan                                                    Tarefa 7
UserPlayer, UserPlayerBuild                                 Tarefa 8
Formation, FormationPosition, UserSquad, SquadPlayer        Tarefa 9
Pack, PackTargetPlayer, EconomyRecommendation               Tarefa 11
LearningPath, LearningModule, Lesson, Exercise,
  UserLessonProgress, UserLearningProfile                   Tarefa 12
  (UserLearningProfile.onboardingCompletedAt)                Tarefa 13
UserProgressSnapshot                                        Tarefa 16
LearningRecommendation                                      Tarefa 17
AiCallLog                                                    Tarefa 21
```

Nenhuma tabela do MVP original (EA FC) teve coluna alterada ou removida por este módulo. A única
mudança em `model User` foi aditiva — 3 campos de relação inversa (`progressSnapshots`,
`learningRecommendation`, `aiCallLogs`), exigidos pelo Prisma pra qualquer tabela nova com FK
pra `User`, sem impacto em nenhuma coluna real nem em nenhum outro módulo. `Match.playerTeam` é
de 2026-08-27 (CHANGELOG 0.51.0), anterior a este módulo e sem relação com ele.

## Limitações conhecidas — consolidado

Cada uma já está documentada em detalhe no arquivo correspondente; aqui é só o índice.

| Limitação | Onde está detalhada | Bloqueia o quê |
|---|---|---|
| Sem fonte real de dados de `Player`/`PlayerCard` (decisão de produto/legal em aberto) | `docs/efootball-architecture.md`, risco 1 | Telas de Player Scanner/Squad Builder ficam vazias sem popular fixture |
| `Pack` sem seed de dados | `frontend.md` | Economy Advisor mostra "nenhum pack disponível" em dev |
| Sem detecção real de posição de jogador/bola (mesmo gap do Tactical Engine) | `match-analysis-integration.md` | Correlação fina (ex. "zagueiro sai de posição") continua impossível — só agregação por categoria |
| Pipeline de vídeo (`game-analysis`) é 100% EA FC, nunca estendido pra eFootball | `docs/efootball-architecture.md`, risco 2 | Match Analysis do eFootball não existe — só empresta dado do pipeline EA FC |
| Sem cap de gasto de IA por usuário/plano | `ai-cost-control.md` | Só rate limit anti-abuso (Tarefa 19) — nunca um limite de dinheiro |
| `AiCallLog` sem política de retenção/expurgo | `observability.md` | Tabela cresce indefinidamente |
| Cobertura e2e limitada a 1 fluxo (Onboarding→Progresso→Recomendação) | `e2e-testing.md` | Squad Builder/Economy Advisor/Player Scanner/Ask Coach só com cobertura unitária |
| Nenhuma migration desta sessão validada contra Postgres real (sem Docker) | `regression.md` | Rodar `prisma migrate deploy` contra banco real antes de produção |
| Frontend enxuto, não polido (decisão combinada com o usuário na Tarefa 18) | `frontend.md` | Sem animações, sem responsividade além do grid básico |

## Próximos passos (fora do roadmap original de 24 tarefas)

Qualquer item abaixo é uma decisão de produto nova, não uma tarefa já planejada — mesmo
princípio de fechamento já usado pelo Tactical Engine (`docs/tactical-engine-domain.md`,
"Fases 1–7 completas... próximo passo é decisão de produto nova"):

- Decidir a fonte real de dados de jogadores/cartas (scraping autorizado, dataset comunitário,
  curadoria manual) — desbloqueia Player Scanner/Squad Builder/Economy Advisor com dado real
- Popular `Pack` com dados reais (ou decidir que Economy Advisor fica sem dado até então)
- Cap de gasto de IA por plano, integrando `AiCallLog` com `PlansService`
- Política de retenção pra `AiCallLog`
- Ampliar cobertura e2e pros outros fluxos do módulo
- Validar as 5 migrations desta sessão contra um Postgres real antes do primeiro deploy que as inclua

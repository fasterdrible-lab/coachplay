# Player Scanner (Tarefa 7)

> Identifica qual `PlayerCard` está numa screenshot enviada pelo usuário — sem nunca perguntar a
> uma IA generativa "qual carta é essa" (Princípio 1 do módulo eFootball).

## Fluxo

```
imagem (upload multipart, POST /player-scanner/scan)
  ↓ pré-processamento — preprocess-image.ts, via `sharp` (real)
  ↓   rejeita bytes corrompidos/não-imagem → status INVALID_IMAGE, nunca chama o extrator
  ↓ extração de texto — CardImageExtractor.extract() (interface, ver "Gap de infraestrutura")
  ↓ normalização — parse-extracted-text.ts (tokens de nome + palpite de overall 40-99)
  ↓ busca no banco — PlayerScannerService (Player.normalizedName contains, por token)
  ↓ candidatos — 1 por PlayerCard ativa do(s) jogador(es) encontrado(s)
  ↓ confidence score — scan-scoring.ts
```

## Confiança e decisão (`player-scanner.config.ts`, versionado)

```
confidence > 0.90        → AUTO_IDENTIFIED (matchedPlayerCardId preenchido)
0.60 <= confidence <= 0.90 → NEEDS_CONFIRMATION (candidatos retornados, sem match automático)
confidence < 0.60        → NEEDS_NEW_IMAGE
```

`confidence = extractionConfidence × melhorScoreDeCandidato × (ambíguo ? 0.8 : 1)`. Ambíguo =
2º melhor candidato fica a <= 5% do 1º (`AMBIGUITY_MARGIN`) — cobre exatamente os casos de
"jogador com várias versões"/"carta duplicada": sem um sinal que desempate (ex.: overall lido no
texto batendo com uma carta específica), o scanner nunca escolhe sozinho, sempre pede confirmação
com as cartas candidatas.

`scoreNameMatch` combina 3 sinais e usa o maior: similaridade de string inteira (Levenshtein
normalizado), a mesma similaridade só com os tokens que aparecem no candidato (ignora ruído tipo
rótulo "EPIC"/"STANDARD" capturado junto do nome), e um bônus de substring para nome
cortado/parcial. `scoreCard` ajusta por proximidade do overall extraído do texto.

## Gap de infraestrutura — nenhum OCR real integrado ainda

Mesmo princípio do `TacticalStateProvider` (tactical-engine) e do `EfootballDataSource`
(Tarefa 4): a leitura de pixels→texto fica atrás da interface `CardImageExtractor`. Hoje só
existem duas implementações: `FixtureCardImageExtractor` (só teste, resultado fixo simulando o
que um OCR real leria) e `NotConfiguredCardImageExtractor` (produção — lança
`ServiceUnavailableException` de forma explícita em vez de fingir funcionar). Escolher/validar um
motor de OCR real é decisão de infraestrutura em aberto — todo o resto do pipeline (validação de
imagem, normalização, matching, confiança) já é código real e testado, pronto para receber
qualquer OCR real através da mesma interface.

## Persistência

`CardScan` (1 linha por tentativa, mesmo com resultado ruim/inválido — base para
`scanner_success_rate` na Tarefa 21): `status`, `confidenceScore`, `matchedPlayerCardId?`,
`candidateCardIds` (top 5, Json), `rawExtraction` (texto bruto + confiança do OCR, Json — nunca
tratado como fato confirmado).

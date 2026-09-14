import { similarity } from './string-similarity.util';
import { ParsedCardText } from './parse-extracted-text';
import {
  AMBIGUITY_MARGIN,
  AMBIGUITY_PENALTY,
  AUTO_IDENTIFY_THRESHOLD,
  CONFIRM_THRESHOLD,
} from './player-scanner.config';

export type CardScanDecision = 'AUTO_IDENTIFIED' | 'NEEDS_CONFIRMATION' | 'NEEDS_NEW_IMAGE';

export interface ScoredCandidate {
  playerCardId: string;
  playerId: string;
  score: number;
}

/** Compara os tokens de nome extraídos com o nome normalizado de um jogador — combina
 * similaridade da string inteira (bom para nome legível) com um "bônus de substring" (bom para
 * nome cortado/parcialmente visível, onde a string inteira nunca vai bater bem). */
export function scoreNameMatch(nameTokens: string[], candidateNormalizedName: string): number {
  if (nameTokens.length === 0) return 0;

  const joined = nameTokens.join(' ');
  const fullScore = similarity(joined, candidateNormalizedName);

  // Texto extra ao redor do nome na carta (ex.: "EPIC", "STANDARD") não deve derrubar a
  // similaridade — tenta de novo só com os tokens que realmente aparecem no candidato, mais
  // tolerante a rótulo de raridade/tipo capturado junto do nome pelo OCR.
  const relevantTokens = nameTokens.filter((token) => candidateNormalizedName.includes(token));
  const filteredScore =
    relevantTokens.length > 0 ? similarity(relevantTokens.join(' '), candidateNormalizedName) : 0;

  const substringBonus = nameTokens.some(
    (token) => token.length >= 4 && candidateNormalizedName.includes(token),
  )
    ? 0.75
    : 0;

  return Math.max(fullScore, filteredScore, substringBonus);
}

/** Ajusta o score do nome com sinais específicos da carta (overall extraído do texto). */
export function scoreCard(
  nameScore: number,
  card: { overallBase: number },
  parsed: ParsedCardText,
): number {
  let score = nameScore;

  if (parsed.overallGuess !== undefined) {
    const diff = Math.abs(parsed.overallGuess - card.overallBase);
    if (diff === 0) score = Math.min(1, score + 0.1);
    else if (diff > 3) score = Math.max(0, score - 0.15);
  }

  return Math.max(0, Math.min(1, score));
}

/** Combina a confiança do motor de extração com o melhor candidato — nunca aceita alta confiança
 * quando o resultado é ambíguo entre 2+ candidatos próximos (ex.: mesma carta em versões
 * diferentes, sem sinal suficiente no texto pra desempatar). */
export function computeFinalConfidence(
  extractionConfidence: number,
  candidates: ScoredCandidate[],
): { confidence: number; ambiguous: boolean; top?: ScoredCandidate } {
  if (candidates.length === 0) return { confidence: 0, ambiguous: false };

  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const top = sorted[0];
  const second = sorted[1];
  const ambiguous = !!second && top.score - second.score <= AMBIGUITY_MARGIN;

  const raw = extractionConfidence * top.score * (ambiguous ? AMBIGUITY_PENALTY : 1);

  return { confidence: Math.max(0, Math.min(1, raw)), ambiguous, top };
}

/** Passo final de decisão — nunca identifica automaticamente abaixo do limiar (Tarefa 7:
 * "não aceitar identificação automática quando a confiança for baixa"). */
export function decideScanOutcome(confidence: number): CardScanDecision {
  if (confidence > AUTO_IDENTIFY_THRESHOLD) return 'AUTO_IDENTIFIED';
  if (confidence >= CONFIRM_THRESHOLD) return 'NEEDS_CONFIRMATION';
  return 'NEEDS_NEW_IMAGE';
}

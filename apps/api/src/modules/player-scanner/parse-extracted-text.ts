import { normalizePlayerName } from '../players/player-name.util';

export interface ParsedCardText {
  /** Tokens do nome candidato, normalizados (sem acento, minúsculo). */
  nameTokens: string[];
  /** Palpite de overall — número de 2 dígitos entre 40 e 99 encontrado no texto, se houver. */
  overallGuess?: number;
}

/** Passo "normalize" do scanner — limpa o texto bruto do OCR em tokens comparáveis contra
 * Player.normalizedName. Puro/determinístico, sem IA. */
export function parseExtractedText(rawText: string): ParsedCardText {
  const normalized = normalizePlayerName(rawText);
  const words = normalized.split(/[^a-z0-9]+/).filter(Boolean);

  const overallGuess = words
    .map((w) => Number(w))
    .find((n) => Number.isInteger(n) && n >= 40 && n <= 99);

  const nameTokens = words.filter((w) => Number.isNaN(Number(w)) && w.length >= 2);

  return { nameTokens, overallGuess };
}

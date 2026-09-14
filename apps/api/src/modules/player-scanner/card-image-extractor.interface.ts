export interface ExtractedCardText {
  /** Texto bruto lido da imagem — nunca tratado como identidade confirmada da carta. */
  rawText: string;
  /** 0..1 — confiança do próprio motor de extração na leitura (não é a confiança final do scan,
   * que também pondera o quanto o texto bate com o banco). */
  extractionConfidence: number;
}

/**
 * Única costura para um motor real de OCR (mesmo princípio do TacticalStateProvider no
 * tactical-engine e do EfootballDataSource no efootball-data-provider) — nenhum provedor real
 * foi escolhido/validado ainda (ver docs/efootball-architecture.md). O pipeline determinístico
 * de normalização/matching/confiança abaixo é 100% real e testado; só a leitura de pixels→texto
 * é um gap de infraestrutura em aberto, documentado explicitamente em vez de simulado.
 */
export interface CardImageExtractor {
  extract(image: Buffer): Promise<ExtractedCardText>;
}

export const CARD_IMAGE_EXTRACTOR = Symbol('CARD_IMAGE_EXTRACTOR');

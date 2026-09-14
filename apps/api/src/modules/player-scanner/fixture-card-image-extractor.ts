import { CardImageExtractor, ExtractedCardText } from './card-image-extractor.interface';

/** Extractor de teste — devolve um resultado fixo, simulando o que um OCR real leria de cada
 * fixture (legível, borrada, cortada, etc.). NUNCA usar fora de teste. */
export class FixtureCardImageExtractor implements CardImageExtractor {
  constructor(private readonly result: ExtractedCardText) {}

  async extract(): Promise<ExtractedCardText> {
    return this.result;
  }
}

import { ServiceUnavailableException } from '@nestjs/common';
import { CardImageExtractor, ExtractedCardText } from './card-image-extractor.interface';

/**
 * Implementação padrão em produção enquanto nenhum motor de OCR foi escolhido/validado — falha
 * de forma explícita e controlada em vez de fingir que funciona (mesmo espírito de
 * GEMINI_API_KEY ausente no GameAnalysisService, só que sem heurística sintética de fallback:
 * aqui NUNCA se inventa qual carta é, então não existe um "fallback" seguro possível).
 */
export class NotConfiguredCardImageExtractor implements CardImageExtractor {
  async extract(): Promise<ExtractedCardText> {
    throw new ServiceUnavailableException(
      'Nenhum motor de OCR configurado ainda para o Player Scanner',
    );
  }
}

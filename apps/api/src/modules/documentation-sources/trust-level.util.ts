import { DocumentationSourceType, DocumentationTrustLevel } from '@prisma/client';

/** Confiança padrão quando o admin não informa `trustLevel` explicitamente ao cadastrar a fonte —
 * mesma correspondência do prompt ("Para Konami: sourceType = OFFICIAL, trustLevel =
 * AUTHORITATIVE"), generalizada pros outros 3 tipos. */
export const DEFAULT_TRUST_LEVEL_BY_SOURCE_TYPE: Record<DocumentationSourceType, DocumentationTrustLevel> = {
  OFFICIAL: 'AUTHORITATIVE',
  VERIFIED_COMMUNITY: 'HIGH',
  COMMUNITY: 'MEDIUM',
  MANUAL: 'MEDIUM',
};

/**
 * Regra dura: só `sourceType: OFFICIAL` pode ter `trustLevel: AUTHORITATIVE`. Nunca corrige
 * silenciosamente (mesmo princípio de `pitch-zone.ts`/`player-build-engine.config.ts`) — lança
 * erro explícito pra quem chamou decidir como reagir (o service converte pra
 * `BadRequestException`).
 */
export function assertTrustLevelAllowed(sourceType: DocumentationSourceType, trustLevel: DocumentationTrustLevel): void {
  if (trustLevel === 'AUTHORITATIVE' && sourceType !== 'OFFICIAL') {
    throw new Error(
      `trustLevel AUTHORITATIVE é exclusivo de fontes OFFICIAL — "${sourceType}" nunca pode ser marcada automaticamente como autoritativa`,
    );
  }
}

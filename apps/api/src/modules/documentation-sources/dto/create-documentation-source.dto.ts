import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl, Matches, MaxLength } from 'class-validator';
import { DocumentationSourceType, DocumentationTrustLevel } from '@prisma/client';

export class CreateDocumentationSourceDto {
  @IsString()
  @IsNotEmpty()
  gameId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  // Validação de formato aqui; segurança (SSRF, domínio autorizado) é responsabilidade do
  // service (url-safety.util.ts + allowed-domains.util.ts) — class-validator não sabe resolver
  // "é um IP privado?" nem consultar a allowlist configurada.
  @IsUrl({ protocols: ['https'], require_protocol: true })
  url!: string;

  @IsEnum(DocumentationSourceType)
  sourceType!: DocumentationSourceType;

  @IsString()
  @Matches(/^[a-z]{2}(-[A-Z]{2})?$/, { message: 'language deve ser um código tipo "pt-BR" ou "en"' })
  language!: string;

  // Opcional — quando ausente, o service aplica o default por sourceType
  // (DEFAULT_TRUST_LEVEL_BY_SOURCE_TYPE). Quando informado, ainda passa por
  // assertTrustLevelAllowed (nunca aceita AUTHORITATIVE fora de sourceType OFFICIAL).
  @IsOptional()
  @IsEnum(DocumentationTrustLevel)
  trustLevel?: DocumentationTrustLevel;
}

import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DocumentationTrustLevel } from '@prisma/client';

/** Só os campos que fazem sentido editar depois de criada — `url`/`gameId`/`sourceType` são
 * estruturais (se estiverem errados, a fonte deve ser recriada, não editada). */
export class UpdateDocumentationSourceDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsEnum(DocumentationTrustLevel)
  trustLevel?: DocumentationTrustLevel;
}

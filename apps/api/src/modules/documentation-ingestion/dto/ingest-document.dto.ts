import { IsEnum, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUrl, Matches, MaxLength } from 'class-validator';
import { GameDocumentType } from '@prisma/client';

/**
 * Dispara o pipeline fetch→sanitize→normalize→hash→compare→store (Tarefa 4) para uma URL.
 * Diferente de `RegisterGameDocumentDto` (Tarefa 3), nunca recebe `rawContent`/`normalizedContent`
 * do chamador — ambos são produzidos aqui a partir do HTML baixado de `url`.
 */
export class IngestDocumentDto {
  @IsString()
  @IsNotEmpty()
  gameId!: string;

  @IsString()
  @IsNotEmpty()
  sourceId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string;

  @IsUrl({ protocols: ['https'], require_protocol: true })
  url!: string;

  @IsEnum(GameDocumentType)
  documentType!: GameDocumentType;

  @IsString()
  @Matches(/^[a-z]{2}(-[A-Z]{2})?$/, { message: 'language deve ser um código tipo "pt-BR" ou "en"' })
  language!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  gameVersion?: string;

  @IsOptional()
  @IsISO8601()
  publishedAt?: string;
}

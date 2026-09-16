import { IsEnum, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUrl, Matches, MaxLength } from 'class-validator';
import { GameDocumentType } from '@prisma/client';

/**
 * Registra (cria ou atualiza, por `gameId`+`url`) o estado ATUAL de um documento — Tarefa 3.
 * `rawContent`/`normalizedContent` ainda são fornecidos pelo chamador aqui (sanitização/
 * normalização de verdade é a Tarefa 4, o coletor); `contentHash` nunca vem do cliente — é
 * sempre derivado de `normalizedContent` pelo service.
 */
export class RegisterGameDocumentDto {
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

  @IsString()
  @IsNotEmpty()
  rawContent!: string;

  @IsString()
  @IsNotEmpty()
  normalizedContent!: string;
}

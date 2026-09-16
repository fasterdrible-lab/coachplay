import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { GameDocumentType } from '@prisma/client';

export class FindGameDocumentsQueryDto {
  @IsString()
  @IsNotEmpty()
  gameId!: string;

  @IsOptional()
  @IsEnum(GameDocumentType)
  documentType?: GameDocumentType;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeInactive?: boolean;
}

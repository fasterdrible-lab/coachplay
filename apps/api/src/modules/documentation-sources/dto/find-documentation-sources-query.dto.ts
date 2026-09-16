import { Type } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class FindDocumentationSourcesQueryDto {
  @IsString()
  @IsNotEmpty()
  gameId!: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeInactive?: boolean;
}

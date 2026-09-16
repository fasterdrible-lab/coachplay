import { IsBoolean, IsOptional } from 'class-validator';

/** Só `active` — os demais campos mudam através de `registerDocument()` (re-registro pelo
 * coletor), nunca por edição manual direta. */
export class UpdateGameDocumentDto {
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

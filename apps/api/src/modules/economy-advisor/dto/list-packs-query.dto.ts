import { IsNotEmpty, IsString } from 'class-validator';

/** Tarefa 19 (segurança) — antes `@Query('gameId') gameId: string` sem validação: omitir o
 * parâmetro fazia o Prisma ignorar o filtro (`gameId: undefined`) e devolver packs de TODOS os
 * jogos em vez de rejeitar a requisição. Mesmo achado de `squad-builder/dto/game-id-query.dto.ts`. */
export class ListPacksQueryDto {
  @IsString()
  @IsNotEmpty()
  gameId!: string;
}

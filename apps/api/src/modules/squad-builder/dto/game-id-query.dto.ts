import { IsNotEmpty, IsString } from 'class-validator';

/** Tarefa 19 (segurança) — antes `@Query('gameId') gameId: string` sem validação: omitir o
 * parâmetro fazia o Prisma ignorar o filtro (`gameId: undefined`) e devolver dados de TODOS os
 * jogos em vez de rejeitar a requisição. Sem impacto real hoje (só existe 1 jogo), mas vira
 * vazamento de dados entre jogos assim que um segundo `Game` existir. */
export class GameIdQueryDto {
  @IsString()
  @IsNotEmpty()
  gameId!: string;
}

import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { BUILD_STRATEGIES, BuildStrategy } from '../../player-build-engine/player-build-engine.config';

/**
 * Corpo do Ask Coach (Tarefa 14). `question` é sempre texto livre — o Intent Router decide qual
 * motor chamar (`intent-router.ts`, sem IA na classificação). Os demais campos são "slots"
 * OPCIONAIS que o frontend já pode preencher quando a pergunta parte de uma tela específica (ex.:
 * usuário pergunta "vale a pena?" na tela de um pack já aberto) — nunca inferidos a partir do
 * texto da pergunta em si (evita a IA "adivinhar" um id ou uma quantidade de moedas).
 */
export class AskCoachDto {
  // Tarefa 19 (segurança): limite defensivo — a pergunta vai direto pro prompt de IA em 2 das 5
  // intents (BUILD_RECOMMENDATION/SQUAD_ADVICE), sem cap nenhum antes disso.
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  question!: string;

  @IsOptional()
  @IsString()
  userSquadId?: string;

  @IsOptional()
  @IsString()
  packId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  userCoins?: number;

  @IsOptional()
  @IsString()
  playerCardId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  level?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  availableProgressionPoints?: number;

  @IsOptional()
  @IsIn(BUILD_STRATEGIES)
  strategy?: BuildStrategy;
}

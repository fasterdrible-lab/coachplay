import { PlayerCard } from '@prisma/client';
import { RawPlayerCardRecord } from './raw-player-record.type';

export type CardChangeType = 'created' | 'updated' | 'unchanged';

/** Compara a carta já persistida com o registro recebido — só os campos que definem a versão
 * "oficial" da carta contam como alteração (ver docs/efootball-architecture.md, Tarefa 4). */
export function diffCard(
  existing: Pick<PlayerCard, 'cardType' | 'version' | 'overallBase' | 'maxLevel' | 'position'> | null,
  incoming: RawPlayerCardRecord,
): CardChangeType {
  if (!existing) return 'created';

  const changed =
    existing.cardType !== incoming.cardType ||
    existing.version !== incoming.version ||
    existing.overallBase !== incoming.overallBase ||
    existing.maxLevel !== incoming.maxLevel ||
    existing.position !== incoming.position;

  return changed ? 'updated' : 'unchanged';
}

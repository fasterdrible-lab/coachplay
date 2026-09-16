import { createHash } from 'crypto';

/**
 * Hash estável do conteúdo NORMALIZADO de um documento (nunca do `rawContent`) — decide se um
 * re-registro no mesmo `url` (Tarefa 3) é "documento duplicado" (hash igual) ou "conteúdo
 * alterado" (hash diferente). Mesma técnica de `efootball-data-provider/checksum.util.ts`
 * (Tarefa 4 do módulo eFootball de 24 tarefas — `createHash('sha256')`), duplicada aqui em vez
 * de compartilhada: aquela função é tipada especificamente pra lote de registros de jogador
 * (`NormalizedPlayerRecord[]`), não texto de documento — generalizar a assinatura arriscaria o
 * pipeline já testado; reescrever 2 linhas é mais seguro.
 */
export function computeContentHash(normalizedContent: string): string {
  return createHash('sha256').update(normalizedContent).digest('hex');
}

/**
 * Normaliza um nome para busca: minúsculas + sem acentos/diacríticos.
 * "Khvicha Kvaratskhelia" → "khvicha kvaratskhelia" (permite achar "Kvara" por substring,
 * sem depender de IA — ver docs/efootball-architecture.md, Tarefa 3).
 */
export function normalizePlayerName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

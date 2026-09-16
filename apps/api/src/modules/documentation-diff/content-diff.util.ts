export type DiffChangeType = 'TEXT_ADDED' | 'TEXT_REMOVED' | 'TEXT_MODIFIED' | 'SECTION_ADDED' | 'SECTION_REMOVED';

export interface DetectedChange {
  changeType: DiffChangeType;
  changeSummary: string;
}

interface DiffOp {
  type: 'equal' | 'remove' | 'add';
  value: string;
}

/** Um par de linhas com esse grau de sobreposição de palavras (ou mais) é tratado como "a mesma
 * seção, texto alterado" em vez de "seção removida" + "seção nova" sem relação. */
const SECTION_SIMILARITY_THRESHOLD = 0.4;
const SUMMARY_MAX_LENGTH = 160;

function splitIntoLines(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitIntoWords(line: string): string[] {
  return line.toLowerCase().split(/\s+/).filter(Boolean);
}

function truncate(text: string): string {
  return text.length > SUMMARY_MAX_LENGTH ? `${text.slice(0, SUMMARY_MAX_LENGTH)}…` : text;
}

/** Diff clássico por LCS (subsequência comum mais longa) — mesma função serve pra linhas
 * (nível de seção) e pra palavras dentro de uma linha (nível de texto). */
function computeLcsDiff(oldItems: string[], newItems: string[]): DiffOp[] {
  const n = oldItems.length;
  const m = newItems.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = oldItems[i] === newItems[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldItems[i] === newItems[j]) {
      ops.push({ type: 'equal', value: oldItems[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: 'remove', value: oldItems[i] });
      i++;
    } else {
      ops.push({ type: 'add', value: newItems[j] });
      j++;
    }
  }
  while (i < n) {
    ops.push({ type: 'remove', value: oldItems[i] });
    i++;
  }
  while (j < m) {
    ops.push({ type: 'add', value: newItems[j] });
    j++;
  }
  return ops;
}

function wordSimilarity(a: string, b: string): number {
  const wordsA = new Set(splitIntoWords(a));
  const wordsB = new Set(splitIntoWords(b));
  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  const union = new Set([...wordsA, ...wordsB]);
  if (union.size === 0) return 0;
  let intersectionSize = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersectionSize++;
  }
  return intersectionSize / union.size;
}

/** Duas linhas "parecidas o bastante pra serem a mesma seção" — diff de palavras dentro delas
 * decide se foi só adição, só remoção, ou substituição de palavra(s) (ex.: "5"→"6"). */
function classifyLineChange(oldLine: string, newLine: string): DetectedChange {
  const wordOps = computeLcsDiff(splitIntoWords(oldLine), splitIntoWords(newLine));
  const hasRemoved = wordOps.some((op) => op.type === 'remove');
  const hasAdded = wordOps.some((op) => op.type === 'add');

  if (hasAdded && !hasRemoved) {
    const addedWords = wordOps
      .filter((op) => op.type === 'add')
      .map((op) => op.value)
      .join(' ');
    return {
      changeType: 'TEXT_ADDED',
      changeSummary: truncate(`Texto adicionado: "${addedWords}" (em "${newLine}")`),
    };
  }

  if (hasRemoved && !hasAdded) {
    const removedWords = wordOps
      .filter((op) => op.type === 'remove')
      .map((op) => op.value)
      .join(' ');
    return {
      changeType: 'TEXT_REMOVED',
      changeSummary: truncate(`Texto removido: "${removedWords}" (de "${oldLine}")`),
    };
  }

  return {
    changeType: 'TEXT_MODIFIED',
    changeSummary: truncate(`Texto alterado: "${oldLine}" → "${newLine}"`),
  };
}

/**
 * Compara o conteúdo normalizado de duas versões de um `GameDocument` (Tarefa 5) e detecta,
 * linha a linha (cada linha = 1 seção, ver `html-sanitizer.util.ts`), texto adicionado, texto
 * removido, texto alterado, seção nova e seção removida. Puro — sem I/O, só recebe as duas
 * strings de conteúdo já carregadas.
 */
export function diffDocumentContent(oldContent: string, newContent: string): DetectedChange[] {
  const oldLines = splitIntoLines(oldContent);
  const newLines = splitIntoLines(newContent);
  const ops = computeLcsDiff(oldLines, newLines);

  const changes: DetectedChange[] = [];
  let i = 0;
  while (i < ops.length) {
    if (ops[i].type === 'equal') {
      i++;
      continue;
    }

    const removeRun: string[] = [];
    while (i < ops.length && ops[i].type === 'remove') {
      removeRun.push(ops[i].value);
      i++;
    }
    const addRun: string[] = [];
    while (i < ops.length && ops[i].type === 'add') {
      addRun.push(ops[i].value);
      i++;
    }

    const pairCount = Math.min(removeRun.length, addRun.length);
    for (let k = 0; k < pairCount; k++) {
      const oldLine = removeRun[k];
      const newLine = addRun[k];
      if (wordSimilarity(oldLine, newLine) >= SECTION_SIMILARITY_THRESHOLD) {
        changes.push(classifyLineChange(oldLine, newLine));
      } else {
        changes.push({ changeType: 'SECTION_REMOVED', changeSummary: truncate(`Seção removida: "${oldLine}"`) });
        changes.push({ changeType: 'SECTION_ADDED', changeSummary: truncate(`Nova seção: "${newLine}"`) });
      }
    }
    for (let k = pairCount; k < removeRun.length; k++) {
      changes.push({ changeType: 'SECTION_REMOVED', changeSummary: truncate(`Seção removida: "${removeRun[k]}"`) });
    }
    for (let k = pairCount; k < addRun.length; k++) {
      changes.push({ changeType: 'SECTION_ADDED', changeSummary: truncate(`Nova seção: "${addRun[k]}"`) });
    }
  }

  return changes;
}

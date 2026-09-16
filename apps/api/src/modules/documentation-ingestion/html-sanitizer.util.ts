import * as sanitizeHtml from 'sanitize-html';

/**
 * `rawContent` é armazenado para auditoria/diff (Tarefa 6) e pode um dia ser exibido em algum
 * painel — nunca confiamos em HTML de um domínio externo (mesmo allowlisted) sem passar por um
 * parser HTML de verdade. Regex não é um sanitizador de HTML seguro, por isso a dependência.
 */
export function sanitizeRawHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'img']),
    allowedAttributes: {
      a: ['href'],
      img: ['src', 'alt'],
    },
    allowedSchemes: ['https'],
    disallowedTagsMode: 'discard',
  });
}

// Sem isso, sanitizeHtml({ allowedTags: [] }) concatena o texto de elementos de bloco adjacentes
// sem nenhum separador — "<p>A</p><p>B</p>" vira "AB", não "A\nB". Cada linha resultante de
// normalizedContent é o que a Tarefa 6 (DocumentationDiffService) trata como uma unidade de
// "seção" pra detectar seção nova/removida — sem quebra de linha por bloco, esse detector nunca
// teria uma fronteira de seção pra encontrar em conteúdo real.
const BLOCK_BREAK_TAGS = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'tr', 'blockquote', 'section', 'article'];

/**
 * `normalizedContent` é texto puro — usado para o hash de comparação (Tarefa 3), pro detector de
 * alterações (Tarefa 6) e, mais adiante, pra extração de regras (Tarefa 7). Nunca deve conter
 * marcação. Cada elemento de bloco (parágrafo, título, item de lista...) vira exatamente uma
 * linha no resultado.
 */
export function htmlToPlainText(sanitizedHtml: string): string {
  let withBreaks = sanitizedHtml.replace(/<br\s*\/?>/gi, '\n');
  for (const tag of BLOCK_BREAK_TAGS) {
    withBreaks = withBreaks.replace(new RegExp(`</${tag}\\s*>`, 'gi'), `</${tag}>\n`);
  }

  const withoutTags = sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} });
  return withoutTags
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n')
    .trim();
}

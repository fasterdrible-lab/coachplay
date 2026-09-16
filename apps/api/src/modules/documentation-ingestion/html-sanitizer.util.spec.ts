import { sanitizeRawHtml, htmlToPlainText } from './html-sanitizer.util';

describe('html-sanitizer.util (Tarefa 4)', () => {
  describe('sanitizeRawHtml', () => {
    it('remove tags <script> e seu conteúdo', () => {
      const result = sanitizeRawHtml('<p>Olá</p><script>alert(1)</script>');

      expect(result).not.toContain('script');
      expect(result).not.toContain('alert');
      expect(result).toContain('Olá');
    });

    it('remove tags <style> e seu conteúdo', () => {
      const result = sanitizeRawHtml('<style>body{display:none}</style><p>Texto</p>');

      expect(result).not.toContain('style');
      expect(result).toContain('Texto');
    });

    it('remove atributos de evento inline (onclick, onerror etc.)', () => {
      const result = sanitizeRawHtml('<img src="https://ex.com/a.png" onerror="alert(1)">');

      expect(result).not.toContain('onerror');
      expect(result).not.toContain('alert');
    });

    it('remove esquemas perigosos em href (javascript:)', () => {
      const result = sanitizeRawHtml('<a href="javascript:alert(1)">clique</a>');

      expect(result).not.toContain('javascript:');
    });

    it('preserva conteúdo textual e tags básicas permitidas', () => {
      const result = sanitizeRawHtml('<h1>Controles</h1><p>Segure <b>R2</b> para passe de calcanhar</p>');

      expect(result).toContain('Controles');
      expect(result).toContain('Segure');
      expect(result).toContain('R2');
    });

    it('HTML vazio produz string vazia', () => {
      expect(sanitizeRawHtml('')).toBe('');
    });

    it('HTML inválido/malformado não lança exceção', () => {
      expect(() => sanitizeRawHtml('<p>texto sem fechar<div><span>')).not.toThrow();
    });
  });

  describe('htmlToPlainText', () => {
    it('remove todas as tags e retorna texto puro', () => {
      const result = htmlToPlainText('<h1>Controles</h1><p>Segure R2</p>');

      expect(result).not.toContain('<');
      expect(result).toContain('Controles');
      expect(result).toContain('Segure R2');
    });

    it('cada elemento de bloco vira uma linha separada (base pro detector de seção da Tarefa 6)', () => {
      const result = htmlToPlainText('<h1>Habilidades</h1><p>Você pode ter 5 habilidades.</p><p>Segure R2 para passe.</p>');

      expect(result.split('\n')).toEqual(['Habilidades', 'Você pode ter 5 habilidades.', 'Segure R2 para passe.']);
    });

    it('<br> também quebra linha', () => {
      const result = htmlToPlainText('<p>Linha 1<br>Linha 2</p>');

      expect(result.split('\n')).toEqual(['Linha 1', 'Linha 2']);
    });

    it('colapsa espaços internos redundantes', () => {
      const result = htmlToPlainText('<p>muito     espaço</p>');

      expect(result).toBe('muito espaço');
    });

    it('HTML vazio produz texto vazio', () => {
      expect(htmlToPlainText('')).toBe('');
    });

    it('HTML só com tags (sem texto) produz texto vazio', () => {
      expect(htmlToPlainText('<div><span></span></div>')).toBe('');
    });
  });
});

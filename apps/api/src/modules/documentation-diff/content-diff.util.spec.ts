import { diffDocumentContent } from './content-diff.util';

describe('diffDocumentContent (Tarefa 6 — DocumentationDiffService)', () => {
  it('fixture: nenhuma alteração — conteúdo idêntico não gera nenhuma mudança', () => {
    const content = 'Controles básicos\nSegure R2 para passe de calcanhar\nSegure L1 para sprint';

    const changes = diffDocumentContent(content, content);

    expect(changes).toEqual([]);
  });

  it('fixture: uma frase alterada — detecta TEXT_MODIFIED', () => {
    const oldContent = 'Controles básicos\nSegure R2 para passe de calcanhar\nSegure L1 para sprint';
    const newContent = 'Controles básicos\nSegure R2 para passe elevado\nSegure L1 para sprint';

    const changes = diffDocumentContent(oldContent, newContent);

    expect(changes).toHaveLength(1);
    expect(changes[0].changeType).toBe('TEXT_MODIFIED');
    expect(changes[0].changeSummary).toContain('passe de calcanhar');
    expect(changes[0].changeSummary).toContain('passe elevado');
  });

  it('fixture: uma seção removida — detecta SECTION_REMOVED', () => {
    const oldContent = 'Controles básicos\nSegure R2 para passe de calcanhar\nSegure L1 para sprint';
    const newContent = 'Controles básicos\nSegure L1 para sprint';

    const changes = diffDocumentContent(oldContent, newContent);

    expect(changes).toHaveLength(1);
    expect(changes[0].changeType).toBe('SECTION_REMOVED');
    expect(changes[0].changeSummary).toContain('passe de calcanhar');
  });

  it('fixture: nova regra — detecta SECTION_ADDED', () => {
    const oldContent = 'Controles básicos\nSegure L1 para sprint';
    const newContent = 'Controles básicos\nSegure L1 para sprint\nSegure R1 para finta';

    const changes = diffDocumentContent(oldContent, newContent);

    expect(changes).toHaveLength(1);
    expect(changes[0].changeType).toBe('SECTION_ADDED');
    expect(changes[0].changeSummary).toContain('finta');
  });

  it('fixture: mudança de número — "5 habilidades" para "6 habilidades" deve ser detectada', () => {
    const oldContent = 'Progressão de jogador\nVocê pode equipar até 5 habilidades adicionais\nBoa sorte';
    const newContent = 'Progressão de jogador\nVocê pode equipar até 6 habilidades adicionais\nBoa sorte';

    const changes = diffDocumentContent(oldContent, newContent);

    expect(changes).toHaveLength(1);
    expect(changes[0].changeType).toBe('TEXT_MODIFIED');
    expect(changes[0].changeSummary).toContain('5 habilidades');
    expect(changes[0].changeSummary).toContain('6 habilidades');
  });

  it('texto adicionado dentro de uma linha similar: TEXT_ADDED', () => {
    const oldContent = 'Segure R2 para passe';
    const newContent = 'Segure R2 para passe rasteiro rápido';

    const changes = diffDocumentContent(oldContent, newContent);

    expect(changes).toHaveLength(1);
    expect(changes[0].changeType).toBe('TEXT_ADDED');
    expect(changes[0].changeSummary).toContain('rasteiro');
  });

  it('texto removido dentro de uma linha similar: TEXT_REMOVED', () => {
    const oldContent = 'Segure R2 para passe rasteiro rápido';
    const newContent = 'Segure R2 para passe';

    const changes = diffDocumentContent(oldContent, newContent);

    expect(changes).toHaveLength(1);
    expect(changes[0].changeType).toBe('TEXT_REMOVED');
    expect(changes[0].changeSummary).toContain('rasteiro');
  });

  it('duas seções completamente sem relação (baixa similaridade): SECTION_REMOVED + SECTION_ADDED, não TEXT_MODIFIED', () => {
    const oldContent = 'Introdução\nSegure R2 para passe de calcanhar';
    const newContent = 'Introdução\nA Academia CoachPlay tem cinco trilhas de aprendizado';

    const changes = diffDocumentContent(oldContent, newContent);

    expect(changes).toHaveLength(2);
    expect(changes.map((c) => c.changeType).sort()).toEqual(['SECTION_ADDED', 'SECTION_REMOVED']);
  });

  it('múltiplas alterações no mesmo documento são todas detectadas', () => {
    const oldContent = 'Controles\nSegure R2 para passe de calcanhar\nSegure L1 para sprint\nSeção obsoleta a remover';
    const newContent = 'Controles\nSegure R2 para passe elevado\nSegure L1 para sprint\nNova seção sobre finalização';

    const changes = diffDocumentContent(oldContent, newContent);

    expect(changes.length).toBeGreaterThanOrEqual(2);
    const types = changes.map((c) => c.changeType);
    expect(types).toContain('TEXT_MODIFIED');
  });

  it('conteúdo vazio de ambos os lados: nenhuma mudança', () => {
    expect(diffDocumentContent('', '')).toEqual([]);
  });

  it('documento inteiramente novo (era vazio): tudo SECTION_ADDED', () => {
    const changes = diffDocumentContent('', 'Título\nPrimeira linha de conteúdo');

    expect(changes).toHaveLength(2);
    expect(changes.every((c) => c.changeType === 'SECTION_ADDED')).toBe(true);
  });
});

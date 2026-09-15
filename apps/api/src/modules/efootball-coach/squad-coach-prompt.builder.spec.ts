import { buildSquadCoachPrompt } from './squad-coach-prompt.builder';
import { SquadCoachContext } from './squad-coach.types';

const context: SquadCoachContext = {
  formationCode: '4-3-3',
  startingXI: [
    { slot: 'CF', position: 'CF', playerName: 'Khvicha Kvaratskhelia', overallBase: 89 },
    { slot: 'LB', position: 'LB', playerName: 'João Silva', overallBase: 76 },
  ],
  weakPositions: [{ slot: 'RB', position: 'RB', reason: 'EMPTY' }],
  rosterCompositionByGroup: { CF: 6, FB: 1 },
};

describe('buildSquadCoachPrompt', () => {
  it('inclui a formação correta no prompt', () => {
    expect(buildSquadCoachPrompt(context)).toContain('4-3-3');
  });

  it('inclui o jogador correto (nome + posição + slot) no prompt', () => {
    const prompt = buildSquadCoachPrompt(context);

    expect(prompt).toContain('Khvicha Kvaratskhelia');
    expect(prompt).toContain('CF (CF)');
    expect(prompt).toContain('João Silva');
  });

  it('inclui a posição fraca identificada pelo motor', () => {
    expect(buildSquadCoachPrompt(context)).toContain('RB (RB): vaga sem nenhum jogador compatível');
  });

  it('inclui a composição do elenco por grupo posicional', () => {
    const prompt = buildSquadCoachPrompt(context);

    expect(prompt).toContain('CF: 6');
    expect(prompt).toContain('FB: 1');
  });

  it('instrui explicitamente a IA a nunca inventar além do contexto fornecido', () => {
    const prompt = buildSquadCoachPrompt(context);

    expect(prompt).toMatch(/nunca invente|nunca escolhe jogador nem recalcula/i);
  });

  it('não menciona nenhum jogador que não está no contexto (nenhuma informação inventada)', () => {
    const prompt = buildSquadCoachPrompt(context);

    expect(prompt).not.toContain('Lionel Messi');
    expect(prompt).not.toContain('Cristiano Ronaldo');
  });

  it('lida com elenco sem posições fracas', () => {
    const prompt = buildSquadCoachPrompt({ ...context, weakPositions: [] });

    expect(prompt).toContain('Nenhuma posição fraca');
  });
});

import { resolvePositionGroup } from './player-build-engine.config';

describe('resolvePositionGroup', () => {
  it.each([
    ['GK', 'GK'],
    ['CB', 'CB'],
    ['LB', 'FB'],
    ['RB', 'FB'],
    ['DMF', 'DM'],
    ['CMF', 'CM'],
    ['AMF', 'CM'],
    ['LWF', 'WF'],
    ['RWF', 'WF'],
    ['CF', 'CF'],
    ['SS', 'CF'],
    ['lwf', 'WF'], // case-insensitive
  ])('mapeia "%s" para o grupo %s', (position, expected) => {
    expect(resolvePositionGroup(position)).toBe(expected);
  });

  it('lança erro explícito para posição desconhecida em vez de corrigir silenciosamente', () => {
    expect(() => resolvePositionGroup('XX')).toThrow();
  });
});

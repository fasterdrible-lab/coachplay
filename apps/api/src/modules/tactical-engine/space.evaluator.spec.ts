import { VirtualPlayer } from './tactical-game-state.type';
import { evaluateSpace } from './space.evaluator';
import { PitchChannel, PitchThird } from './pitch-zone';

function player(trackingId: string, team: 'user' | 'opponent', x: number, y: number): VirtualPlayer {
  return { trackingId, team, position: { x, y }, confidence: 0.9 };
}

describe('evaluateSpace', () => {
  it('retorna as 15 zonas do campo', () => {
    const regions = evaluateSpace([], []);
    expect(regions).toHaveLength(15);
  });

  it('campo vazio: toda zona tem espaço livre máximo', () => {
    const regions = evaluateSpace([], []);
    expect(regions.every((r) => r.freeSpace === 100)).toBe(true);
    expect(regions.every((r) => r.occupation === 0 && r.pressure === 0)).toBe(true);
  });

  it('zona lotada de adversários tem pressão alta e espaço livre baixo', () => {
    const crowdedZone = [
      player('o1', 'opponent', 0.5, 0.5),
      player('o2', 'opponent', 0.51, 0.5),
      player('o3', 'opponent', 0.5, 0.51),
    ];

    const regions = evaluateSpace([], crowdedZone);
    const central = regions.find(
      (r) => r.zone.third === PitchThird.MIDDLE_THIRD && r.zone.channel === PitchChannel.CENTRAL_CHANNEL,
    )!;
    const empty = regions.find(
      (r) => r.zone.third === PitchThird.DEFENSIVE_THIRD && r.zone.channel === PitchChannel.LEFT_CHANNEL,
    )!;

    expect(central.pressure).toBe(100);
    expect(central.freeSpace).toBeLessThan(empty.freeSpace);
  });

  it('goalProximity cresce do terço defensivo para o ofensivo', () => {
    const regions = evaluateSpace([], []);
    const defensive = regions.find((r) => r.zone.third === PitchThird.DEFENSIVE_THIRD)!;
    const middle = regions.find((r) => r.zone.third === PitchThird.MIDDLE_THIRD)!;
    const attacking = regions.find((r) => r.zone.third === PitchThird.ATTACKING_THIRD)!;

    expect(defensive.goalProximity).toBeLessThan(middle.goalProximity);
    expect(middle.goalProximity).toBeLessThan(attacking.goalProximity);
  });

  it('ordena por valor estratégico decrescente (espaço livre + proximidade ao gol)', () => {
    const regions = evaluateSpace([], []);
    // Com o campo vazio, freeSpace é igual em toda zona — a ordem passa a ser só por
    // goalProximity: terço ofensivo primeiro, defensivo por último.
    expect(regions[0].zone.third).toBe(PitchThird.ATTACKING_THIRD);
    expect(regions[regions.length - 1].zone.third).toBe(PitchThird.DEFENSIVE_THIRD);
  });
});

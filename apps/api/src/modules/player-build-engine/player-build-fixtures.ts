import { STAT_KEYS } from './player-build-engine.config';
import { PlayerBuildCardStat } from './player-build.types';

/** Fixture SINTÉTICA só para testes do Player Build Engine — nunca dado real de carta. */
export function buildFixtureStats(
  overrides: Partial<Record<string, { baseValue: number; maxValue: number }>> = {},
): PlayerBuildCardStat[] {
  return STAT_KEYS.map((key) => ({
    statKey: key,
    baseValue: overrides[key]?.baseValue ?? 60,
    maxValue: overrides[key]?.maxValue ?? 99,
  }));
}

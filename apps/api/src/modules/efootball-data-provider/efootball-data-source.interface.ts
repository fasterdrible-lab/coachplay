import { RawPlayerRecord } from './raw-player-record.type';

/**
 * Única costura para uma fonte real de dados (mesmo princípio do TacticalStateProvider no
 * tactical-engine) — hoje só existe FixtureEfootballDataSource (teste). Nenhuma fonte real foi
 * aprovada ainda (docs/efootball-architecture.md, risco 1).
 */
export interface EfootballDataSource {
  fetch(): Promise<RawPlayerRecord[]>;
}

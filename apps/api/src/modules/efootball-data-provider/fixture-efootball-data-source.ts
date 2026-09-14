import { EfootballDataSource } from './efootball-data-source.interface';
import { RawPlayerRecord } from './raw-player-record.type';
import { buildFixturePlayers } from './efootball-fixtures';

/** Implementação de teste do passo "fetch" — nunca usar em produção. */
export class FixtureEfootballDataSource implements EfootballDataSource {
  constructor(private readonly records: RawPlayerRecord[] = buildFixturePlayers(100)) {}

  async fetch(): Promise<RawPlayerRecord[]> {
    return this.records;
  }
}

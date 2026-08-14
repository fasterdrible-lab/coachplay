import { ConfigService } from '@nestjs/config';
import { TacticalEngineFeatureFlagService } from './tactical-engine-feature-flag.service';

describe('TacticalEngineFeatureFlagService', () => {
  function buildService(envValue: string | undefined): TacticalEngineFeatureFlagService {
    const config = {
      get: jest.fn((_key: string, fallback: string) => envValue ?? fallback),
    } as unknown as ConfigService;

    return new TacticalEngineFeatureFlagService(config);
  }

  it('desabilitado por padrão quando a variável de ambiente não está definida', () => {
    expect(buildService(undefined).isEnabled()).toBe(false);
  });

  it('habilitado só com o valor exato "true"', () => {
    expect(buildService('true').isEnabled()).toBe(true);
  });

  it('qualquer outro valor (inclusive "1", "TRUE", "yes") é tratado como desabilitado', () => {
    expect(buildService('1').isEnabled()).toBe(false);
    expect(buildService('TRUE').isEnabled()).toBe(false);
    expect(buildService('yes').isEnabled()).toBe(false);
  });
});

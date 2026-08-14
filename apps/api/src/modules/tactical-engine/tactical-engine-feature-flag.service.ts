import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Ver TASKS.md (Fase 7, Tarefa 35) e docs/tactical-engine-current-state.md, seção 6 — o
// projeto não tinha nenhum mecanismo de feature flag antes desta tarefa; `ConfigService` já é
// usado em todo o resto do projeto (ver settings.service.ts), sem lib nova.
//
// Default `false` deliberado: nenhuma fase do motor foi validada contra dados reais ainda (só
// fixtures — ver docs/tactical-engine-current-state.md, achado da auditoria), então habilitar
// por padrão em produção arriscaria expor comportamento nunca testado fora de testes
// automatizados. Setar `TACTICAL_ENGINE_ENABLED=true` é uma decisão explícita de operação.
@Injectable()
export class TacticalEngineFeatureFlagService {
  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return this.config.get<string>('TACTICAL_ENGINE_ENABLED', 'false') === 'true';
  }
}

# Cadastro de fontes de documentação — `documentation-sources` (Tarefa 2)

> Primeiro módulo da Base Oficial de Documentação do eFootball (prompt separado do módulo
> eFootball de 24 tarefas — ver `docs/efootball/documentation-architecture.md`). Só CRUD de
> `DocumentationSource` — nenhuma coleta de verdade acontece aqui, isso é a Tarefa 4
> (`documentation-ingestion`).

## Endpoints

```
POST   /documentation-sources                          @Roles('admin')
GET    /documentation-sources?gameId=&includeInactive=  @Roles('admin')
GET    /documentation-sources/:id                       @Roles('admin')
PATCH  /documentation-sources/:id                        @Roles('admin')
```

Admin-only desde o início — mesmo padrão de `SettingsController` (chaves de IA): configuração de
fonte de dado não é navegação de jogador comum. `PATCH` só aceita `name`/`active`/`trustLevel` —
`url`/`gameId`/`sourceType` são estruturais (se estiverem errados, recriar a fonte, não editar).

## `domain` é sempre derivado da `url`, nunca aceito do cliente

Se o DTO aceitasse `domain` como campo solto, um cliente malicioso poderia enviar
`url: https://evil.com` com `domain: konami.com` e furar o allowlist de domínio abaixo. O
service (`DocumentationSourcesService.create`) sempre deriva `domain` a partir do `hostname`
parseado de `url` — nunca confia em nada além disso.

## Duas camadas de segurança, propositalmente separadas

### 1. `url-safety.util.ts` — SSRF, sempre ativo, não configurável

`checkSourceUrlSafety(url)` — bloqueia por design, sem exceção:
- Qualquer protocolo que não seja `https:`
- Hosts de loopback conhecidos (`localhost`, `0.0.0.0`)
- Qualquer IPv4 privado/reservado (RFC 1918, loopback, link-local — inclui `169.254.169.254`, o
  alvo clássico de SSRF pra metadata de nuvem)
- **Qualquer literal de IP, público ou privado, v4 ou v6** — fonte de documentação deve sempre
  ser identificada por nome de domínio

Só valida SINTAXE da URL — não faz nenhuma requisição de rede nem resolve DNS (isso é
responsabilidade do coletor, Tarefa 4/25, no momento real do fetch — resolver DNS agora e
guardar o resultado seria inútil, porque pode mudar entre o cadastro e a coleta de verdade,
justamente o vetor de ataque "DNS rebinding" que a Tarefa 25 deve endereçar mais a fundo).

### 2. `allowed-domains.util.ts` — allowlist de negócio, configurável, deny-by-default

`DOCUMENTATION_SOURCE_ALLOWED_DOMAINS` (env var, lista separada por vírgula) — **sem essa
variável configurada, nenhum domínio é autorizado**, mesmo que passe na checagem de SSRF acima.
Casa domínio exato ou subdomínio (`konami.com` autoriza `support.konami.com`, nunca
`notkonami.com` nem `konami.com.evil.net`).

Decisão deliberada (mesmo risco 1 do audit original do módulo eFootball de 24 tarefas, agora
aplicado a texto em vez de carta): **este código nunca assume nem adivinha um domínio real da
Konami ou de qualquer fonte comunitária.** Cabe a um operador configurar explicitamente. Sem
configuração, `POST /documentation-sources` sempre rejeita com HTTP 400 — comportamento seguro
por padrão, nunca "aceita tudo até alguém reclamar".

## `trustLevel` nunca é AUTHORITATIVE fora de `sourceType: OFFICIAL`

`trust-level.util.ts` — `assertTrustLevelAllowed()` lança erro explícito (nunca corrige
silenciosamente, mesmo princípio de `pitch-zone.ts`/`player-build-engine.config.ts`) se qualquer
`sourceType` diferente de `OFFICIAL` tentar `trustLevel: AUTHORITATIVE`, seja no `create` (fonte
nova) ou no `update` (promovendo uma fonte existente). `DEFAULT_TRUST_LEVEL_BY_SOURCE_TYPE`
aplica um valor sensato quando `trustLevel` não é informado (`OFFICIAL`→`AUTHORITATIVE`,
`VERIFIED_COMMUNITY`→`HIGH`, `COMMUNITY`/`MANUAL`→`MEDIUM`) — ainda passa pela mesma checagem.

## Modelo

```prisma
model DocumentationSource {
  id, gameId, name, url, domain, sourceType, language, trustLevel, active,
  lastCheckedAt, lastSuccessAt, lastFailureAt, checksum, createdAt, updatedAt
}
```

`lastCheckedAt`/`lastSuccessAt`/`lastFailureAt`/`checksum` ficam `null` até a Tarefa 4 (o
coletor) existir — são escritos por ela, não pelo CRUD desta tarefa.

## Reaproveitamento vs. tabela nova — decisão registrada

`docs/efootball/documentation-architecture.md` (seção 1.3) já documentava a análise: o
`GameDataSource` existente (Tarefa 4 do módulo de 24 tarefas, usado só pelo pipeline de
Player/PlayerCard) **não foi reaproveitado** — enum `kind` fechado em 3 valores sem `trustLevel`
separado, sem `url`/`domain`/`lastCheckedAt`/`checksum`, e amarrado ao relacionamento
`importRuns: DataImportRun[]` (registros estruturados, não documento/texto). `DocumentationSource`
é tabela nova, mas ancorada em `Game.id` como tudo mais no domínio de jogo.

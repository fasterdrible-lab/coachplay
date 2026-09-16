import { extractPlayerSearchQuery, routeIntent } from './intent-router';

describe('routeIntent (Tarefa 14 — Intent Router)', () => {
  it('classifica pergunta sobre build/evolução', () => {
    expect(routeIntent('Como evoluir meu jogador com esses pontos de progressão?')).toBe('BUILD_RECOMMENDATION');
    expect(routeIntent('Qual a melhor build pra esse cara?')).toBe('BUILD_RECOMMENDATION');
  });

  it('classifica pergunta sobre economia/pack', () => {
    expect(routeIntent('Vale a pena comprar esse pack com minhas moedas?')).toBe('ECONOMY_ADVICE');
  });

  it('classifica pergunta sobre elenco/escalação', () => {
    expect(routeIntent('Quem eu devo escalar nessa formação?')).toBe('SQUAD_ADVICE');
    expect(routeIntent('O que você acha do meu time titular?')).toBe('SQUAD_ADVICE');
  });

  it('classifica pergunta sobre aprendizado/academia', () => {
    expect(routeIntent('Qual aula eu devo fazer agora?')).toBe('LEARNING_RECOMMENDATION');
    expect(routeIntent('Como jogar melhor no ataque?')).toBe('LEARNING_RECOMMENDATION');
  });

  it('classifica pergunta genérica sobre um jogador como PLAYER_SEARCH', () => {
    expect(routeIntent('Quem é Kvaratskhelia?')).toBe('PLAYER_SEARCH');
    expect(routeIntent('Atributos de Messi')).toBe('PLAYER_SEARCH');
  });

  it('prioriza intents mais específicos mesmo quando a palavra "jogador" aparece', () => {
    expect(routeIntent('Como evoluir meu jogador Messi?')).toBe('BUILD_RECOMMENDATION');
    expect(routeIntent('Quem devo escalar, esse jogador ou outro?')).toBe('SQUAD_ADVICE');
  });

  it('retorna UNKNOWN para pergunta fora do vocabulário reconhecido', () => {
    expect(routeIntent('Qual a previsão do tempo amanhã?')).toBe('UNKNOWN');
  });
});

describe('extractPlayerSearchQuery', () => {
  it('remove frases de abertura comuns e mantém só o nome', () => {
    expect(extractPlayerSearchQuery('Quem é Kvaratskhelia?')).toBe('Kvaratskhelia');
    expect(extractPlayerSearchQuery('Atributos de Messi')).toBe('Messi');
    expect(extractPlayerSearchQuery('Carta do Ronaldo')).toBe('Ronaldo');
  });

  it('remove múltiplas frases de abertura na mesma pergunta', () => {
    expect(extractPlayerSearchQuery('Quem é o jogador Messi?')).toBe('Messi');
  });

  it('sem nenhuma frase de abertura reconhecida, mantém o texto original (sem pontuação)', () => {
    expect(extractPlayerSearchQuery('Mbappé')).toBe('Mbappé');
  });
});

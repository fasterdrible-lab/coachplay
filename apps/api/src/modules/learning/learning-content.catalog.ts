import { LearningLevel } from '@prisma/client';

export interface LessonSeed {
  title: string;
  content: string;
}

export interface ModuleSeed {
  title: string;
  lessons: LessonSeed[];
}

export interface PathSeed {
  level: LearningLevel;
  title: string;
  description: string;
  modules: ModuleSeed[];
}

/**
 * Conteúdo inicial da Academia CoachPlay (Tarefa 12) — texto didático próprio do CoachPlay,
 * genérico e conceitual (nunca uma alegação específica sobre mecânica/botão exato do eFootball
 * que exigiria fonte validada — ver "Regra de dados" em docs/efootball-architecture.md). Cobre
 * os 12 tópicos exigidos, distribuídos por nível de complexidade crescente.
 */
export const LEARNING_CONTENT_VERSION = '1.0.0';

export const LEARNING_PATHS: PathSeed[] = [
  {
    level: LearningLevel.BEGINNER,
    title: 'Primeiros Passos no eFootball',
    description: 'Controles básicos e os quatro fundamentos de toda partida.',
    modules: [
      {
        title: 'Fundamentos',
        lessons: [
          {
            title: 'Como o jogo funciona',
            content:
              'Antes de treinar qualquer técnica, entenda o objetivo de cada fase: com bola, o time busca progredir com segurança; sem bola, busca recuperar a posse ocupando espaço. Jogar bem começa em observar o posicionamento do seu time e do adversário antes de decidir a próxima ação.',
          },
        ],
      },
      {
        title: 'Passe',
        lessons: [
          {
            title: 'Escolhendo o passe certo',
            content:
              'Um passe seguro para um companheiro sem pressão vale mais do que um passe arriscado para um companheiro melhor posicionado, mas cercado. Priorize manter a posse até identificar uma linha de passe realmente livre.',
          },
        ],
      },
      {
        title: 'Finalização',
        lessons: [
          {
            title: 'Escolhendo o momento de finalizar',
            content:
              'Finalizar de qualquer ângulo raramente compensa. Espere um ângulo mais central ou um momento em que o goleiro esteja fora de posição antes de arriscar o chute.',
          },
        ],
      },
      {
        title: 'Defesa',
        lessons: [
          {
            title: 'Defender sem se desesperar',
            content:
              'Sair correndo pra cima do adversário com bola raramente funciona — normalmente só abre um espaço para ele driblar. Prefira reduzir distância mantendo a posição, forçando o adversário para áreas menos perigosas.',
          },
        ],
      },
    ],
  },
  {
    level: LearningLevel.CASUAL,
    title: 'Evoluindo no Jogo',
    description: 'Drible e movimentação para criar vantagem individual e coletiva.',
    modules: [
      {
        title: 'Drible',
        lessons: [
          {
            title: 'Quando driblar (e quando não)',
            content:
              'Driblar tem valor quando cria uma vantagem real — passar de um marcador, ganhar um ângulo de passe ou finalização. Driblar sem esse objetivo claro só aumenta o risco de perder a bola.',
          },
        ],
      },
      {
        title: 'Movimentação',
        lessons: [
          {
            title: 'Se movimentar sem a bola',
            content:
              'Grande parte de uma boa jogada acontece antes do passe: jogadores se movimentando para abrir linhas de passe e desmarcar. Observe seus companheiros sem bola tanto quanto observa quem está com ela.',
          },
        ],
      },
    ],
  },
  {
    level: LearningLevel.INTERMEDIATE,
    title: 'Táticas e Estilo de Jogo',
    description: 'Formações e estilos de jogo — como estruturar seu time em campo.',
    modules: [
      {
        title: 'Formações',
        lessons: [
          {
            title: 'Escolhendo uma formação',
            content:
              'Uma formação define papéis e distância entre os jogadores — não existe uma "melhor" universal. Escolha uma formação compatível com o perfil do seu elenco (ver Squad Builder) antes de tentar copiar a formação de outro jogador.',
          },
        ],
      },
      {
        title: 'Estilos de jogo',
        lessons: [
          {
            title: 'Adaptando o estilo ao elenco',
            content:
              'O estilo de jogo (mais posse, mais contra-ataque, mais pressão) deve refletir os pontos fortes reais do seu elenco, não uma preferência abstrata. Um time rápido nas pontas costuma ganhar mais jogando em transição do que tentando manter posse longa.',
          },
        ],
      },
    ],
  },
  {
    level: LearningLevel.ADVANCED,
    title: 'Evoluindo Jogadores',
    description: 'Progressão de atributos e escolha de skills.',
    modules: [
      {
        title: 'Progressão de jogadores',
        lessons: [
          {
            title: 'Como pensar a build de um jogador',
            content:
              'Antes de gastar pontos de progressão, decida qual função o jogador vai exercer no seu time (ver Player Build Engine). Maximizar o overall bruto nem sempre produz o melhor jogador PARA a sua formação — atributos certos para a função importam mais.',
          },
        ],
      },
      {
        title: 'Skills',
        lessons: [
          {
            title: 'Priorizando skills',
            content:
              'Skills têm mais impacto quando reforçam algo que o jogador já faz bem dentro do seu papel tático, em vez de tentar compensar uma fraqueza que a build não resolve.',
          },
        ],
      },
    ],
  },
  {
    level: LearningLevel.COMPETITIVE,
    title: 'Montagem de Elenco e Economia',
    description: 'Construindo e sustentando um elenco competitivo ao longo do tempo.',
    modules: [
      {
        title: 'Montagem de elenco',
        lessons: [
          {
            title: 'Elenco completo, não só 11 titulares',
            content:
              'Um elenco competitivo cobre alternativas em cada posição-chave, não só a escalação titular. Use o Squad Builder pra identificar sistematicamente onde seu elenco tem menos profundidade antes de investir em mais um atacante.',
          },
        ],
      },
      {
        title: 'Economia',
        lessons: [
          {
            title: 'Gastando Coins com critério',
            content:
              'Vale a pena gastar em um pack quando ele resolve uma necessidade real do seu elenco E as chances são conhecidas — nunca decida só pela expectativa. Use o Economy Advisor antes de qualquer gasto grande.',
          },
        ],
      },
    ],
  },
];

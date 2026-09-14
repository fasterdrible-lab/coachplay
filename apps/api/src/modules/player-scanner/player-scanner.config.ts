// Limiares versionados do Player Scanner (Tarefa 7) — algoritmo próprio do CoachPlay para
// decidir quando confiar numa identificação automática. Alterar aqui é uma mudança de produto.
export const PLAYER_SCANNER_CONFIG_VERSION = '1.0.0';

export const AUTO_IDENTIFY_THRESHOLD = 0.9;
export const CONFIRM_THRESHOLD = 0.6;

/** Se o 2º melhor candidato fica a <= esta margem do 1º, o resultado é tratado como ambíguo
 * (ex.: "jogador com várias versões" sem sinal suficiente pra saber qual carta exata). */
export const AMBIGUITY_MARGIN = 0.05;
export const AMBIGUITY_PENALTY = 0.8;

export const MAX_CANDIDATES_RETURNED = 5;

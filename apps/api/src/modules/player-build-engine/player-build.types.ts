import { BuildStrategy, PositionGroup } from './player-build-engine.config';

export interface PlayerBuildCardStat {
  statKey: string;
  baseValue: number;
  maxValue: number;
}

export interface PlayerBuildInput {
  playerCard: {
    id: string;
    overallBase: number;
    maxLevel: number;
  };
  stats: PlayerBuildCardStat[];
  level: number;
  position: string;
  strategy: BuildStrategy;
  availableProgressionPoints: number;
  desiredRole?: string;
  userStyle?: string;
}

export interface StatGain {
  statKey: string;
  from: number;
  to: number;
  delta: number;
}

export interface PlayerBuildExplanationData {
  strategy: BuildStrategy;
  position: string;
  positionGroup: PositionGroup;
  desiredRole?: string;
  userStyle?: string;
  prioritizedStats: string[];
  topGains: StatGain[];
  engineVersion: string;
}

export interface PlayerBuildResult {
  playerCardId: string;
  strategy: BuildStrategy;
  position: string;
  level: number;
  totalPointsAvailable: number;
  totalPointsUsed: number;
  recommendedAllocation: Record<string, number>;
  expectedAttributes: Record<string, number>;
  roleScore: number;
  explanationData: PlayerBuildExplanationData;
}

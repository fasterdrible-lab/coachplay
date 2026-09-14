export interface RawBuildInput {
  allocation: Record<string, number>;
  availableProgressionPoints: number;
}

export interface AppliedBuildSide {
  overall: number;
  attributes: Record<string, number>;
  roleScore: number;
  totalPointsUsed: number;
  totalPointsAvailable: number;
}

export interface AttributeComparison {
  statKey: string;
  a: number;
  b: number;
  delta: number;
}

export interface BuildComparisonResult {
  cardId: string;
  position: string;
  buildA: AppliedBuildSide;
  buildB: AppliedBuildSide;
  attributes: AttributeComparison[];
  advantages: string[];
  disadvantages: string[];
}

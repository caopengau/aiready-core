import type { CostConfig, TokenBudget } from '../types';
import { ModelPricingPreset, getModelPreset } from './pricing-models';

/**
 * Default cost configuration
 */
export const DEFAULT_COST_CONFIG: CostConfig = {
  pricePer1KTokens: 0.005,
  queriesPerDevPerDay: 60,
  developerCount: 5,
  daysPerMonth: 30,
};

/**
 * Calculate estimated monthly cost of AI context waste
 */
export function calculateMonthlyCost(
  tokenWaste: number,
  config: Partial<CostConfig> = {},
  options?: {
    avgContextBudget?: number;
    fragmentationScore?: number;
    potentialSavings?: number;
  }
): { total: number; range: [number, number]; confidence: number } {
  // If we have detailed metrics, use them to calculate a more precise multiplier
  const baseMultiplier =
    tokenWaste > 50000 ? 5.0 : tokenWaste > 10000 ? 3.5 : 2.5;
  const contextMultiplier = options?.avgContextBudget
    ? options.avgContextBudget / Math.max(1, tokenWaste)
    : baseMultiplier;

  const fragRatio = options?.fragmentationScore ?? 0.3;
  const dupRatio = 1 - fragRatio;

  const budget = calculateTokenBudget({
    totalContextTokens: tokenWaste * contextMultiplier,
    wastedTokens: {
      duplication:
        tokenWaste * dupRatio * (options?.potentialSavings ? 1.2 : 1),
      fragmentation: tokenWaste * fragRatio,
      chattiness: 0.1 * tokenWaste,
    },
  });

  const preset = getModelPreset('claude-3.5-sonnet'); // Default to current industry workhorse
  return estimateCostFromBudget(budget, preset, config);
}

/**
 * Calculate precise Token ROI from analyzer metrics.
 *
 * This is the "Value-Led" monetization engine that quantifies the
 * "Context Tax" savings for a team.
 */
export function calculateDetailedTokenROI(params: {
  totalTokens: number;
  avgContextBudget: number;
  potentialSavings: number;
  fragmentationScore: number;
  developerCount: number;
  queriesPerDevPerDay?: number;
}): {
  monthlySavings: number;
  contextTaxPerDev: number;
  efficiencyGain: number;
} {
  const {
    totalTokens,
    avgContextBudget,
    potentialSavings,
    fragmentationScore,
    developerCount,
    queriesPerDevPerDay = 60,
  } = params;

  // 1. Calculate the "Context Tax" (Tokens paid per feature/query)
  // Tax = (Context required - Code analyzed) = dependencies + noise

  // 2. Budget for waste
  const budget = calculateTokenBudget({
    totalContextTokens: avgContextBudget,
    wastedTokens: {
      duplication: potentialSavings * 0.8, // 80% of potential savings are duplication-based
      fragmentation: totalTokens * fragmentationScore * 0.5, // fragmentation impact
      chattiness: totalTokens * 0.1,
    },
  });

  // 3. Estimate monthly cost
  const model = getModelPreset('claude-3.5-sonnet');
  const cost = estimateCostFromBudget(budget, model, {
    developerCount,
    queriesPerDevPerDay,
  });

  return {
    monthlySavings: Math.round(cost.total),
    contextTaxPerDev:
      Math.round((cost.total / (developerCount || 1)) * 100) / 100,
    efficiencyGain: Math.round(budget.efficiencyRatio * 100) / 100,
  };
}

/**
 * Calculate token budget and unit economics
 */
export function calculateTokenBudget(params: {
  totalContextTokens: number;
  estimatedResponseTokens?: number;
  wastedTokens: {
    duplication: number;
    fragmentation: number;
    chattiness: number;
  };
}): TokenBudget {
  const { totalContextTokens, wastedTokens } = params;
  const estimatedResponseTokens =
    params.estimatedResponseTokens ?? totalContextTokens * 0.2;
  const totalWaste =
    wastedTokens.duplication +
    wastedTokens.fragmentation +
    wastedTokens.chattiness;

  const efficiencyRatio = Math.max(
    0,
    Math.min(
      1,
      (totalContextTokens - totalWaste) / Math.max(1, totalContextTokens)
    )
  );

  return {
    totalContextTokens: Math.round(totalContextTokens),
    estimatedResponseTokens: Math.round(estimatedResponseTokens),
    wastedTokens: {
      total: Math.round(totalWaste),
      bySource: {
        duplication: Math.round(wastedTokens.duplication),
        fragmentation: Math.round(wastedTokens.fragmentation),
        chattiness: Math.round(wastedTokens.chattiness),
      },
    },
    efficiencyRatio: Math.round(efficiencyRatio * 100) / 100,
    potentialRetrievableTokens: Math.round(totalWaste * 0.8),
  };
}

/**
 * Estimate dollar cost from a token budget
 */
export function estimateCostFromBudget(
  budget: TokenBudget,
  model: ModelPricingPreset,
  config: Partial<CostConfig> = {}
): { total: number; range: [number, number]; confidence: number } {
  const cfg = { ...DEFAULT_COST_CONFIG, ...config };

  const wastePerQuery = budget.wastedTokens.total;
  const tokensPerDay = wastePerQuery * cfg.queriesPerDevPerDay;
  const tokensPerMonth = tokensPerDay * cfg.daysPerMonth;
  const totalWeight = cfg.developerCount;

  const price = config.pricePer1KTokens ?? model.pricePer1KInputTokens;
  const baseCost = (tokensPerMonth / 1000) * price * totalWeight;

  let confidence = 0.85;
  if (model.contextTier === 'frontier') confidence = 0.7;

  const variance = 0.25;
  const range: [number, number] = [
    Math.round(baseCost * (1 - variance) * 100) / 100,
    Math.round(baseCost * (1 + variance) * 100) / 100,
  ];

  return {
    total: Math.round(baseCost * 100) / 100,
    range,
    confidence,
  };
}

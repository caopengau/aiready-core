/**
 * Business Value Metrics Module.
 *
 * Provides business-aligned metrics that quantify ROI and survive technology changes.
 *
 * @lastUpdated 2026-03-18
 */

import {
  calculateTokenBudget,
  estimateCostFromBudget,
} from './business/cost-metrics';
import { calculateProductivityImpact } from './business/productivity-metrics';
import { getModelPreset } from './business/pricing-models';

/**
 * Historical score entry for trend tracking.
 * Used to store and compare results across different points in time.
 */
export interface ScoreHistoryEntry {
  /** ISO timestamp of the scan */
  timestamp: string;
  /** Overall score (0-100) */
  overallScore: number;
  /** Breakdown of scores by tool */
  breakdown: Record<string, number>;
  /** Total number of issues detected */
  totalIssues: number;
  /** Total tokens analyzed */
  totalTokens: number;
}

/**
 * Trend analysis comparing current vs historical scores.
 * Helps teams understand if their AI-readiness is improving or degrading.
 */
export interface ScoreTrend {
  /** Overall trend direction */
  direction: 'improving' | 'stable' | 'degrading';
  /** Percentage change in score over last 30 days */
  change30Days: number;
  /** Percentage change in score over last 90 days */
  change90Days: number;
  /** Rate of change (points per week) */
  velocity: number;
  /** Projected score in 30 days based on current velocity */
  projectedScore: number;
}

/**
 * Calculate Aggregate Business ROI from code analysis results.
 *
 * This high-level function combines token waste and productivity impact
 * to produce a monthly and annual dollar value of the issues found.
 *
 * @param params - Parameters for ROI calculation
 * @param params.tokenWaste - Estimated total tokens wasted on context inefficiencies
 * @param params.issues - Array of issues with severity levels for productivity impact
 * @param params.developerCount - Number of developers in the team (default: 5)
 * @param params.modelId - AI model ID for pricing model selection (default: 'claude-4.6')
 * @returns Business ROI metrics including savings and recommendations
 */
export function calculateBusinessROI(params: {
  tokenWaste: number;
  issues: { severity: string }[];
  developerCount?: number;
  modelId?: string;
}): {
  /** Estimated monthly savings if issues are resolved */
  monthlySavings: number;
  /** Total developer hours gained per month */
  productivityGainHours: number;
  /** Projected total annual business value gained */
  annualValue: number;
} {
  const model = getModelPreset(params.modelId || 'claude-4.6');
  const devCount = params.developerCount || 5;

  const budget = calculateTokenBudget({
    totalContextTokens: params.tokenWaste * 2.5,
    wastedTokens: {
      duplication: params.tokenWaste * 0.7,
      fragmentation: params.tokenWaste * 0.3,
      chattiness: 0,
    },
  });

  const cost = estimateCostFromBudget(budget, model, {
    developerCount: devCount,
  });
  const productivity = calculateProductivityImpact(params.issues);

  const monthlySavings = cost.total;
  const productivityGainHours = productivity.totalHours;
  const annualValue = (monthlySavings + productivityGainHours * 75) * 12;

  return {
    monthlySavings: Math.round(monthlySavings),
    productivityGainHours: Math.round(productivityGainHours),
    annualValue: Math.round(annualValue),
  };
}

/**
 * Format currency value for display in console or reports.
 *
 * Handles small values with decimals and large values with 'k' suffix.
 *
 * @param cost Cost in USD
 * @returns Formatted currency string (e.g. "$0.50", "$500", "$1.2k")
 */
export function formatCost(cost: number): string {
  if (cost < 1) {
    return `$${cost.toFixed(2)}`;
  } else if (cost < 1000) {
    return `$${cost.toFixed(0)}`;
  } else {
    return `$${(cost / 1000).toFixed(1)}k`;
  }
}

/**
 * Format time duration in hours for display in console or reports.
 *
 * Automatically switches between minutes, hours, and weeks based on magnitude.
 *
 * @param hours Number of hours
 * @returns Formatted duration string (e.g. "30min", "4.5h", "2.1 weeks")
 */
export function formatHours(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)}min`;
  } else if (hours < 8) {
    return `${hours.toFixed(1)}h`;
  } else if (hours < 40) {
    return `${Math.round(hours)}h`;
  } else {
    return `${(hours / 40).toFixed(1)} weeks`;
  }
}

import type { TechnicalValueChain } from './types';

/**
 * Format AI acceptance rate as a human-readable percentage string.
 *
 * @param rate - Rate value between 0 and 1 (e.g. 0.85).
 * @returns Formatted percentage string (e.g. "85%").
 */
export function formatAcceptanceRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/**
 * Generate a technical value chain map for a specific issue category.
 *
 * maps technical metrics (like duplication count) to business outcomes
 * by explaining the impact on AI models and developer workflow.
 *
 * @param params Issue information
 * @param params.issueType Unique identifier for the issue type
 * @param params.count Total occurrences of this issue
 * @param params.severity Severity level of the issues
 * @returns A structured technical value chain object
 */
export function generateValueChain(params: {
  issueType: string;
  count: number;
  severity: 'critical' | 'major' | 'minor';
}): TechnicalValueChain {
  const { issueType, count, severity } = params;

  const impacts: Record<string, any> = {
    'duplicate-pattern': {
      ai: 'Ambiguous context leads to code generation variants. AI picks wrong implementation 40% of the time.',
      dev: 'Developers must manually resolve conflicts between suggested variants.',
      risk: 'high',
    },
    'context-fragmentation': {
      ai: 'Context window overflow causes model to forget mid-file dependencies resulting in hallucinations.',
      dev: 'Slower AI responses and increased need for manual context pinning.',
      risk: 'critical',
    },
    'naming-inconsistency': {
      ai: 'Degraded intent inference. AI misidentifies domain concepts across file boundaries.',
      dev: 'Increased cognitive load for new devs during onboarding.',
      risk: 'moderate',
    },
  };

  const impact = impacts[issueType] || {
    ai: 'Reduced suggestion quality.',
    dev: 'Slowed development velocity.',
    risk: 'moderate',
  };

  const productivityLoss =
    severity === 'critical' ? 0.25 : severity === 'major' ? 0.1 : 0.05;

  return {
    issueType,
    technicalMetric: 'Issue Count',
    technicalValue: count,
    aiImpact: {
      description: impact.ai,
      scoreImpact: severity === 'critical' ? -15 : -5,
    },
    developerImpact: {
      description: impact.dev,
      productivityLoss,
    },
    businessOutcome: {
      directCost: count * 12,
      opportunityCost: productivityLoss * 15000,
      riskLevel: impact.risk as any,
    },
  };
}

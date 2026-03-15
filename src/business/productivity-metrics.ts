import type { ProductivityImpact, AcceptancePrediction } from '../types';
import { Severity } from '../types';
import type { ToolScoringOutput } from '../scoring';

/**
 * Severity time estimates (hours to fix)
 */
export const SEVERITY_TIME_ESTIMATES = {
  [Severity.Critical]: 4,
  [Severity.Major]: 2,
  [Severity.Minor]: 0.5,
  [Severity.Info]: 0.25,
};

const DEFAULT_HOURLY_RATE = 75;

/**
 * Calculate productivity impact from issues
 */
export function calculateProductivityImpact(
  issues: { severity: string }[],
  hourlyRate: number = DEFAULT_HOURLY_RATE
): ProductivityImpact {
  const counts = {
    [Severity.Critical]: issues.filter((i) => i.severity === Severity.Critical)
      .length,
    [Severity.Major]: issues.filter((i) => i.severity === Severity.Major)
      .length,
    [Severity.Minor]: issues.filter((i) => i.severity === Severity.Minor)
      .length,
    [Severity.Info]: issues.filter((i) => i.severity === Severity.Info).length,
  };

  const hours = {
    [Severity.Critical]:
      counts[Severity.Critical] * SEVERITY_TIME_ESTIMATES[Severity.Critical],
    [Severity.Major]:
      counts[Severity.Major] * SEVERITY_TIME_ESTIMATES[Severity.Major],
    [Severity.Minor]:
      counts[Severity.Minor] * SEVERITY_TIME_ESTIMATES[Severity.Minor],
    [Severity.Info]:
      counts[Severity.Info] * SEVERITY_TIME_ESTIMATES[Severity.Info],
  };

  const totalHours =
    hours[Severity.Critical] +
    hours[Severity.Major] +
    hours[Severity.Minor] +
    hours[Severity.Info];
  const totalCost = totalHours * hourlyRate;

  return {
    totalHours: Math.round(totalHours * 10) / 10,
    hourlyRate,
    totalCost: Math.round(totalCost),
    bySeverity: {
      [Severity.Critical]: {
        hours: Math.round(hours[Severity.Critical] * 10) / 10,
        cost: Math.round(hours[Severity.Critical] * hourlyRate),
      },
      [Severity.Major]: {
        hours: Math.round(hours[Severity.Major] * 10) / 10,
        cost: Math.round(hours[Severity.Major] * hourlyRate),
      },
      [Severity.Minor]: {
        hours: Math.round(hours[Severity.Minor] * 10) / 10,
        cost: Math.round(hours[Severity.Minor] * hourlyRate),
      },
      [Severity.Info]: {
        hours: Math.round(hours[Severity.Info] * 10) / 10,
        cost: Math.round(hours[Severity.Info] * hourlyRate),
      },
    },
  };
}

/**
 * Predict AI suggestion acceptance rate
 */
export function predictAcceptanceRate(
  toolOutputs: Map<string, ToolScoringOutput>
): AcceptancePrediction {
  const factors: AcceptancePrediction['factors'] = [];
  const baseRate = 0.3;

  const patterns = toolOutputs.get('pattern-detect');
  if (patterns) {
    factors.push({
      name: 'Semantic Duplication',
      impact: Math.round((patterns.score - 50) * 0.003 * 100),
    });
  }

  const context = toolOutputs.get('context-analyzer');
  if (context) {
    factors.push({
      name: 'Context Efficiency',
      impact: Math.round((context.score - 50) * 0.004 * 100),
    });
  }

  const consistency = toolOutputs.get('consistency');
  if (consistency) {
    factors.push({
      name: 'Code Consistency',
      impact: Math.round((consistency.score - 50) * 0.002 * 100),
    });
  }

  const aiSignalClarity = toolOutputs.get('ai-signal-clarity');
  if (aiSignalClarity) {
    factors.push({
      name: 'AI Signal Clarity',
      impact: Math.round((50 - aiSignalClarity.score) * 0.002 * 100),
    });
  }

  const totalImpact = factors.reduce(
    (sum: number, f: { impact: number }) => sum + f.impact / 100,
    0
  );
  const rate = Math.max(0.05, Math.min(0.8, baseRate + totalImpact));

  let confidence = 0.35;
  if (toolOutputs.size >= 4) confidence = 0.75;
  else if (toolOutputs.size >= 3) confidence = 0.65;
  else if (toolOutputs.size >= 2) confidence = 0.5;

  return { rate: Math.round(rate * 100) / 100, confidence, factors };
}

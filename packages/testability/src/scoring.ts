import { ToolName, buildStandardToolScore } from '@aiready/core';
import type { TestabilityReport } from './types';

/**
 * Convert testability report into a ToolScoringOutput for the unified score.
 */
export function calculateTestabilityScore(report: TestabilityReport): any {
  const { summary, rawData, recommendations } = report;

  return buildStandardToolScore({
    toolName: ToolName.TestabilityIndex,
    score: summary.score,
    rawData,
    dimensions: summary.dimensions,
    dimensionNames: {
      testCoverageRatio: 'Test Coverage',
      purityScore: 'Function Purity',
      dependencyInjectionScore: 'Dependency Injection',
      interfaceFocusScore: 'Interface Focus',
      observabilityScore: 'Observability',
    },
    recommendations,
    rating: summary.rating,
  });
}

import { ToolName, buildStandardToolScore } from '@aiready/core';
import type { ChangeAmplificationReport } from './types';

/**
 * Convert change amplification report into a standardized ToolScoringOutput.
 */
export function calculateChangeAmplificationScore(
  report: ChangeAmplificationReport
): any {
  const { summary } = report;

  return buildStandardToolScore({
    toolName: ToolName.ChangeAmplification,
    score: summary.score ?? 0,
    rawData: {
      totalFiles: summary.totalFiles,
      totalIssues: summary.totalIssues,
    },
    dimensions: {
      graphStability: summary.score ?? 0,
    },
    dimensionNames: {
      graphStability: 'Graph Stability',
    },
    recommendations: summary.recommendations,
    recommendationImpact: 10,
    rating: summary.rating,
  });
}

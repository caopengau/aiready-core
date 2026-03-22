import { type ToolScoringOutput, RecommendationPriority } from '../scoring';
import { ToolName } from '../types';

/**
 * Standard parameters for building a ToolScoringOutput.
 */
export interface StandardScoringParams {
  toolName: ToolName | string;
  score: number;
  rawData: Record<string, any>;
  dimensions: Record<string, number>;
  dimensionNames: Record<string, string>;
  recommendations: string[];
  recommendationImpact?: number;
  rating?: string;
}

/**
 * Common factor builder logic.
 * Map dimension scores to standard factor objects with -50 impact baseline.
 */
export function buildFactorsFromDimensions(
  dimensions: Record<string, number>,
  dimensionNames: Record<string, string>,
  rawData: Record<string, any>
): ToolScoringOutput['factors'] {
  return Object.entries(dimensionNames).map(([key, name]) => {
    const val = dimensions[key] ?? 50;
    return {
      name,
      impact: Math.round(val - 50),
      description: formatDimensionDescription(key, rawData) || `${val}/100`,
    };
  });
}

/**
 * Heuristics to format human-readable descriptions for known raw metrics.
 */
function formatDimensionDescription(
  key: string,
  rawData: Record<string, any>
): string | undefined {
  // Generic pattern matching for common metrics
  if (key === 'testCoverageRatio' && rawData.testFiles !== undefined) {
    return `${rawData.testFiles} test files / ${rawData.sourceFiles} source files`;
  }
  if (key === 'purityScore' && rawData.pureFunctions !== undefined) {
    return `${rawData.pureFunctions}/${rawData.totalFunctions} functions are pure`;
  }
  if (
    key === 'dependencyInjectionScore' &&
    rawData.injectionPatterns !== undefined
  ) {
    return `${rawData.injectionPatterns}/${rawData.totalClasses} classes use DI`;
  }
  if (
    key === 'structureClarityScore' &&
    rawData.deepDirectories !== undefined
  ) {
    return `${rawData.deepDirectories} of ${rawData.totalDirectories} dirs exceed recommended depth`;
  }
  return undefined;
}

/**
 * Unified tool scoring output builder.
 */
export function buildStandardToolScore(
  params: StandardScoringParams
): ToolScoringOutput {
  const {
    toolName,
    score,
    rawData,
    dimensions,
    dimensionNames,
    recommendations,
    recommendationImpact = 8,
    rating,
  } = params;

  const factors = buildFactorsFromDimensions(
    dimensions,
    dimensionNames,
    rawData
  );

  const recs: ToolScoringOutput['recommendations'] = recommendations.map(
    (action) => ({
      action,
      estimatedImpact: recommendationImpact,
      priority:
        score < 50 ||
        [
          'high-risk',
          'blind-risk',
          'explosive',
          'fragile',
          'critical',
        ].includes(rating || '')
          ? RecommendationPriority.High
          : RecommendationPriority.Medium,
    })
  );

  return {
    toolName: toolName as any,
    score,
    rawMetrics: {
      ...rawData,
      rating: rating || rawData.rating,
    },
    factors,
    recommendations: recs,
  };
}

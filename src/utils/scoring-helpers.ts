import { type ToolScoringOutput, RecommendationPriority } from '../scoring';
import { ToolName } from '../types';

/**
 * Standard parameters for building a ToolScoringOutput.
 */
export interface StandardScoringParams {
  toolName: ToolName | string;
  score: number;
  rawData: Record<string, unknown>;
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
  rawData: Record<string, unknown>
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
  rawData: Record<string, unknown>
): string | undefined {
  // Generic pattern matching for common metrics
  if (key === 'testCoverageRatio' && rawData.testFiles !== undefined) {
    return `${String(rawData.testFiles)} test files / ${String(rawData.sourceFiles)} source files`;
  }
  if (key === 'purityScore' && rawData.pureFunctions !== undefined) {
    return `${String(rawData.pureFunctions)}/${String(rawData.totalFunctions)} functions are pure`;
  }
  if (
    key === 'dependencyInjectionScore' &&
    rawData.injectionPatterns !== undefined
  ) {
    return `${String(rawData.injectionPatterns)}/${String(rawData.totalClasses)} classes use DI`;
  }
  if (
    key === 'structureClarityScore' &&
    rawData.deepDirectories !== undefined
  ) {
    return `${String(rawData.deepDirectories)} of ${String(rawData.totalDirectories)} dirs exceed recommended depth`;
  }
  if (key === 'apiClarityScore' && rawData.untypedExports !== undefined) {
    return `${String(rawData.untypedExports)} of ${String(rawData.totalExports)} exports lack type annotations`;
  }
  if (key === 'graphStabilityScore') {
    return `${String(rawData.score)}/100`;
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
    toolName: toolName as ToolName,
    score,
    rawMetrics: {
      ...rawData,
      rating: rating || String(rawData.rating),
    },
    factors,
    recommendations: recs,
  };
}

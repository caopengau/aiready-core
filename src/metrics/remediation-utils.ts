import type { ToolScoringOutput } from '../scoring';
import type {
  CognitiveLoad,
  PatternEntropy,
  ConceptCohesion,
  AiSignalClarity,
  AgentGroundingScore,
  TestabilityIndex,
  DocDriftRisk,
  DependencyHealthScore,
} from './index';

/**
 * Parameters for generating comprehensive future-proof recommendations.
 *
 * @lastUpdated 2026-03-18
 */
export interface FutureProofRecommendationParams {
  cognitiveLoad: CognitiveLoad;
  patternEntropy: PatternEntropy;
  conceptCohesion: ConceptCohesion;
  aiSignalClarity: AiSignalClarity;
  agentGrounding: AgentGroundingScore;
  testability: TestabilityIndex;
  docDrift?: DocDriftRisk;
  dependencyHealth?: DependencyHealthScore;
}

/**
 * Collect and prioritize recommendations from all metric dimensions.
 *
 * @param params - The results from various AIReady metrics
 * @returns A flattened and prioritized list of remediation actions
 */
export function collectFutureProofRecommendations(
  params: FutureProofRecommendationParams
): ToolScoringOutput['recommendations'] {
  const recommendations: ToolScoringOutput['recommendations'] = [];

  for (const rec of params.aiSignalClarity.recommendations) {
    recommendations.push({ action: rec, estimatedImpact: 8, priority: 'high' });
  }

  for (const rec of params.agentGrounding.recommendations) {
    recommendations.push({
      action: rec,
      estimatedImpact: 6,
      priority: 'medium',
    });
  }

  for (const rec of params.testability.recommendations) {
    const priority =
      params.testability.aiChangeSafetyRating === 'blind-risk'
        ? 'high'
        : 'medium';
    recommendations.push({ action: rec, estimatedImpact: 10, priority });
  }

  for (const rec of params.patternEntropy.recommendations) {
    recommendations.push({ action: rec, estimatedImpact: 5, priority: 'low' });
  }

  if (params.conceptCohesion.rating === 'poor') {
    recommendations.push({
      action: 'Improve concept cohesion by grouping related exports',
      estimatedImpact: 8,
      priority: 'high',
    });
  }

  if (params.docDrift) {
    for (const rec of params.docDrift.recommendations) {
      recommendations.push({
        action: rec,
        estimatedImpact: 8,
        priority: 'high',
      });
    }
  }

  if (params.dependencyHealth) {
    for (const rec of params.dependencyHealth.recommendations) {
      recommendations.push({
        action: rec,
        estimatedImpact: 7,
        priority: 'medium',
      });
    }
  }

  return recommendations;
}

/**
 * Collect recommendations for the base future-proof score variant.
 * Focuses on pattern and concept metrics for earlier-stage analysis.
 *
 * @param params - Pattern and concept metrics gathered during basic scan.
 * @param params.patternEntropy - Structural fragmentation data.
 * @param params.conceptCohesion - Semantic alignment data.
 * @returns Prioritized list of remediation recommendations.
 */
export function collectBaseFutureProofRecommendations(params: {
  patternEntropy: PatternEntropy;
  conceptCohesion: ConceptCohesion;
}): ToolScoringOutput['recommendations'] {
  const recommendations: ToolScoringOutput['recommendations'] = [];

  for (const rec of params.patternEntropy.recommendations) {
    recommendations.push({
      action: rec,
      estimatedImpact: 5,
      priority: 'medium',
    });
  }

  if (params.conceptCohesion.rating === 'poor') {
    recommendations.push({
      action: 'Improve concept cohesion by grouping related exports',
      estimatedImpact: 8,
      priority: 'high',
    });
  }

  return recommendations;
}

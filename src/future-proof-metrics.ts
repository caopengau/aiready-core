/**
 * Future-Proof AI Metrics Abstraction Layer
 *
 * This module provides technology-agnostic metric primitives that will
 * remain valid across changes in AI models, tokenization, and paradigms.
 *
 * It focuses on cognitive load, semantic cohesion, and structural entropy.
 */

import type { ToolScoringOutput } from './scoring';
import {
  calculateCognitiveLoad,
  CognitiveLoad,
} from './metrics/cognitive-load';
import {
  calculateSemanticDistance,
  SemanticDistance,
} from './metrics/semantic-distance';
import {
  calculatePatternEntropy,
  calculateConceptCohesion,
  PatternEntropy,
  ConceptCohesion,
} from './metrics/structural-metrics';
import {
  calculateAiSignalClarity,
  AiSignalClarity,
} from './metrics/ai-signal-clarity';
import {
  calculateAgentGrounding,
  AgentGroundingScore,
} from './metrics/agent-grounding';
import {
  calculateTestabilityIndex,
  TestabilityIndex,
} from './metrics/testability-index';
import { calculateDocDrift, DocDriftRisk } from './metrics/doc-drift';
import {
  calculateDependencyHealth,
  DependencyHealthScore,
} from './metrics/dependency-health';
import {
  calculateChangeAmplification,
  ChangeAmplificationScore,
} from './metrics/change-amplification';
import {
  collectBaseFutureProofRecommendations,
  collectFutureProofRecommendations,
  type FutureProofRecommendationParams,
} from './metrics/remediation-utils';

export * from './metrics/cognitive-load';
export * from './metrics/semantic-distance';
export * from './metrics/structural-metrics';
export * from './metrics/ai-signal-clarity';
export * from './metrics/agent-grounding';
export * from './metrics/testability-index';
export * from './metrics/doc-drift';
export * from './metrics/dependency-health';
export * from './metrics/change-amplification';

/**
 * Calculate the Aggregate Future-Proof Score based on core structural metrics.
 *
 * Combines cognitive load, pattern entropy, and concept cohesion into a single
 * normalized score that predicts how well AI systems can handle this code in the long term.
 *
 * @param params - Configuration for score calculation
 * @param params.cognitiveLoad - Cognitive load metrics (file size, depth, fragmentation)
 * @param params.patternEntropy - Structural randomness vs consistency
 * @param params.conceptCohesion - Semantic alignment within logical blocks
 * @param params.semanticDistances - Optional measurements of conceptual drift
 * @returns ToolScoringOutput containing the final score and influencing factors
 */
export function calculateFutureProofScore(params: {
  cognitiveLoad: CognitiveLoad;
  patternEntropy: PatternEntropy;
  conceptCohesion: ConceptCohesion;
  semanticDistances?: SemanticDistance[];
}): ToolScoringOutput {
  const loadScore = 100 - params.cognitiveLoad.score;
  const entropyScore = 100 - params.patternEntropy.entropy * 100;
  const cohesionScore = params.conceptCohesion.score * 100;

  const overall = Math.round(
    loadScore * 0.4 + entropyScore * 0.3 + cohesionScore * 0.3
  );

  const factors: ToolScoringOutput['factors'] = [
    {
      name: 'Cognitive Load',
      impact: Math.round(loadScore - 50),
      description: params.cognitiveLoad.rating,
    },
    {
      name: 'Pattern Entropy',
      impact: Math.round(entropyScore - 50),
      description: params.patternEntropy.rating,
    },
    {
      name: 'Concept Cohesion',
      impact: Math.round(cohesionScore - 50),
      description: params.conceptCohesion.rating,
    },
  ];

  const recommendations = collectBaseFutureProofRecommendations({
    patternEntropy: params.patternEntropy,
    conceptCohesion: params.conceptCohesion,
  });

  const semanticDistanceAvg = params.semanticDistances?.length
    ? params.semanticDistances.reduce((s, d) => s + d.distance, 0) /
      params.semanticDistances.length
    : 0;

  return {
    toolName: 'future-proof',
    score: overall,
    rawMetrics: {
      cognitiveLoadScore: params.cognitiveLoad.score,
      entropyScore: params.patternEntropy.entropy,
      cohesionScore: params.conceptCohesion.score,
      semanticDistanceAvg,
    },
    factors,
    recommendations,
  };
}

/**
 * Calculate a Comprehensive Extended Future-Proof Score.
 *
 * Incorporates secondary signals like documentation drift, dependency health,
 * and testability index to provide a holistic view of the repository's AI readiness.
 *
 * @param params - Comprehensive set of metric outputs
 * @returns ToolScoringOutput with extended analysis results
 */
export function calculateExtendedFutureProofScore(
  params: FutureProofRecommendationParams & {
    semanticDistances?: SemanticDistance[];
  }
): ToolScoringOutput {
  const loadScore = 100 - params.cognitiveLoad.score;
  const entropyScore = 100 - params.patternEntropy.entropy * 100;
  const cohesionScore = params.conceptCohesion.score * 100;
  const aiSignalClarityScore = 100 - params.aiSignalClarity.score;
  const groundingScore = params.agentGrounding.score;
  const testabilityScore = params.testability.score;
  const docDriftScore = params.docDrift ? 100 - params.docDrift.score : 100;
  const depsHealthScore = params.dependencyHealth?.score ?? 100;

  let totalWeight = 0.8;
  let overall =
    loadScore * 0.15 +
    entropyScore * 0.1 +
    cohesionScore * 0.1 +
    aiSignalClarityScore * 0.15 +
    groundingScore * 0.15 +
    testabilityScore * 0.15;

  if (params.docDrift) {
    overall += docDriftScore * 0.1;
    totalWeight += 0.1;
  }
  if (params.dependencyHealth) {
    overall += depsHealthScore * 0.1;
    totalWeight += 0.1;
  }

  overall = Math.round(overall / totalWeight);

  const factors: ToolScoringOutput['factors'] = [
    {
      name: 'Cognitive Load',
      impact: Math.round(loadScore - 50),
      description: params.cognitiveLoad.rating,
    },
    {
      name: 'Pattern Entropy',
      impact: Math.round(entropyScore - 50),
      description: params.patternEntropy.rating,
    },
    {
      name: 'Concept Cohesion',
      impact: Math.round(cohesionScore - 50),
      description: params.conceptCohesion.rating,
    },
    {
      name: 'AI Signal Clarity',
      impact: Math.round(aiSignalClarityScore - 50),
      description: `${params.aiSignalClarity.rating} risk`,
    },
    {
      name: 'Agent Grounding',
      impact: Math.round(groundingScore - 50),
      description: params.agentGrounding.rating,
    },
    {
      name: 'Testability',
      impact: Math.round(testabilityScore - 50),
      description: params.testability.rating,
    },
  ];

  if (params.docDrift) {
    factors.push({
      name: 'Documentation Drift',
      impact: Math.round(docDriftScore - 50),
      description: params.docDrift.rating,
    });
  }
  if (params.dependencyHealth) {
    factors.push({
      name: 'Dependency Health',
      impact: Math.round(depsHealthScore - 50),
      description: params.dependencyHealth.rating,
    });
  }

  const recommendations = collectFutureProofRecommendations(params);
  const semanticDistanceAvg = params.semanticDistances?.length
    ? params.semanticDistances.reduce((s, d) => s + d.distance, 0) /
      params.semanticDistances.length
    : 0;

  return {
    toolName: 'future-proof',
    score: overall,
    rawMetrics: {
      cognitiveLoadScore: params.cognitiveLoad.score,
      entropyScore: params.patternEntropy.entropy,
      cohesionScore: params.conceptCohesion.score,
      aiSignalClarityScore: params.aiSignalClarity.score,
      agentGroundingScore: params.agentGrounding.score,
      testabilityScore: params.testability.score,
      docDriftScore: params.docDrift?.score,
      dependencyHealthScore: params.dependencyHealth?.score,
      semanticDistanceAvg,
    },
    factors,
    recommendations,
  };
}

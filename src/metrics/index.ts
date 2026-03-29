// Cognitive load metrics
export type { CognitiveLoad } from './cognitive-load';

// Structural metrics
export type { PatternEntropy, ConceptCohesion } from './structural-metrics';

// AI signal clarity metrics
export type { AiSignalClarity } from './ai-signal-clarity';

// Agent grounding metrics
export type { AgentGroundingScore } from './agent-grounding';

// Testability metrics
export type { TestabilityIndex } from './testability-index';

// Doc drift metrics
export type { DocDriftRisk } from './doc-drift';

// Dependency health metrics
export type { DependencyHealthScore } from './dependency-health';

// Semantic distance metrics
export type { SemanticDistance } from './semantic-distance';

// Change amplification metrics
export type { ChangeAmplificationScore } from './change-amplification';

// Remediation utilities
export {
  collectFutureProofRecommendations,
  collectBaseFutureProofRecommendations,
} from './remediation-utils';
export type { FutureProofRecommendationParams } from './remediation-utils';

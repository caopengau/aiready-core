import { z } from 'zod';

/**
 * Severity levels for all AIReady issues.
 */
export enum Severity {
  Critical = 'critical',
  Major = 'major',
  Minor = 'minor',
  Info = 'info',
}

/** Zod schema for Severity enum */
export const SeveritySchema = z.nativeEnum(Severity);

/**
 * Canonical Tool Names (IDs)
 * Used everywhere as the single source of truth for tool identification.
 */
export enum ToolName {
  PatternDetect = 'pattern-detect',
  ContextAnalyzer = 'context-analyzer',
  NamingConsistency = 'naming-consistency',
  AiSignalClarity = 'ai-signal-clarity',
  AgentGrounding = 'agent-grounding',
  TestabilityIndex = 'testability-index',
  DocDrift = 'doc-drift',
  DependencyHealth = 'dependency-health',
  ChangeAmplification = 'change-amplification',
  CognitiveLoad = 'cognitive-load',
  PatternEntropy = 'pattern-entropy',
  ConceptCohesion = 'concept-cohesion',
  SemanticDistance = 'semantic-distance',
}

/** Zod schema for ToolName enum */
export const ToolNameSchema = z.nativeEnum(ToolName);

/**
 * Friendly labels for UI display
 */
export const FRIENDLY_TOOL_NAMES: Record<ToolName, string> = {
  [ToolName.PatternDetect]: 'Semantic Duplicates',
  [ToolName.ContextAnalyzer]: 'Context Fragmentation',
  [ToolName.NamingConsistency]: 'Naming Consistency',
  [ToolName.AiSignalClarity]: 'AI Signal Clarity',
  [ToolName.AgentGrounding]: 'Agent Grounding',
  [ToolName.TestabilityIndex]: 'Testability Index',
  [ToolName.DocDrift]: 'Documentation Health',
  [ToolName.DependencyHealth]: 'Dependency Health',
  [ToolName.ChangeAmplification]: 'Change Amplification',
  [ToolName.CognitiveLoad]: 'Cognitive Load',
  [ToolName.PatternEntropy]: 'Pattern Entropy',
  [ToolName.ConceptCohesion]: 'Concept Cohesion',
  [ToolName.SemanticDistance]: 'Semantic Distance',
};

/**
 * Standardized issue types across all AIReady tools.
 */
export enum IssueType {
  // Pattern & Duplication
  DuplicatePattern = 'duplicate-pattern',
  PatternInconsistency = 'pattern-inconsistency',

  // Context & Fragmentation
  ContextFragmentation = 'context-fragmentation',
  DependencyHealth = 'dependency-health',
  CircularDependency = 'circular-dependency',

  // Documentation & Quality
  DocDrift = 'doc-drift',
  NamingInconsistency = 'naming-inconsistency',
  NamingQuality = 'naming-quality',
  ArchitectureInconsistency = 'architecture-inconsistency',
  DeadCode = 'dead-code',
  MissingTypes = 'missing-types',
  MagicLiteral = 'magic-literal',
  BooleanTrap = 'boolean-trap',

  // AI Readiness Dimensions
  AiSignalClarity = 'ai-signal-clarity',
  LowTestability = 'low-testability',
  AgentNavigationFailure = 'agent-navigation-failure',
  AmbiguousApi = 'ambiguous-api',
  ChangeAmplification = 'change-amplification',
}

/** Zod schema for IssueType enum */
export const IssueTypeSchema = z.nativeEnum(IssueType);

/**
 * Analysis processing status.
 */
export enum AnalysisStatus {
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
}

/** Zod schema for AnalysisStatus enum */
export const AnalysisStatusSchema = z.nativeEnum(AnalysisStatus);

/**
 * AI Model Context Tiers.
 */
export enum ModelTier {
  Compact = 'compact',
  Standard = 'standard',
  Extended = 'extended',
  Frontier = 'frontier',
}

/** Zod schema for ModelTier enum */
export const ModelTierSchema = z.nativeEnum(ModelTier);

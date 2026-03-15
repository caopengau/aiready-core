import { ToolName } from './types/schema';

/**
 * Priority levels for actionable recommendations.
 *
 * Used to Sort and display fixes for the user.
 */
export enum RecommendationPriority {
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

/**
 * AI Readiness Rating categories.
 *
 * Provides a high-level qualitative assessment based on the numeric score.
 */
export enum ReadinessRating {
  Excellent = 'Excellent',
  Good = 'Good',
  Fair = 'Fair',
  NeedsWork = 'Needs Work',
  Critical = 'Critical',
}

/**
 * Output structure for a single tool's scoring analysis.
 */
export interface ToolScoringOutput {
  /** Unique tool identifier (e.g., "pattern-detect") */
  toolName: string;

  /** Normalized 0-100 score for this tool */
  score: number;

  /** AI token budget unit economics (v0.13+) */
  tokenBudget?: import('./types').TokenBudget;

  /** Raw metrics used to calculate the score */
  rawMetrics: Record<string, any>;

  /** Factors that influenced the score */
  factors: Array<{
    /** Human-readable name of the factor */
    name: string;
    /** Points contribution (positive or negative) */
    impact: number;
    /** Explanation of the factor's impact */
    description: string;
  }>;

  /** Actionable recommendations with estimated impact */
  recommendations: Array<{
    /** The recommended action to take */
    action: string;
    /** Potential points increase if implemented */
    estimatedImpact: number;
    /** Implementation priority */
    priority: RecommendationPriority | 'high' | 'medium' | 'low';
  }>;
}

/**
 * Consolidated scoring result across all tools.
 *
 * This is the final report object containing the overall score,
 * rating, and detailed breakdown for all tools.
 */
export interface ScoringResult {
  /** Overall AI Readiness Score (0-100) */
  overall: number;

  /** Rating category representing the overall readiness */
  rating: ReadinessRating | string;

  /** Timestamp of score calculation */
  timestamp: string;

  /** Tools that contributed to this score */
  toolsUsed: string[];

  /** Breakdown by individual tool */
  breakdown: ToolScoringOutput[];

  /** Internal calculation details for transparency */
  calculation: {
    /** Textual representation of the calculation formula */
    formula: string;
    /** Weights applied to each tool */
    weights: Record<string, number>;
    /** Simplified normalized formula output */
    normalized: string;
  };
}

/**
 * Configuration options for the scoring system.
 */
export interface ScoringConfig {
  /** Minimum passing score (CLI will exit with non-zero if below) */
  threshold?: number;

  /** Whether to show the detailed tool-by-tool breakdown */
  showBreakdown?: boolean;

  /** Path to a baseline report JSON for trend comparison */
  compareBaseline?: string;

  /** Target file path to persist the calculated score */
  saveTo?: string;
}

/**
 * Default weights for known tools.
 *
 * Weights represent the percentage contribution of each tool to the overall score.
 * By default, they sum to 100 for a standard project.
 */
export const DEFAULT_TOOL_WEIGHTS: Record<string, number> = {
  [ToolName.PatternDetect]: 22,
  [ToolName.ContextAnalyzer]: 19,
  [ToolName.NamingConsistency]: 14,
  [ToolName.AiSignalClarity]: 11,
  [ToolName.AgentGrounding]: 10,
  [ToolName.TestabilityIndex]: 10,
  [ToolName.DocDrift]: 8,
  [ToolName.DependencyHealth]: 6,
  [ToolName.ChangeAmplification]: 8,
};

/**
 * Tool name normalization map.
 *
 * Maps common shorthands and aliases to canonical tool IDs.
 */
export const TOOL_NAME_MAP: Record<string, string> = {
  patterns: ToolName.PatternDetect,
  'pattern-detect': ToolName.PatternDetect,
  context: ToolName.ContextAnalyzer,
  'context-analyzer': ToolName.ContextAnalyzer,
  consistency: ToolName.NamingConsistency,
  'naming-consistency': ToolName.NamingConsistency,
  'ai-signal': ToolName.AiSignalClarity,
  'ai-signal-clarity': ToolName.AiSignalClarity,
  grounding: ToolName.AgentGrounding,
  'agent-grounding': ToolName.AgentGrounding,
  testability: ToolName.TestabilityIndex,
  'testability-index': ToolName.TestabilityIndex,
  'doc-drift': ToolName.DocDrift,
  'deps-health': ToolName.DependencyHealth,
  'dependency-health': ToolName.DependencyHealth,
  'change-amp': ToolName.ChangeAmplification,
  'change-amplification': ToolName.ChangeAmplification,
};

/**
 * Model context tiers for context-aware threshold calibration.
 */
export type ModelContextTier =
  | 'compact' // 4k-16k  tokens
  | 'standard' // 16k-64k tokens
  | 'extended' // 64k-200k
  | 'frontier'; // 200k+

/**
 * Scoring profiles for project-aware weighting adjustments.
 *
 * Different profiles prioritize different aspects of AI readiness based
 * on the project's primary focus.
 */
export enum ScoringProfile {
  Default = 'default',
  Agentic = 'agentic', // Focus on AI agent navigation and signal
  Logic = 'logic', // Focus on testability and complexity
  UI = 'ui', // Focus on consistency and context
  Cost = 'cost', // Focus on token waste reduction
  Security = 'security', // Focus on consistency and dependency health
}

/**
 * Project-type-aware tool weight presets for different profiles.
 */
export const SCORING_PROFILES: Record<
  ScoringProfile,
  Record<string, number>
> = {
  [ScoringProfile.Default]: DEFAULT_TOOL_WEIGHTS,
  [ScoringProfile.Agentic]: {
    [ToolName.AiSignalClarity]: 30,
    [ToolName.AgentGrounding]: 30,
    [ToolName.TestabilityIndex]: 20,
    [ToolName.ContextAnalyzer]: 10,
    [ToolName.NamingConsistency]: 10,
  },
  [ScoringProfile.Logic]: {
    [ToolName.TestabilityIndex]: 40,
    [ToolName.NamingConsistency]: 20,
    [ToolName.ContextAnalyzer]: 20,
    [ToolName.PatternDetect]: 10,
    [ToolName.ChangeAmplification]: 10,
  },
  [ScoringProfile.UI]: {
    [ToolName.NamingConsistency]: 30,
    [ToolName.ContextAnalyzer]: 30,
    [ToolName.PatternDetect]: 20,
    [ToolName.DocDrift]: 10,
    [ToolName.AiSignalClarity]: 10,
  },
  [ScoringProfile.Cost]: {
    [ToolName.PatternDetect]: 50,
    [ToolName.ContextAnalyzer]: 30,
    [ToolName.ChangeAmplification]: 10,
    [ToolName.DependencyHealth]: 10,
  },
  [ScoringProfile.Security]: {
    [ToolName.NamingConsistency]: 40,
    [ToolName.TestabilityIndex]: 30,
    [ToolName.DependencyHealth]: 20,
    [ToolName.ContextAnalyzer]: 10,
  },
};

/**
 * Context budget thresholds per tier.
 *
 * "Ideal" represents target state. "Critical" represents failure state.
 */
export const CONTEXT_TIER_THRESHOLDS: Record<
  ModelContextTier,
  {
    idealTokens: number;
    criticalTokens: number;
    idealDepth: number;
  }
> = {
  compact: { idealTokens: 3_000, criticalTokens: 10_000, idealDepth: 4 },
  standard: { idealTokens: 5_000, criticalTokens: 15_000, idealDepth: 5 },
  extended: { idealTokens: 15_000, criticalTokens: 50_000, idealDepth: 7 },
  frontier: { idealTokens: 50_000, criticalTokens: 150_000, idealDepth: 10 },
};

/**
 * Project-size-adjusted minimum thresholds.
 *
 * Larger projects have slightly lower thresholds due to inherent complexity.
 */
export const SIZE_ADJUSTED_THRESHOLDS: Record<string, number> = {
  xs: 80, // < 50 files
  small: 75, // 50-200 files
  medium: 70, // 200-500 files
  large: 65, // 500-2000 files
  enterprise: 58, // 2000+ files
};

/**
 * Determine project size tier based on the total number of files.
 *
 * @param fileCount Total number of files in the project
 * @returns A string identifier for the project size tier (xs, small, medium, large, enterprise)
 */
export function getProjectSizeTier(
  fileCount: number
): keyof typeof SIZE_ADJUSTED_THRESHOLDS {
  if (fileCount < 50) return 'xs';
  if (fileCount < 200) return 'small';
  if (fileCount < 500) return 'medium';
  if (fileCount < 2000) return 'large';
  return 'enterprise';
}

/**
 * Calculate the recommended minimum AI readiness threshold for a project.
 *
 * Threshold is adjusted based on project size and the model context tier targeted.
 *
 * @param fileCount Total number of files in the project
 * @param modelTier The model context tier targeted (compact, standard, extended, frontier)
 * @returns The recommended score threshold (0-100)
 */
export function getRecommendedThreshold(
  fileCount: number,
  modelTier: ModelContextTier = 'standard'
): number {
  const sizeTier = getProjectSizeTier(fileCount);
  const base = SIZE_ADJUSTED_THRESHOLDS[sizeTier];
  const modelBonus =
    modelTier === 'frontier' ? -3 : modelTier === 'extended' ? -2 : 0;
  return base + modelBonus;
}

/**
 * Normalize a tool name from a shorthand or alias to its canonical ID.
 *
 * @param shortName The tool shorthand or alias name
 * @returns The canonical tool ID
 */
export function normalizeToolName(shortName: string): string {
  return TOOL_NAME_MAP[shortName.toLowerCase()] || shortName;
}

/**
 * Retrieve the weight for a specific tool, considering overrides and profiles.
 *
 * @param toolName The canonical tool ID
 * @param toolConfig Optional configuration for the tool containing a weight
 * @param cliOverride Optional weight override from the CLI
 * @param profile Optional scoring profile to use
 * @returns The weight to be used for this tool in overall scoring
 */
export function getToolWeight(
  toolName: string,
  toolConfig?: { scoreWeight?: number },
  cliOverride?: number,
  profile: ScoringProfile = ScoringProfile.Default
): number {
  if (cliOverride !== undefined) return cliOverride;
  if (toolConfig?.scoreWeight !== undefined) return toolConfig.scoreWeight;

  const profileWeights = SCORING_PROFILES[profile] || DEFAULT_TOOL_WEIGHTS;
  return profileWeights[toolName] ?? DEFAULT_TOOL_WEIGHTS[toolName] ?? 5;
}

/**
 * Parse a comma-separated weight string from the CLI.
 *
 * Format: "tool1:weight1,tool2:weight2"
 *
 * @param weightStr The raw weight string from the CLI or config
 * @returns A Map of tool IDs to their parsed weights
 */
export function parseWeightString(weightStr?: string): Map<string, number> {
  const weights = new Map<string, number>();
  if (!weightStr) return weights;

  const pairs = weightStr.split(',');
  for (const pair of pairs) {
    const [toolShortName, weightValueStr] = pair.split(':');
    if (toolShortName && weightValueStr) {
      const toolName = normalizeToolName(toolShortName.trim());
      const weight = parseInt(weightValueStr.trim(), 10);
      if (!isNaN(weight) && weight > 0) {
        weights.set(toolName, weight);
      }
    }
  }
  return weights;
}

/**
 * Calculate the overall consolidated AI Readiness Score.
 *
 * Orchestrates the weighted aggregation of all tool individual scores.
 *
 * @param toolOutputs Map of tool IDs to their individual scoring outputs
 * @param config Optional global configuration
 * @param cliWeights Optional weight overrides from the CLI
 * @returns Consolidate ScoringResult including overall score and rating
 */
export function calculateOverallScore(
  toolOutputs: Map<string, ToolScoringOutput>,
  config?: any,
  cliWeights?: Map<string, number>
): ScoringResult {
  if (toolOutputs.size === 0) {
    throw new Error('No tool outputs provided for scoring');
  }

  // Determine profile from config or use default
  const profile =
    (config?.scoring?.profile as ScoringProfile) || ScoringProfile.Default;

  const weights = new Map<string, number>();
  for (const [toolName] of toolOutputs.entries()) {
    const cliWeight = cliWeights?.get(toolName);
    const configWeight = config?.tools?.[toolName]?.scoreWeight;
    const weight =
      cliWeight ??
      configWeight ??
      getToolWeight(toolName, undefined, undefined, profile);
    weights.set(toolName, weight);
  }

  let weightedSum = 0;
  let totalWeight = 0;

  const breakdown: ToolScoringOutput[] = [];
  const toolsUsed: string[] = [];
  const calculationWeights: Record<string, number> = {};

  for (const [toolName, output] of toolOutputs.entries()) {
    const weight = weights.get(toolName) || 5;
    weightedSum += output.score * weight;
    totalWeight += weight;
    toolsUsed.push(toolName);
    calculationWeights[toolName] = weight;
    breakdown.push(output);
  }

  const overall = Math.round(weightedSum / totalWeight);
  const rating = getRating(overall);

  const formulaParts = Array.from(toolOutputs.entries()).map(
    ([name, output]) => {
      const w = weights.get(name) || 5;
      return `(${output.score} × ${w})`;
    }
  );
  const formulaStr = `[${formulaParts.join(' + ')}] / ${totalWeight} = ${overall}`;

  return {
    overall,
    rating,
    timestamp: new Date().toISOString(),
    toolsUsed,
    breakdown,
    calculation: {
      formula: formulaStr,
      weights: calculationWeights,
      normalized: formulaStr,
    },
  };
}

/**
 * Convert numeric score to qualitative rating category.
 *
 * @param score The numerical AI readiness score (0-100)
 * @returns The corresponding ReadinessRating category
 */
export function getRating(score: number): ReadinessRating {
  if (score >= 90) return ReadinessRating.Excellent;
  if (score >= 75) return ReadinessRating.Good;
  if (score >= 60) return ReadinessRating.Fair;
  if (score >= 40) return ReadinessRating.NeedsWork;
  return ReadinessRating.Critical;
}

/**
 * Get a URL-friendly slug representing the rating category.
 *
 * @param score The numerical score
 * @returns A kebab-case string (e.g., 'excellent', 'needs-work')
 */
export function getRatingSlug(score: number): string {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'fair';
  if (score >= 40) return 'needs-work';
  return 'critical';
}

/**
 * Convert score to rating with project-size and model awareness.
 *
 * Provides a more accurate rating by considering the target model's limits.
 *
 * @param score The numerical AI readiness score
 * @param fileCount Total number of files in the project
 * @param modelTier The model context tier being targeted
 * @returns The size-aware ReadinessRating
 */
export function getRatingWithContext(
  score: number,
  fileCount: number,
  modelTier: ModelContextTier = 'standard'
): ReadinessRating {
  const threshold = getRecommendedThreshold(fileCount, modelTier);
  const normalized = score - threshold + 70;
  return getRating(normalized);
}

/**
 * Get display properties (emoji and color) for a given rating.
 *
 * @param rating The readiness rating category
 * @returns Object containing display emoji and color string
 */
export function getRatingDisplay(rating: ReadinessRating | string): {
  emoji: string;
  color: string;
} {
  switch (rating) {
    case ReadinessRating.Excellent:
      return { emoji: '✅', color: 'green' };
    case ReadinessRating.Good:
      return { emoji: '👍', color: 'blue' };
    case ReadinessRating.Fair:
      return { emoji: '⚠️', color: 'yellow' };
    case ReadinessRating.NeedsWork:
      return { emoji: '🔨', color: 'orange' };
    case ReadinessRating.Critical:
      return { emoji: '❌', color: 'red' };
    default:
      return { emoji: '❓', color: 'gray' };
  }
}

/**
 * Format overall score for compact console display.
 *
 * @param result The consolidated scoring result
 * @returns Formatted string (e.g., "85/100 (Good) 👍")
 */
export function formatScore(result: ScoringResult): string {
  const { emoji } = getRatingDisplay(result.rating as ReadinessRating);
  return `${result.overall}/100 (${result.rating}) ${emoji}`;
}

/**
 * Format detailed tool score for expanded console display.
 *
 * Includes breakdown of influencing factors and actionable recommendations.
 *
 * @param output The scoring output for a single tool
 * @returns Multi-line formatted string for console output
 */
export function formatToolScore(output: ToolScoringOutput): string {
  let result = `  Score: ${output.score}/100\n\n`;

  if (output.factors && output.factors.length > 0) {
    result += `  Factors:\n`;
    output.factors.forEach((factor) => {
      const impactSign = factor.impact > 0 ? '+' : '';
      result += `    • ${factor.name}: ${impactSign}${factor.impact} - ${factor.description}\n`;
    });
    result += '\n';
  }

  if (output.recommendations && output.recommendations.length > 0) {
    result += `  Recommendations:\n`;
    output.recommendations.forEach((rec, i) => {
      let priorityIcon = '🔵';
      const prio = rec.priority as string;
      if (prio === RecommendationPriority.High || prio === 'high')
        priorityIcon = '🔴';
      else if (prio === RecommendationPriority.Medium || prio === 'medium')
        priorityIcon = '🟡';

      result += `    ${i + 1}. ${priorityIcon} ${rec.action}\n`;
      result += `       Impact: +${rec.estimatedImpact} points\n\n`;
    });
  }

  return result;
}

/**
 * AI Readiness Scoring System
 *
 * Provides dynamic, composable scoring across multiple analysis tools.
 * Each tool contributes a 0-100 score with configurable weights.
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
    name: string;
    impact: number; // +/- points contribution
    description: string;
  }>;

  /** Actionable recommendations with estimated impact */
  recommendations: Array<{
    action: string;
    estimatedImpact: number; // +points if fixed
    priority: 'high' | 'medium' | 'low';
  }>;
}

export interface ScoringResult {
  /** Overall AI Readiness Score (0-100) */
  overall: number;

  /** Rating category */
  rating: 'Excellent' | 'Good' | 'Fair' | 'Needs Work' | 'Critical';

  /** Timestamp of score calculation */
  timestamp: string;

  /** Tools that contributed to this score */
  toolsUsed: string[];

  /** Breakdown by tool */
  breakdown: ToolScoringOutput[];

  /** Calculation details */
  calculation: {
    formula: string;
    weights: Record<string, number>;
    normalized: string;
  };
}

export interface ScoringConfig {
  /** Minimum passing score (exit code 1 if below) */
  threshold?: number;

  /** Show detailed breakdown in output */
  showBreakdown?: boolean;

  /** Path to baseline JSON for comparison */
  compareBaseline?: string;

  /** Auto-save score to this path */
  saveTo?: string;
}

/**
 * Default weights for known tools. Weights sum to 100 and read directly as
 * percentage contribution to the overall score.
 * New tools get weight of 5 if not specified.
 *
 * Weight philosophy:
 * - pattern-detect (22%): Semantic duplication directly wastes token budget and
 *   confuses AI with contradictory in-context examples.
 * - context-analyzer (19%): Context limits are the primary hard constraint on
 *   AI effectiveness regardless of model size.
 * - consistency (14%): Naming/pattern inconsistency degrades AI intent understanding
 *   proportionally to codebase size.
 * - ai-signal-clarity (11%): Code patterns empirically causing AI to generate
 *   confidently wrong outputs — critical for agentic use cases.
 * - agent-grounding (10%): How well an autonomous agent can navigate unaided —
 *   increasingly important as agentic workflows grow.
 * - testability (10%): AI changes without verifiability create hidden risk.
 * - doc-drift (8%): Stale docs actively mislead AI; planned spoke.
 * - deps (6%): Dependency health affects AI suggestion accuracy; planned spoke.
 */
export const DEFAULT_TOOL_WEIGHTS: Record<string, number> = {
  'pattern-detect': 22,
  'context-analyzer': 19,
  consistency: 14,
  'ai-signal-clarity': 11,
  'agent-grounding': 10,
  testability: 10,
  'doc-drift': 8,
  deps: 6,
};

/**
 * Tool name normalization map (shorthand -> full name)
 */
export const TOOL_NAME_MAP: Record<string, string> = {
  patterns: 'pattern-detect',
  context: 'context-analyzer',
  consistency: 'consistency',
  'AI signal clarity': 'ai-signal-clarity',
  'ai-signal-clarity': 'ai-signal-clarity',
  grounding: 'agent-grounding',
  'agent-grounding': 'agent-grounding',
  testability: 'testability',
  tests: 'testability',
  'doc-drift': 'doc-drift',
  docs: 'doc-drift',
  deps: 'deps',
};

/**
 * Model context tiers for context-aware threshold calibration.
 *
 * As AI models evolve from 32k → 128k → 1M+ context windows, absolute token
 * thresholds become meaningless. Use these tiers to adjust context-analyzer
 * thresholds relative to the model your team uses.
 */
export type ModelContextTier =
  | 'compact' // 4k-16k  tokens: GPT-3.5, older Codex
  | 'standard' // 16k-64k tokens: GPT-4, Claude 3 Haiku
  | 'extended' // 64k-200k: GPT-4o, Claude 3.5 Sonnet, Gemini 1.5 Pro
  | 'frontier'; // 200k+: Claude 3.5/3.7/4, Gemini 2.0/2.5, GPT-4.5+

/**
 * Context budget thresholds per tier.
 * Scores are interpolated between these boundaries.
 */
export const CONTEXT_TIER_THRESHOLDS: Record<
  ModelContextTier,
  {
    /** Below this → full score for context budget */
    idealTokens: number;
    /** Above this → critical penalty for context budget */
    criticalTokens: number;
    /** Suggested max import depth before penalty */
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
 * Large codebases structurally accrue more issues. A score of 65 in an
 * enterprise codebase is roughly equivalent to 75 in a small project.
 * These are recommended minimum passing thresholds by project size.
 */
export const SIZE_ADJUSTED_THRESHOLDS: Record<string, number> = {
  xs: 80, // < 50 files
  small: 75, // 50-200 files
  medium: 70, // 200-500 files
  large: 65, // 500-2000 files
  enterprise: 58, // 2000+ files
};

/**
 * Determine project size tier from file count
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
 * Get the recommended minimum threshold for a project
 */
export function getRecommendedThreshold(
  fileCount: number,
  modelTier: ModelContextTier = 'standard'
): number {
  const sizeTier = getProjectSizeTier(fileCount);
  const base = SIZE_ADJUSTED_THRESHOLDS[sizeTier];
  // Frontier models are more forgiving (higher context = better comprehension)
  const modelBonus =
    modelTier === 'frontier' ? -3 : modelTier === 'extended' ? -2 : 0;
  return base + modelBonus;
}

/**
 * Normalize tool name from shorthand to full name
 */
export function normalizeToolName(shortName: string): string {
  return TOOL_NAME_MAP[shortName] || shortName;
}

/**
 * Get tool weight with fallback priority:
 * 1. CLI override
 * 2. Tool config scoreWeight
 * 3. Default weight
 * 4. 10 (for unknown tools)
 */
export function getToolWeight(
  toolName: string,
  toolConfig?: { scoreWeight?: number },
  cliOverride?: number
): number {
  // CLI override has highest priority
  if (cliOverride !== undefined) {
    return cliOverride;
  }

  // Check tool's own config
  if (toolConfig?.scoreWeight !== undefined) {
    return toolConfig.scoreWeight;
  }

  // Fall back to defaults
  return DEFAULT_TOOL_WEIGHTS[toolName] || 5;
}

/**
 * Parse weight string from CLI (e.g., "patterns:50,context:30")
 */
export function parseWeightString(weightStr?: string): Map<string, number> {
  const weights = new Map<string, number>();

  if (!weightStr) {
    return weights;
  }

  const pairs = weightStr.split(',');
  for (const pair of pairs) {
    const [toolShortName, weightStr] = pair.split(':');
    if (toolShortName && weightStr) {
      const toolName = normalizeToolName(toolShortName.trim());
      const weight = parseInt(weightStr.trim(), 10);
      if (!isNaN(weight) && weight > 0) {
        weights.set(toolName, weight);
      }
    }
  }

  return weights;
}

/**
 * Calculate overall AI Readiness Score from multiple tool scores.
 *
 * Formula: Σ(tool_score × tool_weight) / Σ(active_tool_weights)
 *
 * This allows dynamic composition - score adjusts automatically
 * based on which tools actually ran.
 */
export function calculateOverallScore(
  toolOutputs: Map<string, ToolScoringOutput>,
  config?: any,
  cliWeights?: Map<string, number>
): ScoringResult {
  if (toolOutputs.size === 0) {
    throw new Error('No tool outputs provided for scoring');
  }

  // Build weights map with priority: CLI > config > defaults
  const weights = new Map<string, number>();
  for (const [toolName] of toolOutputs.entries()) {
    const cliWeight = cliWeights?.get(toolName);
    const configWeight = config?.tools?.[toolName]?.scoreWeight;
    const weight =
      cliWeight ?? configWeight ?? DEFAULT_TOOL_WEIGHTS[toolName] ?? 10;
    weights.set(toolName, weight);
  }

  // Calculate weighted sum and total weight
  let weightedSum = 0;
  let totalWeight = 0;

  const breakdown: ToolScoringOutput[] = [];
  const toolsUsed: string[] = [];
  const calculationWeights: Record<string, number> = {};

  for (const [toolName, output] of toolOutputs.entries()) {
    const weight = weights.get(toolName) || 10;
    const weightedScore = output.score * weight;

    weightedSum += weightedScore;
    totalWeight += weight;
    toolsUsed.push(toolName);
    calculationWeights[toolName] = weight;
    breakdown.push(output);
  }

  // Calculate final score
  const overall = Math.round(weightedSum / totalWeight);

  // Determine rating
  const rating = getRating(overall);

  // Build formula string
  const formulaParts = Array.from(toolOutputs.entries()).map(
    ([name, output]) => {
      const w = weights.get(name) || 10;
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
 * Convert numeric score to rating category
 */
export function getRating(score: number): ScoringResult['rating'] {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Needs Work';
  return 'Critical';
}

/**
 * Convert score to rating with project-size awareness.
 * Use this for display to give fairer assessment to large codebases.
 */
export function getRatingWithContext(
  score: number,
  fileCount: number,
  modelTier: ModelContextTier = 'standard'
): ScoringResult['rating'] {
  const threshold = getRecommendedThreshold(fileCount, modelTier);
  // Shift the rating bands based on size-adjusted threshold
  const normalized = score - threshold + 70; // 70 = inflection point for 'Fair'
  return getRating(normalized);
}

/**
 * Get rating emoji and color for display
 */
export function getRatingDisplay(rating: ScoringResult['rating']): {
  emoji: string;
  color: string;
} {
  switch (rating) {
    case 'Excellent':
      return { emoji: '✅', color: 'green' };
    case 'Good':
      return { emoji: '👍', color: 'blue' };
    case 'Fair':
      return { emoji: '⚠️', color: 'yellow' };
    case 'Needs Work':
      return { emoji: '🔨', color: 'orange' };
    case 'Critical':
      return { emoji: '❌', color: 'red' };
  }
}

/**
 * Format score for display with rating
 */
export function formatScore(result: ScoringResult): string {
  const { emoji, color } = getRatingDisplay(result.rating);
  return `${result.overall}/100 (${result.rating}) ${emoji}`;
}

/**
 * Format individual tool score for display
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
      const priorityIcon =
        rec.priority === 'high'
          ? '🔴'
          : rec.priority === 'medium'
            ? '🟡'
            : '🔵';
      result += `    ${i + 1}. ${priorityIcon} ${rec.action}\n`;
      result += `       Impact: +${rec.estimatedImpact} points\n\n`;
    });
  }

  return result;
}

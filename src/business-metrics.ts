/**
 * Business Value Metrics Module
 * 
 * Provides business-aligned metrics that quantify ROI and survive technology changes.
 * These metrics connect technical measurements to developer productivity and cost impact.
 */

import type { 
  CostConfig, 
  ProductivityImpact, 
  AcceptancePrediction,
  ComprehensionDifficulty,
} from './types';
import type { ToolScoringOutput } from './scoring';

/**
 * Default cost configuration
 * Based on GPT-4 pricing and typical team usage
 */
export const DEFAULT_COST_CONFIG: CostConfig = {
  pricePer1KTokens: 0.01,    // $0.01 per 1K tokens (GPT-4)
  queriesPerDevPerDay: 50,    // Average AI queries per developer
  developerCount: 5,          // Default team size
  daysPerMonth: 30,
};

/**
 * Severity time estimates (hours to fix)
 * Based on industry research on bug fixing times
 */
const SEVERITY_TIME_ESTIMATES = {
  critical: 4,   // Complex architectural issues
  major: 2,      // Significant refactoring needed
  minor: 0.5,    // Simple naming/style fixes
  info: 0.25,    // Documentation improvements
};

/**
 * Default hourly developer rate
 */
const DEFAULT_HOURLY_RATE = 75;

/**
 * Calculate estimated monthly cost of AI context waste
 * 
 * Formula: (tokenWaste / 1000) × pricePer1K × queriesPerDev × devCount × days
 */
export function calculateMonthlyCost(
  tokenWaste: number,
  config: Partial<CostConfig> = {}
): number {
  const cfg = { ...DEFAULT_COST_CONFIG, ...config };
  
  const tokensPerDay = tokenWaste * cfg.queriesPerDevPerDay;
  const tokensPerMonth = tokensPerDay * cfg.daysPerMonth;
  const cost = (tokensPerMonth / 1000) * cfg.pricePer1KTokens;
  
  return Math.round(cost * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate productivity impact from issues
 */
export function calculateProductivityImpact(
  issues: { severity: string }[],
  hourlyRate: number = DEFAULT_HOURLY_RATE
): ProductivityImpact {
  const counts = {
    critical: issues.filter(i => i.severity === 'critical').length,
    major: issues.filter(i => i.severity === 'major').length,
    minor: issues.filter(i => i.severity === 'minor').length,
    info: issues.filter(i => i.severity === 'info').length,
  };
  
  const hours = {
    critical: counts.critical * SEVERITY_TIME_ESTIMATES.critical,
    major: counts.major * SEVERITY_TIME_ESTIMATES.major,
    minor: counts.minor * SEVERITY_TIME_ESTIMATES.minor,
    info: counts.info * SEVERITY_TIME_ESTIMATES.info,
  };
  
  const totalHours = hours.critical + hours.major + hours.minor + hours.info;
  const totalCost = totalHours * hourlyRate;
  
  return {
    totalHours: Math.round(totalHours * 10) / 10,
    hourlyRate,
    totalCost: Math.round(totalCost),
    bySeverity: {
      critical: { hours: Math.round(hours.critical * 10) / 10, cost: Math.round(hours.critical * hourlyRate) },
      major: { hours: Math.round(hours.major * 10) / 10, cost: Math.round(hours.major * hourlyRate) },
      minor: { hours: Math.round(hours.minor * 10) / 10, cost: Math.round(hours.minor * hourlyRate) },
    },
  };
}

/**
 * Predict AI suggestion acceptance rate based on code quality
 * 
 * Research shows:
 * - High consistency correlates with 30%+ higher acceptance
 * - Low context budget improves understanding by ~40%
 * - Good naming patterns reduce clarification needs by 50%
 */
export function predictAcceptanceRate(
  toolOutputs: Map<string, ToolScoringOutput>
): AcceptancePrediction {
  const factors: AcceptancePrediction['factors'] = [];
  
  // Pattern detection impact
  const patterns = toolOutputs.get('pattern-detect');
  if (patterns) {
    const patternImpact = (patterns.score - 50) * 0.3; // ±15% based on score
    factors.push({
      name: 'Semantic Duplication',
      impact: Math.round(patternImpact),
    });
  }
  
  // Context analyzer impact
  const context = toolOutputs.get('context-analyzer');
  if (context) {
    const contextImpact = (context.score - 50) * 0.4; // ±20% - biggest factor
    factors.push({
      name: 'Context Efficiency',
      impact: Math.round(contextImpact),
    });
  }
  
  // Consistency impact
  const consistency = toolOutputs.get('consistency');
  if (consistency) {
    const consistencyImpact = (consistency.score - 50) * 0.3; // ±15%
    factors.push({
      name: 'Code Consistency',
      impact: Math.round(consistencyImpact),
    });
  }
  
  // Calculate base rate + factors
  const baseRate = 0.65; // 65% baseline acceptance
  const totalImpact = factors.reduce((sum, f) => sum + f.impact / 100, 0);
  const rate = Math.max(0.1, Math.min(0.95, baseRate + totalImpact));
  
  // Confidence based on data availability
  const confidence = toolOutputs.size >= 3 ? 0.8 : 
                     toolOutputs.size >= 2 ? 0.6 : 0.4;
  
  return {
    rate: Math.round(rate * 100) / 100,
    confidence,
    factors,
  };
}

/**
 * Calculate Comprehension Difficulty Index
 * 
 * A future-proof abstraction that normalizes multiple factors
 * into a single difficulty score. Lower = easier for AI.
 */
export function calculateComprehensionDifficulty(
  contextBudget: number,
  importDepth: number,
  fragmentation: number,
  consistencyScore: number,
  totalFiles: number
): ComprehensionDifficulty {
  // Normalize each factor to 0-100 scale where 100 = most difficult
  
  // Context budget factor (0-100)
  // <5000 = easy (0), >30000 = expert level (100)
  const budgetFactor = Math.min(100, Math.max(0, (contextBudget - 5000) / 250));
  
  // Import depth factor (0-100)
  // <5 = easy (0), >15 = expert (100)
  const depthFactor = Math.min(100, Math.max(0, (importDepth - 5) * 10));
  
  // Fragmentation factor (0-100)
  // <0.3 = well-organized (0), >0.7 = fragmented (100)
  const fragmentationFactor = Math.min(100, Math.max(0, (fragmentation - 0.3) * 250));
  
  // Consistency factor (inverse - low score = high difficulty)
  // 100 score = 0 difficulty, 0 score = 100 difficulty
  const consistencyFactor = Math.min(100, Math.max(0, 100 - consistencyScore));
  
  // File count factor - larger projects naturally harder
  // <50 files = trivial, >500 = enterprise scale
  const fileFactor = Math.min(100, Math.max(0, (totalFiles - 50) / 5));
  
  // Weighted average
  const score = Math.round(
    (budgetFactor * 0.35) +
    (depthFactor * 0.20) +
    (fragmentationFactor * 0.20) +
    (consistencyFactor * 0.15) +
    (fileFactor * 0.10)
  );
  
  // Determine rating
  let rating: ComprehensionDifficulty['rating'];
  if (score < 20) rating = 'trivial';
  else if (score < 40) rating = 'easy';
  else if (score < 60) rating = 'moderate';
  else if (score < 80) rating = 'difficult';
  else rating = 'expert';
  
  return {
    score,
    rating,
    factors: [
      {
        name: 'Context Budget',
        contribution: Math.round(budgetFactor * 0.35),
        description: `${Math.round(contextBudget)} tokens required`,
      },
      {
        name: 'Import Depth',
        contribution: Math.round(depthFactor * 0.20),
        description: `${importDepth.toFixed(1)} average levels`,
      },
      {
        name: 'Code Fragmentation',
        contribution: Math.round(fragmentationFactor * 0.20),
        description: `${(fragmentation * 100).toFixed(0)}% fragmentation`,
      },
      {
        name: 'Consistency',
        contribution: Math.round(consistencyFactor * 0.15),
        description: `${consistencyScore}/100 consistency score`,
      },
      {
        name: 'Project Scale',
        contribution: Math.round(fileFactor * 0.10),
        description: `${totalFiles} files analyzed`,
      },
    ],
  };
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost < 1) {
    return `$${cost.toFixed(2)}`;
  } else if (cost < 1000) {
    return `$${cost.toFixed(0)}`;
  } else {
    return `$${(cost / 1000).toFixed(1)}k`;
  }
}

/**
 * Format hours for display
 */
export function formatHours(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)}min`;
  } else if (hours < 8) {
    return `${hours.toFixed(1)}h`;
  } else if (hours < 40) {
    return `${Math.round(hours)}h`;
  } else {
    return `${(hours / 40).toFixed(1)} weeks`;
  }
}

/**
 * Format acceptance rate for display
 */
export function formatAcceptanceRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

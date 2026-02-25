/**
 * Business Value Metrics Module
 * 
 * Provides business-aligned metrics that quantify ROI and survive technology changes.
 * These metrics connect technical measurements to developer productivity and cost impact.
 * 
 * NEW in v0.11: Extended with temporal tracking, knowledge concentration, and 
 * technical debt interest calculations.
 */

import type { 
  CostConfig, 
  ProductivityImpact, 
  AcceptancePrediction,
  ComprehensionDifficulty,
} from './types';
import type { ToolScoringOutput } from './scoring';

// ============================================
// TEMPORAL TRACKING TYPES
// ============================================

/**
 * Historical score entry for trend tracking
 */
export interface ScoreHistoryEntry {
  timestamp: string;
  overallScore: number;
  breakdown: Record<string, number>;
  totalIssues: number;
  totalTokens: number;
}

/**
 * Trend analysis comparing current vs historical scores
 */
export interface ScoreTrend {
  direction: 'improving' | 'stable' | 'degrading';
  change30Days: number;
  change90Days: number;
  velocity: number; // points per week
  projectedScore: number; // 30-day projection
}

/**
 * Remediation velocity tracking
 */
export interface RemediationVelocity {
  issuesFixedThisWeek: number;
  avgIssuesPerWeek: number;
  trend: 'accelerating' | 'stable' | 'decelerating';
  estimatedCompletionWeeks: number;
}

// ============================================
// KNOWLEDGE CONCENTRATION TYPES
// ============================================

/**
 * Knowledge concentration risk - measures "bus factor" for AI training
 */
export interface KnowledgeConcentrationRisk {
  /** Overall risk score 0-100: higher = more risk */
  score: number;
  
  rating: 'low' | 'moderate' | 'high' | 'critical';
  
  /** Analysis details */
  analysis: {
    /** Files with unique concepts (only source) */
    uniqueConceptFiles: number;
    totalFiles: number;
    concentrationRatio: number;
    
    /** Key person dependencies (files only one person understands) */
    singleAuthorFiles: number;
    
    /** Orphan files (no dependencies) */
    orphanFiles: number;
  };
  
  /** Recommendations for reducing risk */
  recommendations: string[];
}

// ============================================
// TECHNICAL DEBT INTEREST TYPES
// ============================================

/**
 * Technical debt interest rate - cost of inaction over time
 */
export interface TechnicalDebtInterest {
  /** Monthly interest rate (% of principal adding up) */
  monthlyRate: number;
  
  /** Annual effective rate */
  annualRate: number;
  
  /** Principal (current technical debt cost) */
  principal: number;
  
  /** Projected debt in 6/12/24 months */
  projections: {
    months6: number;
    months12: number;
    months24: number;
  };
  
  /** Monthly cost of delay */
  monthlyCost: number;
}

/**
 * Detailed debt breakdown by category
 */
export interface DebtBreakdown {
  category: string;
  currentCost: number;
  monthlyGrowthRate: number;
  priority: 'high' | 'medium' | 'low';
  fixCost: number;
}

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

// ============================================
// TEMPORAL TRACKING FUNCTIONS
// ============================================

/**
 * Calculate score trend from historical data
 */
export function calculateScoreTrend(history: ScoreHistoryEntry[]): ScoreTrend {
  if (history.length < 2) {
    return {
      direction: 'stable',
      change30Days: 0,
      change90Days: 0,
      velocity: 0,
      projectedScore: history[0]?.overallScore || 100,
    };
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Get entries within time ranges
  const last30Days = history.filter(e => new Date(e.timestamp) >= thirtyDaysAgo);
  const last90Days = history.filter(e => new Date(e.timestamp) >= ninetyDaysAgo);

  // Calculate changes
  const currentScore = history[history.length - 1].overallScore;
  const thirtyDaysAgoScore = last30Days[0]?.overallScore || currentScore;
  const ninetyDaysAgoScore = last90Days[0]?.overallScore || thirtyDaysAgoScore;

  const change30Days = currentScore - thirtyDaysAgoScore;
  const change90Days = currentScore - ninetyDaysAgoScore;

  // Calculate velocity (points per week)
  const weeksOfData = Math.max(1, history.length / 7);
  const totalChange = currentScore - history[0].overallScore;
  const velocity = totalChange / weeksOfData;

  // Determine direction
  let direction: ScoreTrend['direction'];
  if (change30Days > 3) direction = 'improving';
  else if (change30Days < -3) direction = 'degrading';
  else direction = 'stable';

  // Project score 30 days out
  const projectedScore = Math.max(0, Math.min(100, currentScore + (velocity * 4)));

  return {
    direction,
    change30Days,
    change90Days,
    velocity: Math.round(velocity * 10) / 10,
    projectedScore: Math.round(projectedScore),
  };
}

/**
 * Calculate remediation velocity
 */
export function calculateRemediationVelocity(
  history: ScoreHistoryEntry[],
  currentIssues: number
): RemediationVelocity {
  if (history.length < 2) {
    return {
      issuesFixedThisWeek: 0,
      avgIssuesPerWeek: 0,
      trend: 'stable',
      estimatedCompletionWeeks: currentIssues > 0 ? Infinity : 0,
    };
  }

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Issues fixed this week
  const thisWeek = history.filter(e => new Date(e.timestamp) >= oneWeekAgo);
  const lastWeek = history.filter(e => 
    new Date(e.timestamp) >= twoWeeksAgo && new Date(e.timestamp) < oneWeekAgo
  );
  
  const issuesFixedThisWeek = thisWeek.length > 1 
    ? thisWeek[0].totalIssues - thisWeek[thisWeek.length - 1].totalIssues 
    : 0;

  // Average issues per week over history
  const totalIssuesFixed = history[0].totalIssues - history[history.length - 1].totalIssues;
  const weeksOfData = Math.max(1, history.length / 7);
  const avgIssuesPerWeek = totalIssuesFixed / weeksOfData;

  // Determine trend
  let trend: RemediationVelocity['trend'];
  if (lastWeek.length > 1) {
    const lastWeekFixed = lastWeek[0].totalIssues - lastWeek[lastWeek.length - 1].totalIssues;
    if (issuesFixedThisWeek > lastWeekFixed * 1.2) trend = 'accelerating';
    else if (issuesFixedThisWeek < lastWeekFixed * 0.8) trend = 'decelerating';
    else trend = 'stable';
  } else {
    trend = 'stable';
  }

  // Estimated completion
  const estimatedCompletionWeeks = avgIssuesPerWeek > 0 
    ? Math.ceil(currentIssues / avgIssuesPerWeek) 
    : Infinity;

  return {
    issuesFixedThisWeek: Math.max(0, issuesFixedThisWeek),
    avgIssuesPerWeek: Math.round(avgIssuesPerWeek * 10) / 10,
    trend,
    estimatedCompletionWeeks,
  };
}

// ============================================
// KNOWLEDGE CONCENTRATION FUNCTIONS
// ============================================

/**
 * Calculate knowledge concentration risk
 * 
 * This measures how "centralized" knowledge is in the codebase,
 * similar to bus factor but for AI/ML training purposes.
 */
export function calculateKnowledgeConcentration(
  files: {
    path: string;
    exports: number;
    imports: number;
  }[],
  authorData?: Map<string, string[]> // author -> files they authored
): KnowledgeConcentrationRisk {
  if (files.length === 0) {
    return {
      score: 0,
      rating: 'low',
      analysis: {
        uniqueConceptFiles: 0,
        totalFiles: 0,
        concentrationRatio: 0,
        singleAuthorFiles: 0,
        orphanFiles: 0,
      },
      recommendations: ['No files to analyze'],
    };
  }

  // Identify orphan files (few imports, few exports - isolated)
  const orphanFiles = files.filter(f => f.exports < 2 && f.imports < 2).length;
  
  // Identify unique concept files (high export count)
  const avgExports = files.reduce((sum, f) => sum + f.exports, 0) / files.length;
  const uniqueConceptFiles = files.filter(f => f.exports > avgExports * 2).length;
  
  // Calculate concentration ratio
  const totalExports = files.reduce((sum, f) => sum + f.exports, 0);
  const concentrationRatio = totalExports > 0 
    ? uniqueConceptFiles / files.length 
    : 0;

  // Single author files (if author data available)
  let singleAuthorFiles = 0;
  if (authorData) {
    for (const files of authorData.values()) {
      if (files.length === 1) singleAuthorFiles++;
    }
  }

  // Calculate risk score (0-100)
  // Higher score = more risk
  const orphanRisk = (orphanFiles / files.length) * 30;
  const uniqueRisk = concentrationRatio * 40;
  const singleAuthorRisk = authorData ? (singleAuthorFiles / files.length) * 30 : 0;
  
  const score = Math.min(100, Math.round(orphanRisk + uniqueRisk + singleAuthorRisk));

  // Determine rating
  let rating: KnowledgeConcentrationRisk['rating'];
  if (score < 20) rating = 'low';
  else if (score < 40) rating = 'moderate';
  else if (score < 70) rating = 'high';
  else rating = 'critical';

  // Generate recommendations
  const recommendations: string[] = [];
  if (orphanFiles > files.length * 0.2) {
    recommendations.push(`Reduce ${orphanFiles} orphan files by connecting them to main modules`);
  }
  if (uniqueConceptFiles > files.length * 0.1) {
    recommendations.push('Distribute high-export files into more focused modules');
  }
  if (authorData && singleAuthorFiles > files.length * 0.3) {
    recommendations.push('Increase knowledge sharing to reduce single-author dependencies');
  }

  return {
    score,
    rating,
    analysis: {
      uniqueConceptFiles,
      totalFiles: files.length,
      concentrationRatio: Math.round(concentrationRatio * 100) / 100,
      singleAuthorFiles,
      orphanFiles,
    },
    recommendations,
  };
}

// ============================================
// TECHNICAL DEBT INTEREST FUNCTIONS
// ============================================

/**
 * Calculate technical debt interest rate
 * 
 * The key insight: technical debt compounds over time.
 * Each month, issues grow by a certain rate due to:
 * - New code inheriting patterns
 * - Context budget growing
 * - Duplication spreading
 */
export function calculateTechnicalDebtInterest(params: {
  currentMonthlyCost: number;
  issues: { severity: string }[];
  monthsOpen: number;
}): TechnicalDebtInterest {
  const { currentMonthlyCost, issues, monthsOpen } = params;
  
  // Base interest rate varies by severity mix
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const majorCount = issues.filter(i => i.severity === 'major').length;
  const minorCount = issues.filter(i => i.severity === 'minor').length;
  
  // Higher severity concentration = higher interest rate
  const severityWeight = (criticalCount * 3 + majorCount * 2 + minorCount * 1) / Math.max(1, issues.length);
  const baseRate = 0.02 + (severityWeight * 0.01); // 2-5% monthly base
  
  // Monthly rate increases with time open (accelerating debt)
  const timeMultiplier = Math.max(1, 1 + (monthsOpen * 0.1));
  const monthlyRate = baseRate * timeMultiplier;
  
  // Projected growth
  const projectDebt = (principal: number, months: number) => {
    let debt = principal;
    for (let i = 0; i < months; i++) {
      debt = debt * (1 + monthlyRate);
    }
    return Math.round(debt);
  };

  const principal = currentMonthlyCost * 12; // Annualize for principal
  const projections = {
    months6: projectDebt(principal, 6),
    months12: projectDebt(principal, 12),
    months24: projectDebt(principal, 24),
  };

  return {
    monthlyRate: Math.round(monthlyRate * 10000) / 100,
    annualRate: Math.round(((Math.pow(1 + monthlyRate, 12) - 1) * 10000)) / 100,
    principal,
    projections,
    monthlyCost: Math.round(currentMonthlyCost * (1 + monthlyRate) * 100) / 100,
  };
}

/**
 * Get debt breakdown by category
 */
export function getDebtBreakdown(
  patternCost: number,
  contextCost: number,
  consistencyCost: number
): DebtBreakdown[] {
  const breakdowns: DebtBreakdown[] = [
    {
      category: 'Semantic Duplication',
      currentCost: patternCost,
      monthlyGrowthRate: 5, // Grows as devs copy-paste
      priority: patternCost > 1000 ? 'high' : 'medium',
      fixCost: patternCost * 3, // Fixing costs 3x current waste
    },
    {
      category: 'Context Fragmentation',
      currentCost: contextCost,
      monthlyGrowthRate: 3, // Grows with new features
      priority: contextCost > 500 ? 'high' : 'medium',
      fixCost: contextCost * 2.5,
    },
    {
      category: 'Consistency Issues',
      currentCost: consistencyCost,
      monthlyGrowthRate: 2, // Grows with new devs
      priority: consistencyCost > 200 ? 'medium' : 'low',
      fixCost: consistencyCost * 1.5,
    },
  ];

  return breakdowns.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

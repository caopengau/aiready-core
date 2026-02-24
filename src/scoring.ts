import { 
  calculateMonthlyCost, 
  calculateProductivityImpact,
  DEFAULT_COST_CONFIG,
  type CostConfig 
} from '@aiready/core';
import type { ToolScoringOutput } from '@aiready/core';
import type { ContextSummary } from './types';

/**
 * Calculate AI Readiness Score for context efficiency (0-100)
 * 
 * Based on:
 * - Average context budget (tokens needed to understand files)
 * - Import depth (dependency chain length)
 * - Fragmentation score (code organization)
 * - Critical/major issues
 * 
 * Includes business value metrics:
 * - Estimated monthly cost of context waste
 * - Estimated developer hours to fix
 */
export function calculateContextScore(
  summary: ContextSummary,
  costConfig?: Partial<CostConfig>
): ToolScoringOutput {
  const {
    avgContextBudget,
    maxContextBudget,
    avgImportDepth,
    maxImportDepth,
    avgFragmentation,
    criticalIssues,
    majorIssues,
  } = summary;
  
  // Context budget scoring (40% weight in final score)
  // Ideal: <5000 tokens avg = 100
  // Acceptable: 5000-10000 = 90-70
  // High: 10000-20000 = 70-40
  // Critical: >20000 = <40
  const budgetScore = avgContextBudget < 5000 
    ? 100
    : Math.max(0, 100 - (avgContextBudget - 5000) / 150);
  
  // Import depth scoring (30% weight)
  // Ideal: <5 avg = 100
  // Acceptable: 5-8 = 80-60
  // Deep: >8 = <60
  const depthScore = avgImportDepth < 5
    ? 100
    : Math.max(0, 100 - (avgImportDepth - 5) * 10);
  
  // Fragmentation scoring (30% weight)
  // Well-organized: <0.3 = 100
  // Moderate: 0.3-0.5 = 80-60
  // Fragmented: >0.5 = <60
  const fragmentationScore = avgFragmentation < 0.3
    ? 100
    : Math.max(0, 100 - (avgFragmentation - 0.3) * 200);
  
  // Issue penalties
  const criticalPenalty = criticalIssues * 10;
  const majorPenalty = majorIssues * 3;
  
  // Max budget penalty (if any single file is extreme)
  const maxBudgetPenalty = maxContextBudget > 15000 
    ? Math.min(20, (maxContextBudget - 15000) / 500)
    : 0;
  
  // Weighted average of subscores
  const rawScore = (budgetScore * 0.4) + (depthScore * 0.3) + (fragmentationScore * 0.3);
  const finalScore = rawScore - criticalPenalty - majorPenalty - maxBudgetPenalty;
  
  const score = Math.max(0, Math.min(100, Math.round(finalScore)));
  
  // Build factors array
  const factors = [
    {
      name: 'Context Budget',
      impact: Math.round((budgetScore * 0.4) - 40),
      description: `Avg ${Math.round(avgContextBudget)} tokens per file ${avgContextBudget < 5000 ? '(excellent)' : avgContextBudget < 10000 ? '(acceptable)' : '(high)'}`,
    },
    {
      name: 'Import Depth',
      impact: Math.round((depthScore * 0.3) - 30),
      description: `Avg ${avgImportDepth.toFixed(1)} levels ${avgImportDepth < 5 ? '(excellent)' : avgImportDepth < 8 ? '(acceptable)' : '(deep)'}`,
    },
    {
      name: 'Fragmentation',
      impact: Math.round((fragmentationScore * 0.3) - 30),
      description: `${(avgFragmentation * 100).toFixed(0)}% fragmentation ${avgFragmentation < 0.3 ? '(well-organized)' : avgFragmentation < 0.5 ? '(moderate)' : '(high)'}`,
    },
  ];
  
  if (criticalIssues > 0) {
    factors.push({
      name: 'Critical Issues',
      impact: -criticalPenalty,
      description: `${criticalIssues} critical context issue${criticalIssues > 1 ? 's' : ''}`,
    });
  }
  
  if (majorIssues > 0) {
    factors.push({
      name: 'Major Issues',
      impact: -majorPenalty,
      description: `${majorIssues} major context issue${majorIssues > 1 ? 's' : ''}`,
    });
  }
  
  if (maxBudgetPenalty > 0) {
    factors.push({
      name: 'Extreme File Detected',
      impact: -Math.round(maxBudgetPenalty),
      description: `One file requires ${Math.round(maxContextBudget)} tokens (very high)`,
    });
  }
  
  // Generate recommendations
  const recommendations: ToolScoringOutput['recommendations'] = [];
  
  if (avgContextBudget > 10000) {
    const estimatedImpact = Math.min(15, Math.round((avgContextBudget - 10000) / 1000));
    recommendations.push({
      action: 'Reduce file dependencies to lower context requirements',
      estimatedImpact,
      priority: 'high',
    });
  }
  
  if (avgImportDepth > 8) {
    const estimatedImpact = Math.min(10, Math.round((avgImportDepth - 8) * 2));
    recommendations.push({
      action: 'Flatten import chains to reduce depth',
      estimatedImpact,
      priority: avgImportDepth > 10 ? 'high' : 'medium',
    });
  }
  
  if (avgFragmentation > 0.5) {
    const estimatedImpact = Math.min(12, Math.round((avgFragmentation - 0.5) * 40));
    recommendations.push({
      action: 'Consolidate related code into cohesive modules',
      estimatedImpact,
      priority: 'medium',
    });
  }
  
  if (maxContextBudget > 20000) {
    recommendations.push({
      action: `Split large file (${Math.round(maxContextBudget)} tokens) into smaller modules`,
      estimatedImpact: 8,
      priority: 'high',
    });
  }
  
  // Calculate business value metrics
  const cfg = { ...DEFAULT_COST_CONFIG, ...costConfig };
  // Total context budget across all files
  const totalContextBudget = avgContextBudget * summary.totalFiles;
  const estimatedMonthlyCost = calculateMonthlyCost(totalContextBudget, cfg);
  
  // Convert issues to format for productivity calculation
  const issues = [
    ...Array(criticalIssues).fill({ severity: 'critical' as const }),
    ...Array(majorIssues).fill({ severity: 'major' as const }),
  ];
  const productivityImpact = calculateProductivityImpact(issues);
  
  return {
    toolName: 'context-analyzer',
    score,
    rawMetrics: {
      avgContextBudget: Math.round(avgContextBudget),
      maxContextBudget: Math.round(maxContextBudget),
      avgImportDepth: Math.round(avgImportDepth * 10) / 10,
      maxImportDepth,
      avgFragmentation: Math.round(avgFragmentation * 100) / 100,
      criticalIssues,
      majorIssues,
      // Business value metrics
      estimatedMonthlyCost,
      estimatedDeveloperHours: productivityImpact.totalHours,
    },
    factors,
    recommendations,
  };
}

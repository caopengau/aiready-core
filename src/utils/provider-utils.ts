import type { AnalysisResult } from '../types';
import type { ToolScoringOutput } from '../scoring';

/**
 * Groups a flat array of issues by their `location.file` path into the
 * `AnalysisResult[]` shape expected by `SpokeOutputSchema`.
 *
 * Shared across multiple spoke providers that follow the simple analyze → group
 * → schema-parse pattern (doc-drift, deps, etc.).
 */
export function groupIssuesByFile(issues: any[]): AnalysisResult[] {
  const fileIssuesMap = new Map<string, any[]>();
  for (const issue of issues) {
    const file = issue.location?.file ?? 'unknown';
    if (!fileIssuesMap.has(file)) fileIssuesMap.set(file, []);
    fileIssuesMap.get(file)!.push(issue);
  }
  return Array.from(fileIssuesMap.entries()).map(([fileName, issueList]) => ({
    fileName,
    issues: issueList,
    metrics: {},
  }));
}

/**
 * Builds a simple `ToolScoringOutput` from a spoke summary object.
 * Shared across providers whose scoring logic is purely pass-through
 * (score and recommendations are already computed in the analyzer).
 */
export function buildSimpleProviderScore(
  toolName: string,
  summary: any,
  rawData: any = {}
): ToolScoringOutput {
  return {
    toolName,
    score: summary.score ?? 0,
    rawMetrics: { ...summary, ...rawData },
    factors: [],
    recommendations: (summary.recommendations ?? []).map((action: string) => ({
      action,
      estimatedImpact: 5,
      priority: 'medium' as const,
    })),
  };
}

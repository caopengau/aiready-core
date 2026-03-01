import { Issue } from '../providers/issuesProvider';

export interface AIReadyResult {
  summary: {
    totalIssues: number;
    toolsRun: string[];
    executionTime: number;
  };
  scoring?: {
    overall: number;
    rating: string;
    timestamp: string;
    toolsUsed: string[];
    breakdown?: Array<{
      toolName: string;
      score: number;
      rating?: string;
      rawMetrics?: Record<string, any>;
      factors?: Array<{
        name: string;
        impact: number;
        description: string;
      }>;
      recommendations?: Array<{
        action: string;
        estimatedImpact: number;
        priority: string;
      }>;
    }>;
  };
  patterns?: Array<{
    fileName: string;
    issues: Array<{
      type: string;
      severity: 'critical' | 'major' | 'minor' | 'info';
      message: string;
      location: {
        file: string;
        line?: number;
      };
      suggestion?: string;
    }>;
    metrics?: {
      tokenCost: number;
      consistencyScore: number;
    };
  }>;
  context?: Array<{
    severity: 'critical' | 'major' | 'minor' | 'info';
    message: string;
    location?: {
      file: string;
      line?: number;
    };
    issues?: Array<{
      severity: 'critical' | 'major' | 'minor' | 'info';
      message: string;
      location?: {
        file: string;
        line?: number;
      };
    }>;
  }>;
  consistency?: {
    summary: {
      totalIssues: number;
      filesAnalyzed: number;
    };
    results?: Array<{
      file: string;
      issues: Array<{
        severity: 'critical' | 'major' | 'minor' | 'info';
        message: string;
        location?: {
          file: string;
          line?: number;
        };
      }>;
    }>;
  };
  docDrift?: {
    issues: Array<{
      severity: 'critical' | 'major' | 'minor' | 'info';
      message: string;
      location?: {
        file: string;
        line?: number;
      };
    }>;
  };
  deps?: {
    issues: Array<{
      severity: 'critical' | 'major' | 'minor' | 'info';
      message: string;
      location?: {
        file: string;
        line?: number;
      };
    }>;
  };
  duplicates?: any[];
}

/**
 * Derive rating from score
 */
export function getRatingFromScore(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 70) return 'Fair';
  if (score >= 60) return 'Needs Work';
  return 'Critical';
}

/**
 * Count issues by severity from all tools
 */
export function countIssues(result: AIReadyResult): {
  critical: number;
  major: number;
  minor: number;
  info: number;
  total: number;
} {
  const counts = { critical: 0, major: 0, minor: 0, info: 0, total: 0 };

  // Count pattern issues
  result.patterns?.forEach((p) => {
    p.issues?.forEach((issue) => {
      counts[issue.severity] = (counts[issue.severity] || 0) + 1;
      counts.total++;
    });
  });

  // Count context issues
  result.context?.forEach((issue: any) => {
    // Some formats have root level issues, some have nested
    if (issue.severity) {
      counts[issue.severity as keyof typeof counts] =
        (counts[issue.severity as keyof typeof counts] || 0) + 1;
      counts.total++;
    }
    issue.issues?.forEach((nested: any) => {
      counts[nested.severity as keyof typeof counts] =
        (counts[nested.severity as keyof typeof counts] || 0) + 1;
      counts.total++;
    });
  });

  // Count consistency issues
  result.consistency?.results?.forEach((r) => {
    r.issues?.forEach((issue) => {
      counts[issue.severity] = (counts[issue.severity] || 0) + 1;
      counts.total++;
    });
  });

  // Count doc drift issues
  result.docDrift?.issues?.forEach((issue) => {
    counts[issue.severity] = (counts[issue.severity] || 0) + 1;
    counts.total++;
  });

  // Count dependency issues
  result.deps?.issues?.forEach((issue) => {
    counts[issue.severity] = (counts[issue.severity] || 0) + 1;
    counts.total++;
  });

  return counts;
}

/**
 * Collect all issues into a flat array for the provider
 */
export function collectAllIssues(result: AIReadyResult): Issue[] {
  return [
    ...(result.patterns?.flatMap((p: any) =>
      (p.issues || []).map((issue: any) => ({ ...issue, tool: 'patterns' }))
    ) || []),
    ...(result.context?.flatMap((issue: any) => {
      const results = [];
      if (issue.severity) {
        results.push({ ...issue, tool: 'context' });
      }
      if (issue.issues) {
        results.push(
          ...issue.issues.map((i: any) => ({ ...i, tool: 'context' }))
        );
      }
      return results;
    }) || []),
    ...(result.consistency?.results?.flatMap((r: any) =>
      (r.issues || []).map((issue: any) => ({
        ...issue,
        tool: 'consistency',
      }))
    ) || []),
    ...(result.docDrift?.issues?.map((issue: any) => ({
      ...issue,
      tool: 'doc-drift',
    })) || []),
    ...(result.deps?.issues?.map((issue: any) => ({
      ...issue,
      tool: 'deps-health',
    })) || []),
  ];
}

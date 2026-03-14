import {
  scanFiles,
  Severity,
  IssueType,
  GLOBAL_SCAN_OPTIONS,
  getSeverityLevel,
} from '@aiready/core';
import type { AnalysisResult, Issue } from '@aiready/core';
import type {
  ConsistencyOptions,
  ConsistencyReport,
  ConsistencyIssue,
} from './types';
import { analyzeNamingAST } from './analyzers/naming-ast';
import { analyzeNamingGeneralized } from './analyzers/naming-generalized';
import { analyzePatterns } from './analyzers/patterns';

/**
 * Main consistency analyzer that orchestrates all analysis types
 * Supports: TypeScript, JavaScript, Python, Java, C#, Go
 */
export async function analyzeConsistency(
  options: ConsistencyOptions
): Promise<ConsistencyReport> {
  const {
    checkNaming = true,
    checkPatterns = true,
    checkArchitecture = false, // Not implemented yet
    minSeverity = Severity.Info,
    ...scanOptions
  } = options;

  // Mark intentionally-unused option to avoid lint warnings
  void checkArchitecture;

  // Scan files
  const filePaths = await scanFiles(scanOptions);

  // Collect issues by category
  let namingIssues: any[] = [];
  if (checkNaming) {
    // 1. Generalized naming analysis for all supported files
    namingIssues = await analyzeNamingGeneralized(filePaths);

    // 2. Targeted deep AST analysis for TS/JS (handled by specialized analyzer)
    const tsJsFiles = filePaths.filter((f) => /\.(ts|tsx|js|jsx)$/i.test(f));
    if (tsJsFiles.length > 0) {
      const deepTsIssues = await analyzeNamingAST(tsJsFiles);
      // Merge issues, avoiding duplicates for exports if already checked
      namingIssues = [...namingIssues, ...deepTsIssues];
    }
  }

  const patternIssues = checkPatterns ? await analyzePatterns(filePaths) : [];

  // Convert to AnalysisResult format
  const results: AnalysisResult[] = [];
  const fileIssuesMap = new Map<string, ConsistencyIssue[]>();

  // Process naming issues
  for (const issue of namingIssues) {
    if (!shouldIncludeSeverity(issue.severity, minSeverity)) continue;

    const fileName =
      (issue as any).fileName || (issue as any).file || (issue as any).filePath;
    if (!fileIssuesMap.has(fileName)) fileIssuesMap.set(fileName, []);
    fileIssuesMap.get(fileName)!.push(issue as unknown as ConsistencyIssue);
  }

  // Process pattern issues
  for (const issue of patternIssues) {
    if (!shouldIncludeSeverity(issue.severity, minSeverity)) continue;

    const fileName =
      (issue as any).fileName || (issue as any).file || (issue as any).filePath;
    if (!fileIssuesMap.has(fileName)) fileIssuesMap.set(fileName, []);
    fileIssuesMap.get(fileName)!.push(issue as unknown as ConsistencyIssue);
  }

  // Build final results
  for (const [fileName, issues] of fileIssuesMap.entries()) {
    results.push({
      fileName,
      issues: issues.map((i) => ({
        type: i.type as IssueType,
        severity: i.severity as Severity,
        message: i.message,
        location: i.location,
        suggestion: (i as any).suggestion,
      })),
      metrics: {
        consistencyScore: calculateConsistencyScore(issues),
      },
    });
  }

  return {
    results,
    summary: {
      filesAnalyzed: filePaths.length,
      totalIssues: results.reduce((acc, r) => acc + r.issues.length, 0),
      namingIssues: namingIssues.length,
      patternIssues: patternIssues.length,
      architectureIssues: 0,
    },
    recommendations: [],
    metadata: {
      toolName: 'naming-consistency',
      timestamp: new Date().toISOString(),
    },
  } as unknown as ConsistencyReport;
}

function shouldIncludeSeverity(
  severity: Severity | string,
  minSeverity: Severity | string
): boolean {
  return getSeverityLevel(severity) >= getSeverityLevel(minSeverity);
}

function calculateConsistencyScore(issues: ConsistencyIssue[]): number {
  let totalWeight = 0;
  for (const issue of issues) {
    const val = getSeverityLevel(issue.severity);
    switch (val) {
      case 4:
        totalWeight += 10;
        break;
      case 3:
        totalWeight += 5;
        break;
      case 2:
        totalWeight += 2;
        break;
      case 1:
        totalWeight += 1;
        break;
      default:
        totalWeight += 1;
    }
  }
  // Score from 0-1, where 1 is perfect
  return Math.max(0, 1 - totalWeight / 100);
}

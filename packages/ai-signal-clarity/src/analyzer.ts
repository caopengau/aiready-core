/**
 * Main analyzer for AI signal clarity.
 * Scans all TS/JS files in a directory and aggregates signals.
 */

import {
  scanFiles,
  calculateAiSignalClarity,
  Severity,
  emitProgress,
} from '@aiready/core';
import { scanFile } from './scanner';
import type {
  AiSignalClarityOptions,
  AiSignalClarityReport,
  FileAiSignalClarityResult,
} from './types';

export async function analyzeAiSignalClarity(
  options: AiSignalClarityOptions
): Promise<AiSignalClarityReport> {
  // Use core scanFiles which respects .gitignore recursively
  const files = await scanFiles(options);
  const results: FileAiSignalClarityResult[] = [];

  // Aggregate signals
  const aggregate = {
    magicLiterals: 0,
    booleanTraps: 0,
    ambiguousNames: 0,
    undocumentedExports: 0,
    implicitSideEffects: 0,
    deepCallbacks: 0,
    overloadedSymbols: 0,
    largeFiles: 0,
    totalSymbols: 0,
    totalExports: 0,
    totalLines: 0,
  };

  let processed = 0;
  for (const filePath of files) {
    processed++;
    emitProgress(
      processed,
      files.length,
      'ai-signal-clarity',
      'analyzing files',
      options.onProgress
    );

    const result = await scanFile(filePath, options);
    results.push(result);
    for (const key of Object.keys(aggregate) as Array<keyof typeof aggregate>) {
      aggregate[key] += (result.signals as any)[key] ?? 0;
    }
  }

  // Calculate grounding score using core math (statically imported)
  const riskResult = calculateAiSignalClarity({
    overloadedSymbols: aggregate.overloadedSymbols,
    magicLiterals: aggregate.magicLiterals,
    booleanTraps: aggregate.booleanTraps,
    implicitSideEffects: aggregate.implicitSideEffects,
    deepCallbacks: aggregate.deepCallbacks,
    ambiguousNames: aggregate.ambiguousNames,
    undocumentedExports: aggregate.undocumentedExports,
    largeFiles: aggregate.largeFiles,
    totalSymbols: Math.max(1, aggregate.totalSymbols),
    totalExports: Math.max(1, aggregate.totalExports),
  });

  // Helper for severity mapping
  const getLevel = (s: any): number => {
    if (s === Severity.Critical || s === 'critical') return 4;
    if (s === Severity.Major || s === 'major') return 3;
    if (s === Severity.Minor || s === 'minor') return 2;
    if (s === Severity.Info || s === 'info') return 1;
    return 0;
  };

  // Count severities
  const allIssues = results.flatMap((r) => r.issues);
  const criticalSignals = allIssues.filter(
    (i) => getLevel(i.severity) === 4
  ).length;
  const majorSignals = allIssues.filter(
    (i) => getLevel(i.severity) === 3
  ).length;
  const minorSignals = allIssues.filter(
    (i) => getLevel(i.severity) === 2
  ).length;

  // Filter by minSeverity
  const minSev = options.minSeverity ?? Severity.Info;
  const filteredResults = results.map((r) => ({
    ...r,
    issues: r.issues.filter((i) => getLevel(i.severity) >= getLevel(minSev)),
  }));

  return {
    summary: {
      filesAnalyzed: files.length,
      totalSignals: allIssues.length,
      criticalSignals,
      majorSignals,
      minorSignals,
      topRisk: riskResult.topRisk,
      rating: riskResult.rating,
    },
    results: filteredResults,
    aggregateSignals: aggregate,
    recommendations: riskResult.recommendations,
  };
}

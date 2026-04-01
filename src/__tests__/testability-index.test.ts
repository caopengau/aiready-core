import { describe, it, expect } from 'vitest';
import { calculateTestabilityIndex } from '../metrics/testability-index';

describe('Testability Index', () => {
  it('should calculate an excellent score for highly testable code', () => {
    const result = calculateTestabilityIndex({
      testFiles: 10,
      sourceFiles: 10,
      pureFunctions: 90,
      totalFunctions: 100,
      injectionPatterns: 5,
      totalClasses: 5,
      bloatedInterfaces: 0,
      totalInterfaces: 10,
      externalStateMutations: 5,
      hasTestFramework: true,
    });

    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.rating).toBe('excellent');
    expect(result.aiChangeSafetyRating).toBe('safe');
    expect(result.recommendations).toHaveLength(0);
  });

  it('should calculate a poor or unverifiable score for low testability', () => {
    const result = calculateTestabilityIndex({
      testFiles: 1,
      sourceFiles: 10,
      pureFunctions: 20,
      totalFunctions: 100,
      injectionPatterns: 0,
      totalClasses: 10,
      bloatedInterfaces: 8,
      totalInterfaces: 10,
      externalStateMutations: 60,
      hasTestFramework: false,
    });

    expect(result.score).toBeLessThan(40);
    expect(['poor', 'unverifiable']).toContain(result.rating);
    expect(result.aiChangeSafetyRating).toBe('high-risk');
    expect(result.recommendations.length).toBeGreaterThan(3);
  });

  it('should handle zero metrics gracefully', () => {
    const result = calculateTestabilityIndex({
      testFiles: 0,
      sourceFiles: 0,
      pureFunctions: 0,
      totalFunctions: 0,
      injectionPatterns: 0,
      totalClasses: 0,
      bloatedInterfaces: 0,
      totalInterfaces: 0,
      externalStateMutations: 0,
      hasTestFramework: true,
    });

    expect(result.score).toBeGreaterThan(50); // Defaults kick in
    expect(result.aiChangeSafetyRating).toBe('blind-risk');
  });

  it('should process file-level metrics and identify entry points', () => {
    const fileDetails = [
      { filePath: 'src/cli.ts', pureFunctions: 0, totalFunctions: 10 },
      { filePath: 'src/lib/logic.ts', pureFunctions: 10, totalFunctions: 10 },
    ];

    const result = calculateTestabilityIndex({
      testFiles: 1,
      sourceFiles: 2,
      pureFunctions: 10,
      totalFunctions: 20,
      injectionPatterns: 0,
      totalClasses: 0,
      bloatedInterfaces: 0,
      totalInterfaces: 0,
      externalStateMutations: 0,
      hasTestFramework: true,
      fileDetails,
    });

    expect(result.fileMetrics).toHaveLength(2);
    expect(result.fileMetrics![0].isEntryPoint).toBe(true);
    expect(result.fileMetrics![1].isEntryPoint).toBe(false);
    expect(result.libraryScore).toBe(100); // Only logic.ts is library code
  });

  it('should correctly identify various entry point patterns', () => {
    const fileDetails = [
      { filePath: '/bin/tool.ts', pureFunctions: 0, totalFunctions: 1 },
      { filePath: '/cli/handler.ts', pureFunctions: 0, totalFunctions: 1 },
      { filePath: 'src/main.ts', pureFunctions: 0, totalFunctions: 1 },
      { filePath: 'src/cli.ts', pureFunctions: 0, totalFunctions: 1 },
      { filePath: 'src/index.ts', pureFunctions: 0, totalFunctions: 1 },
    ];

    const result = calculateTestabilityIndex({
      testFiles: 0,
      sourceFiles: 5,
      pureFunctions: 0,
      totalFunctions: 5,
      injectionPatterns: 0,
      totalClasses: 0,
      bloatedInterfaces: 0,
      totalInterfaces: 0,
      externalStateMutations: 0,
      hasTestFramework: true,
      fileDetails,
    });

    expect(result.fileMetrics?.every((f) => f.isEntryPoint)).toBe(true);
  });

  it('should provide specific recommendations', () => {
    const result = calculateTestabilityIndex({
      testFiles: 0,
      sourceFiles: 10,
      pureFunctions: 10,
      totalFunctions: 100,
      injectionPatterns: 0,
      totalClasses: 10,
      bloatedInterfaces: 0,
      totalInterfaces: 0,
      externalStateMutations: 50,
      hasTestFramework: false,
    });

    const recs = result.recommendations.join(' ');
    expect(recs).toContain('Add a testing framework');
    expect(recs).toContain('reach 30% coverage ratio');
    expect(recs).toContain('Extract pure functions');
    expect(recs).toContain('Adopt dependency injection');
    expect(recs).toContain('Reduce direct state mutations');
  });
});

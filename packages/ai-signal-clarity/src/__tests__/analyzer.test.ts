import { describe, it, expect, vi } from 'vitest';
import { analyzeAiSignalClarity } from '../analyzer';
import * as core from '@aiready/core';
import * as scanner from '../scanner';

vi.mock('@aiready/core', async () => {
  const actual = await vi.importActual('@aiready/core');
  return {
    ...actual,
    scanFiles: vi.fn(),
    emitProgress: vi.fn(),
  };
});

vi.mock('../scanner', () => ({
  scanFile: vi.fn(),
}));

describe('analyzeAiSignalClarity', () => {
  it('should analyze files and aggregate signals', async () => {
    vi.mocked(core.scanFiles).mockResolvedValue(['file1.ts', 'file2.ts']);
    vi.mocked(scanner.scanFile).mockResolvedValue({
      filePath: 'file1.ts',
      fileName: 'file1.ts',
      issues: [
        {
          severity: 'critical',
          type: 'ai-signal-clarity',
          category: 'magic-literal',
          message: 'test',
          location: { file: 'file1.ts', line: 1 },
        } as any,
      ],
      signals: {
        magicLiterals: 1,
        booleanTraps: 0,
        ambiguousNames: 0,
        undocumentedExports: 0,
        implicitSideEffects: 0,
        deepCallbacks: 0,
        overloadedSymbols: 0,
        totalSymbols: 10,
        totalExports: 2,
        largeFiles: 0,
        totalLines: 0,
      } as any,
      metrics: { tokenCost: 0, consistencyScore: 1 },
    });

    const report = await analyzeAiSignalClarity({ rootDir: '.' });

    expect(report.summary.filesAnalyzed).toBe(2);
    expect(report.summary.criticalSignals).toBe(2); // 1 per file x 2 files
    expect((report.aggregateSignals as any).magicLiterals).toBe(2);
    expect(report.summary.rating).toBeDefined();
    expect(core.scanFiles).toHaveBeenCalled();
  });

  it('should respect minSeverity option', async () => {
    vi.mocked(core.scanFiles).mockResolvedValue(['file1.ts']);
    vi.mocked(scanner.scanFile).mockResolvedValue({
      filePath: 'file1.ts',
      fileName: 'file1.ts',
      issues: [
        {
          severity: 'minor',
          type: 'ai-signal-clarity',
          category: 'magic-literal',
          message: 'minor',
          location: { file: 'file1.ts', line: 1 },
        } as any,
        {
          severity: 'critical',
          type: 'ai-signal-clarity',
          category: 'magic-literal',
          message: 'critical',
          location: { file: 'file1.ts', line: 2 },
        } as any,
      ],
      signals: {
        magicLiterals: 2,
        booleanTraps: 0,
        ambiguousNames: 0,
        undocumentedExports: 0,
        implicitSideEffects: 0,
        deepCallbacks: 0,
        overloadedSymbols: 0,
        totalSymbols: 10,
        totalExports: 2,
        largeFiles: 0,
        totalLines: 0,
      } as any,
      metrics: { tokenCost: 0, consistencyScore: 1 },
    });

    const report = await analyzeAiSignalClarity({
      rootDir: '.',
      minSeverity: 'critical' as any,
    });

    expect(report.results[0].issues.length).toBe(1);
    expect(report.results[0].issues[0].severity).toBe('critical');
    // Summary metrics should still reflect all signals before filtering if that's the implementation
    expect(report.summary.totalSignals).toBe(2);
  });
});

import { describe, it, expect } from 'vitest';
import type {
  AiSignalClarityOptions,
  AiSignalClarityReport,
  FileAiSignalClarityResult,
} from '../types';

describe('AiSignalClarity Types', () => {
  describe('AiSignalClarityOptions', () => {
    it('should allow partial configuration', () => {
      const options: AiSignalClarityOptions = {
        rootDir: '/test',
        include: ['**/*.ts'],
        checkMagicLiterals: true,
      };

      expect(options.include).toEqual(['**/*.ts']);
      expect(options.checkMagicLiterals).toBe(true);
    });
  });

  describe('AiSignalClarityReport', () => {
    it('should structure summary correctly', () => {
      const mockSignals: any = {
        magicLiterals: 300,
        booleanTraps: 20,
        ambiguousNames: 50,
        undocumentedExports: 100,
        implicitSideEffects: 10,
        deepCallbacks: 15,
        overloadedSymbols: 0,
        largeFiles: 5,
        totalSymbols: 1000,
        totalExports: 200,
        totalLines: 50000,
      };

      const report: AiSignalClarityReport = {
        summary: {
          filesAnalyzed: 100,
          totalSignals: 500,
          criticalSignals: 5,
          majorSignals: 50,
          minorSignals: 445,
          topRisk: 'magic-literals',
          rating: 'high',
        },
        results: [],
        aggregateSignals: mockSignals,
        recommendations: ['Extract magic literals into named constants'],
      };

      expect(report.summary.filesAnalyzed).toBe(100);
      expect((report.aggregateSignals as any).magicLiterals).toBe(300);
    });
  });
});

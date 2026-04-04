import { describe, it, expect } from 'vitest';
import {
  normalizeIssue,
  normalizeMetrics,
  normalizeAnalysisResult,
  normalizeSpokeOutput,
} from '../utils/normalization';
import { Severity, IssueType } from '../types';

describe('normalization', () => {
  describe('normalizeIssue', () => {
    it('should use default values for empty raw data', () => {
      const result = normalizeIssue({});
      expect(result.type).toBe(IssueType.PatternInconsistency);
      expect(result.severity).toBe(Severity.Info);
      expect(result.message).toBe('Unknown issue');
      expect(result.location.file).toBe('unknown');
    });

    it('should handle various file path properties', () => {
      expect(normalizeIssue({ fileName: 'a.ts' }).location.file).toBe('a.ts');
      expect(normalizeIssue({ file: 'b.ts' }).location.file).toBe('b.ts');
      expect(normalizeIssue({ filePath: 'c.ts' }).location.file).toBe('c.ts');
    });
  });

  describe('normalizeMetrics', () => {
    it('should set default zeroes for essential numbers', () => {
      const result = normalizeMetrics({});
      expect(result.tokenCost).toBe(0);
      expect(result.complexityScore).toBe(0);
    });

    it('should preserve scores if present', () => {
      const result = normalizeMetrics({ tokenCost: 500, complexityScore: 0.8 });
      expect(result.tokenCost).toBe(500);
      expect(result.complexityScore).toBe(0.8);
    });
  });

  describe('normalizeAnalysisResult', () => {
    it('should handle legacy string issues', () => {
      const raw = {
        file: 'test.ts',
        issues: ['Something is wrong'],
      };
      const result = normalizeAnalysisResult(raw);
      expect(result.issues[0].message).toBe('Something is wrong');
      expect(result.issues[0].location.file).toBe('test.ts');
    });

    it('should normalize issues array', () => {
      const raw = {
        file: 'test.ts',
        issues: [{ message: 'Bad', severity: Severity.Major }],
      };
      const result = normalizeAnalysisResult(raw);
      expect(result.issues[0].severity).toBe(Severity.Major);
    });
  });

  describe('normalizeSpokeOutput', () => {
    it('should yield valid SpokeOutput from raw data', () => {
      const raw = {
        results: [{ file: 'test.ts', issues: [] }],
        summary: { totalFiles: 1, totalIssues: 0 },
      };
      const result = normalizeSpokeOutput(raw, 'test-tool');
      expect(result.results).toHaveLength(1);
      if (result.metadata) {
        expect(result.metadata.toolName).toBe('test-tool');
        expect(result.metadata.timestamp).toBeDefined();
      }
    });

    it('should use current date if timestamp is missing', () => {
      const result = normalizeSpokeOutput({}, 'tool');
      expect(result.metadata?.timestamp).toBeDefined();
    });
  });
});

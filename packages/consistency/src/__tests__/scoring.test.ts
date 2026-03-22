import { describe, it, expect } from 'vitest';
import { calculateConsistencyScore } from '../scoring';
import type { ConsistencyIssue } from '../types';

describe('Consistency Scoring', () => {
  describe('calculateConsistencyScore', () => {
    it('should return perfect score for no issues', () => {
      const result = calculateConsistencyScore([], 100);

      expect(result.score).toBe(100);
      expect(result.toolName).toBe('naming-consistency');
      expect(result.rawMetrics.totalIssues).toBe(0);
      expect(result.recommendations).toHaveLength(0);
    });

    it('should penalize high issue density', () => {
      const issues: ConsistencyIssue[] = Array(50).fill({
        severity: 'minor',
        category: 'naming',
        message: 'Test issue',
        location: { file: 'test.ts', line: 1 },
      } as ConsistencyIssue);

      // 50 issues / 10 files = 5 issues per file
      // densityPenalty = min(50, 5 * 15) = 50
      const result = calculateConsistencyScore(issues, 10);

      expect(result.score).toBeLessThan(60);
      expect(result.rawMetrics.issuesPerFile).toBe(5);
    });

    it('should heavily penalize critical issues', () => {
      const issues: ConsistencyIssue[] = [
        {
          severity: 'critical',
          category: 'naming',
          message: 'Critical naming issue',
          location: { file: 'test.ts', line: 1 },
        } as ConsistencyIssue,
        {
          severity: 'critical',
          category: 'naming',
          message: 'Another critical issue',
          location: { file: 'test.ts', line: 10 },
        } as ConsistencyIssue,
      ];

      const result = calculateConsistencyScore(issues, 10);

      // 2 issues / 10 files = 0.2 issues/file → densityPenalty = 3
      // weightedCount = 2*10 = 20, avgWeighted = 2.0 → severityPenalty = 4
      // score = 100 - 3 - 4 = 93
      expect(result.score).toBe(93);
      expect(result.rawMetrics.criticalIssues).toBe(2);
      expect(
        result.factors.some((f: any) => f.name === 'Critical Issues')
      ).toBe(true);
      expect(
        result.recommendations.some((r: any) => r.priority === 'high')
      ).toBe(true);
    });

    it('should apply weighted severity penalties', () => {
      const issues: ConsistencyIssue[] = [
        ...Array(5).fill({ severity: 'critical' } as ConsistencyIssue),
        ...Array(10).fill({ severity: 'major' } as ConsistencyIssue),
        ...Array(20).fill({ severity: 'minor' } as ConsistencyIssue),
      ];

      const result = calculateConsistencyScore(
        issues.map((i, idx) => ({
          ...i,
          category: 'naming',
          message: 'test',
          location: { file: 'test.ts', line: idx },
        })) as ConsistencyIssue[],
        50
      );

      expect(result.rawMetrics.criticalIssues).toBe(5);
      expect(result.rawMetrics.majorIssues).toBe(10);
      expect(result.rawMetrics.minorIssues).toBe(20);
      // 35 issues / 50 files = 0.7 issues/file → densityPenalty = 10.5
      // weightedCount = 50+30+10 = 90, avgWeighted = 1.8 → severityPenalty = 3.6
      // score = 100 - 10.5 - 3.6 = 85.9 → 86
      expect(result.score).toBe(86);
    });

    it('should generate appropriate recommendations', () => {
      const issues: ConsistencyIssue[] = [
        ...Array(3).fill({
          severity: 'critical',
          category: 'naming',
        } as ConsistencyIssue),
        ...Array(10).fill({
          severity: 'major',
          category: 'patterns',
        } as ConsistencyIssue),
      ];

      const result = calculateConsistencyScore(
        issues.map((i, idx) => ({
          ...i,
          message: 'test',
          location: { file: 'test.ts', line: idx },
        })) as ConsistencyIssue[],
        5
      );

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(
        result.recommendations.some((r: any) => r.action.includes('critical'))
      ).toBe(true);
      expect(
        result.recommendations.some((r: any) => r.action.includes('naming'))
      ).toBe(true);
    });

    it('should handle edge case of zero files', () => {
      const issues: ConsistencyIssue[] = [];

      const result = calculateConsistencyScore(issues, 0);

      expect(result.score).toBe(100);
      expect(result.rawMetrics.issuesPerFile).toBe(0);
    });

    it('should recommend linter for many minor issues', () => {
      const issues: ConsistencyIssue[] = Array(30).fill({
        severity: 'minor',
        category: 'naming',
        message: 'Minor style issue',
        location: { file: 'test.ts', line: 1 },
      } as ConsistencyIssue);

      const result = calculateConsistencyScore(issues, 10);

      expect(
        result.recommendations.some((r: any) => r.action.includes('linter'))
      ).toBe(true);
    });

    it('should combine all penalty types', () => {
      const issues: ConsistencyIssue[] = [
        ...Array(10).fill({
          severity: 'critical',
          category: 'naming',
        } as ConsistencyIssue),
        ...Array(20).fill({
          severity: 'major',
          category: 'patterns',
        } as ConsistencyIssue),
        ...Array(40).fill({
          severity: 'minor',
          category: 'naming',
        } as ConsistencyIssue),
      ];

      const result = calculateConsistencyScore(
        issues.map((i, idx) => ({
          ...i,
          message: 'test',
          location: { file: 'test.ts', line: idx },
        })) as ConsistencyIssue[],
        10
      );

      // 70 issues / 10 files = 7 issues/file
      // High density + critical issues + weighted severity
      expect(result.score).toBeLessThan(30);
      expect(result.factors.length).toBeGreaterThan(2);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });
});

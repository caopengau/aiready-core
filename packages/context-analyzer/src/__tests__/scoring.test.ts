import { describe, it, expect } from 'vitest';
import { calculateContextScore } from '../scoring';
import type { ContextSummary } from '../types';

describe('Context Scoring', () => {
  describe('calculateContextScore', () => {
    it('should return perfect score for ideal metrics', () => {
      const summary: ContextSummary = {
        avgContextBudget: 3000, // < 8000
        maxContextBudget: 4000,
        avgImportDepth: 3, // < 8
        maxImportDepth: 4,
        avgFragmentation: 0.19, // < 0.2 (for bonus)
        criticalIssues: 0,
        majorIssues: 0,
        minorIssues: 0,
      } as ContextSummary;

      const result = calculateContextScore(summary);

      expect(result.score).toBeGreaterThanOrEqual(90);
      expect(result.toolName).toBe('context-analyzer');
      expect(result.recommendations).toHaveLength(0);
    });

    it('should penalize high context budget', () => {
      const summary: ContextSummary = {
        avgContextBudget: 15000, // High
        maxContextBudget: 20000,
        avgImportDepth: 3,
        maxImportDepth: 5,
        avgFragmentation: 0.2,
        criticalIssues: 0,
        majorIssues: 0,
        minorIssues: 0,
      } as ContextSummary;

      const result = calculateContextScore(summary);

      expect(result.score).toBeLessThan(70);
      expect(result.factors.some((f: any) => f.name === 'Context Budget')).toBe(
        true
      );
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should penalize deep import chains', () => {
      const summary: ContextSummary = {
        avgContextBudget: 4000,
        maxContextBudget: 5000,
        avgImportDepth: 12, // Deep
        maxImportDepth: 15,
        avgFragmentation: 0.2,
        criticalIssues: 0,
        majorIssues: 0,
        minorIssues: 0,
      } as ContextSummary;

      const result = calculateContextScore(summary);

      // With depth=12: depthScore=80, rawScore=100*0.35+80*0.25+100*0.25=80, no bonus (frag=0.2 not <0.2)
      expect(result.score).toBe(80);
      expect(result.factors.some((f: any) => f.name === 'Import Depth')).toBe(
        true
      );
      expect(
        result.recommendations.some((r: any) =>
          r.action.includes('import chains')
        )
      ).toBe(true);
    });

    it('should penalize high fragmentation', () => {
      const summary: ContextSummary = {
        avgContextBudget: 4000,
        maxContextBudget: 5000,
        avgImportDepth: 3,
        maxImportDepth: 5,
        avgFragmentation: 0.7, // High fragmentation
        criticalIssues: 0,
        majorIssues: 0,
        minorIssues: 0,
      } as ContextSummary;

      const result = calculateContextScore(summary);

      // fragScore = 100 - (0.7-0.5)*100 = 80
      // rawScore = 100*0.35 + 100*0.25 + 80*0.25 = 35 + 25 + 20 = 80
      // bonus = 5 (no issues, frag<0.2? No, frag=0.7 so no bonus)
      // Actually frag=0.7 >= 0.2, so no bonus
      // rawScore = 80, no penalties = 80
      expect(result.score).toBeLessThan(85); // Adjusted for new calculation
      expect(result.factors.some((f: any) => f.name === 'Fragmentation')).toBe(
        true
      );
    });

    it('should apply critical issue penalties', () => {
      const summary: ContextSummary = {
        avgContextBudget: 4000,
        maxContextBudget: 5000,
        avgImportDepth: 3,
        maxImportDepth: 5,
        avgFragmentation: 0.2,
        criticalIssues: 5, // Critical issues present
        majorIssues: 0,
        minorIssues: 0,
      } as ContextSummary;

      const result = calculateContextScore(summary);

      // Perfect subscores: budget=100, depth=100, frag=100
      // rawScore = 100*0.35 + 100*0.25 + 100*0.25 = 35+25+25 = 85
      // criticalPenalty = min(20, 5*3) = min(20,15) = 15
      // finalScore = 85 - 15 = 70
      expect(result.score).toBe(70);
      expect(
        result.factors.some((f: any) => f.name === 'Critical Issues')
      ).toBe(true);
    });

    it('should handle extreme max budget penalty', () => {
      const summary: ContextSummary = {
        avgContextBudget: 4000,
        maxContextBudget: 25000, // Extreme single file
        avgImportDepth: 3,
        maxImportDepth: 5,
        avgFragmentation: 0.2,
        criticalIssues: 0,
        majorIssues: 0,
        minorIssues: 0,
      } as ContextSummary;

      const result = calculateContextScore(summary);

      expect(
        result.factors.some((f: any) => f.name === 'Extreme File Detected')
      ).toBe(true);
      expect(
        result.recommendations.some((r: any) =>
          r.action.includes('Split large file')
        )
      ).toBe(true);
    });

    it('should combine multiple penalties correctly', () => {
      const summary: ContextSummary = {
        avgContextBudget: 12000, // High
        maxContextBudget: 15000,
        avgImportDepth: 10, // Deep
        maxImportDepth: 12,
        avgFragmentation: 0.6, // High
        criticalIssues: 2,
        majorIssues: 5,
        minorIssues: 10,
      } as ContextSummary;

      const result = calculateContextScore(summary);

      // budgetScore = 100 - (12000-8000)/200 = 100 - 4000/200 = 100 - 20 = 80
      // depthScore = 100 - (10-8)*5 = 100 - 10 = 90
      // fragScore = 100 - (0.6-0.5)*100 = 100 - 10 = 90
      // rawScore = 80*0.35 + 90*0.25 + 90*0.25 = 28 + 22.5 + 22.5 = 73
      // bonus = 0 (has issues)
      // criticalPenalty = min(20, 2*3) = min(20,6) = 6
      // majorPenalty = min(15, 5*1) = min(15,5) = 5
      // maxBudgetPenalty = 0 (max=15000 not >15000)
      // totalPenalty = min(30, 6+5) = 11
      // finalScore = 73 - 11 = 62
      expect(result.score).toBeGreaterThanOrEqual(60);
      expect(result.score).toBeLessThan(70);
      expect(result.factors.length).toBeGreaterThan(3);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    // Regression tests for improved scoring algorithm
    describe('Regression: Improved Scoring Algorithm', () => {
      it('should never return 0 even with many critical issues', () => {
        // This was the original bug - too many issues would drive score to 0
        const summary: ContextSummary = {
          avgContextBudget: 7000, // Good - under threshold
          maxContextBudget: 20000,
          avgImportDepth: 3, // Good - shallow
          maxImportDepth: 5,
          avgFragmentation: 0.1, // Good - low fragmentation
          criticalIssues: 20, // Many issues - but score shouldn't be 0
          majorIssues: 10,
          minorIssues: 0,
        } as ContextSummary;

        const result = calculateContextScore(summary);

        // With capped penalties: criticalPenalty = min(20, 20*3) = 20
        // majorPenalty = min(15, 10*1) = 10
        // maxBudgetPenalty = min(20, (20000-15000)/500) = min(20, 10) = 10
        // rawScore = 100*0.35 + 100*0.25 + 100*0.25 = 85
        // totalPenalty = min(30, 20+10) = 30
        // finalScore = 85 - 30 - 10 = 45
        expect(result.score).toBeGreaterThan(0);
        expect(result.score).toBe(45);
      });

      it('should apply bonus for well-organized codebase', () => {
        // Perfect metrics should get a bonus
        const summary: ContextSummary = {
          avgContextBudget: 3000,
          maxContextBudget: 4000,
          avgImportDepth: 3,
          maxImportDepth: 4,
          avgFragmentation: 0.15, // < 0.2 for bonus
          criticalIssues: 0,
          majorIssues: 0,
          minorIssues: 0,
        } as ContextSummary;

        const result = calculateContextScore(summary);

        // rawScore = 100*0.35 + 100*0.25 + 100*0.25 + 5 (bonus) = 90
        // No penalties
        // finalScore = 90
        expect(result.score).toBe(90);
        expect(
          result.factors.some((f: any) => f.name === 'Well-Organized Codebase')
        ).toBe(true);
      });

      it('should not give bonus when fragmentation is too high', () => {
        const summary: ContextSummary = {
          avgContextBudget: 3000,
          maxContextBudget: 4000,
          avgImportDepth: 3,
          maxImportDepth: 4,
          avgFragmentation: 0.25, // >= 0.2, no bonus
          criticalIssues: 0,
          majorIssues: 0,
          minorIssues: 0,
        } as ContextSummary;

        const result = calculateContextScore(summary);

        // No bonus because fragmentation >= 0.2
        expect(result.score).toBe(85); // 100*0.35 + 100*0.25 + 100*0.25 = 85
        expect(
          result.factors.some((f: any) => f.name === 'Well-Organized Codebase')
        ).toBe(false);
      });

      it('should cap critical penalty at 20 points', () => {
        // More than ~7 critical issues should be capped
        const summary: ContextSummary = {
          avgContextBudget: 3000,
          maxContextBudget: 5000,
          avgImportDepth: 3,
          maxImportDepth: 4,
          avgFragmentation: 0.1,
          criticalIssues: 10, // Would be 30 without cap, but capped at 20
          majorIssues: 0,
          minorIssues: 0,
        } as ContextSummary;

        const result = calculateContextScore(summary);

        // criticalPenalty = min(20, 10*3) = 20 (capped)
        // rawScore = 100*0.35 + 100*0.25 + 100*0.25 = 85
        // finalScore = 85 - 20 = 65
        expect(result.score).toBe(65);
      });

      it('should cap total penalty at 30 points', () => {
        // Combined penalties should be capped
        const summary: ContextSummary = {
          avgContextBudget: 3000,
          maxContextBudget: 5000,
          avgImportDepth: 3,
          maxImportDepth: 4,
          avgFragmentation: 0.1,
          criticalIssues: 10, // Would give 20
          majorIssues: 10, // Would give 10, total 30 but we cap at 30
          minorIssues: 0,
        } as ContextSummary;

        const result = calculateContextScore(summary);

        // criticalPenalty = min(20, 10*3) = 20
        // majorPenalty = min(15, 10*1) = 10
        // totalPenalty = min(30, 20+10) = 30 (capped)
        // rawScore = 85
        // finalScore = 85 - 30 = 55
        expect(result.score).toBe(55);
      });

      it('should score realistic project with mixed issues', () => {
        // Simulates the aiready project: good avg metrics but some issues
        const summary: ContextSummary = {
          avgContextBudget: 7500, // Under 8000 threshold
          maxContextBudget: 26000, // One large file
          avgImportDepth: 2.5, // Good
          maxImportDepth: 9,
          avgFragmentation: 0.01, // Very low
          criticalIssues: 21, // Many files with issues
          majorIssues: 0,
          minorIssues: 0,
        } as ContextSummary;

        const result = calculateContextScore(summary);

        // budgetScore = 100 (7500 < 8000)
        // depthScore = 100 (2.5 < 8)
        // fragScore = 100 (0.01 < 0.5)
        // rawScore = 100*0.35 + 100*0.25 + 100*0.25 = 85
        // criticalPenalty = min(20, 21*3) = 20
        // maxBudgetPenalty = min(20, (26000-15000)/500) = min(20, 22) = 20
        // finalScore = 85 - 20 - 20 = 45
        expect(result.score).toBe(45);
        expect(result.score).toBeGreaterThan(0); // Key regression test!
      });

      it('should handle threshold boundaries correctly', () => {
        // Test just at the threshold - all individual scores = 100
        // But weighted sum is 85% (0.35 + 0.25 + 0.25), so perfect metrics = 85 without bonus
        const summaryAtThreshold: ContextSummary = {
          avgContextBudget: 8000, // At threshold
          maxContextBudget: 15000, // At threshold - no max budget penalty
          avgImportDepth: 8, // At threshold
          maxImportDepth: 10,
          avgFragmentation: 0.5, // At threshold - no bonus (needs < 0.2)
          criticalIssues: 0,
          majorIssues: 0,
          minorIssues: 0,
        } as ContextSummary;

        const result = calculateContextScore(summaryAtThreshold);

        // All scores at threshold give 100 each
        // Weighted: 100*0.35 + 100*0.25 + 100*0.25 = 35 + 25 + 25 = 85
        // No bonus (frag = 0.5 >= 0.2)
        // No penalties
        expect(result.score).toBe(85);
      });

      it('should score above threshold correctly', () => {
        // Test just above the threshold
        const summaryAboveThreshold: ContextSummary = {
          avgContextBudget: 8500, // Above 8000
          maxContextBudget: 16000,
          avgImportDepth: 10, // Above 8
          maxImportDepth: 12,
          avgFragmentation: 0.6, // Above 0.5
          criticalIssues: 0,
          majorIssues: 0,
          minorIssues: 0,
        } as ContextSummary;

        const result = calculateContextScore(summaryAboveThreshold);

        // budgetScore = 100 - (8500-8000)/200 = 100 - 2.5 = 97
        // depthScore = 100 - (10-8)*5 = 100 - 10 = 90
        // fragScore = 100 - (0.6-0.5)*100 = 100 - 10 = 90
        // rawScore = 97*0.35 + 90*0.25 + 90*0.25 = 33.95 + 22.5 + 22.5 = 78.95
        expect(result.score).toBeGreaterThan(70);
        expect(result.score).toBeLessThan(85);
      });
    });
  });
});

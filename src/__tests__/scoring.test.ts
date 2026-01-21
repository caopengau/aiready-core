import { describe, it, expect } from 'vitest';
import { calculateContextScore } from '../scoring';
import type { ContextSummary } from '../types';

describe('Context Scoring', () => {
  describe('calculateContextScore', () => {
    it('should return perfect score for ideal metrics', () => {
      const summary: ContextSummary = {
        avgContextBudget: 3000, // < 5000
        maxContextBudget: 4000,
        avgImportDepth: 3, // < 5
        maxImportDepth: 4,
        avgFragmentation: 0.2, // < 0.3
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
      expect(result.factors.some(f => f.name === 'Context Budget')).toBe(true);
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

      // With depth=12: depthScore=30, rawScore=(100*0.4)+(30*0.3)+(100*0.3)=79
      expect(result.score).toBe(79);
      expect(result.factors.some(f => f.name === 'Import Depth')).toBe(true);
      expect(result.recommendations.some(r => r.action.includes('import chains'))).toBe(true);
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

      expect(result.score).toBeLessThan(80); // Adjusted threshold
      expect(result.factors.some(f => f.name === 'Fragmentation')).toBe(true);
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

      // Perfect subscores=100, minus 5*10=50 critical penalty = 50
      expect(result.score).toBe(50);
      expect(result.factors.some(f => f.name === 'Critical Issues')).toBe(true);
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

      expect(result.factors.some(f => f.name === 'Extreme File Detected')).toBe(true);
      expect(result.recommendations.some(r => r.action.includes('Split large file'))).toBe(true);
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

      expect(result.score).toBeLessThan(40);
      expect(result.factors.length).toBeGreaterThan(3);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });
});

/**
 * Business Metrics Tests
 */
import { describe, it, expect } from 'vitest';
import {
  calculateMonthlyCost,
  calculateProductivityImpact,
  calculateComprehensionDifficulty,
  predictAcceptanceRate,
  formatCost,
  formatHours,
  formatAcceptanceRate,
} from '..';
import { ToolScoringOutput } from '../scoring';

describe('Business Metrics', () => {
  describe('calculateMonthlyCost', () => {
    it('should calculate cost for token waste', () => {
      // 10,000 tokens waste with default config (gpt-5.4-mini preset)
      // (10000/1000) * 0.0001 * 60 * 5 * 30 * 1.1 = $9.9/month
      const result = calculateMonthlyCost(10000);
      expect(result.total).toBe(9.9);
    });

    it('should handle custom config', () => {
      const result = calculateMonthlyCost(10000, {
        developerCount: 10,
        queriesPerDevPerDay: 100,
      });
      // (10000/1000) * 0.0001 * 100 * 10 * 30 * 1.1 = $33
      expect(result.total).toBe(33);
    });

    it('should handle zero tokens', () => {
      const result = calculateMonthlyCost(0);
      expect(result.total).toBe(0);
    });
  });

  describe('calculateProductivityImpact', () => {
    it('should calculate impact for mixed severity issues', () => {
      const issues = [
        { severity: 'critical' as const },
        { severity: 'major' as const },
        { severity: 'major' as const },
        { severity: 'minor' as const },
        { severity: 'minor' as const },
        { severity: 'minor' as const },
      ];

      const impact = calculateProductivityImpact(issues);

      // Critical: 1 * 4 = 4h
      // Major: 2 * 2 = 4h
      // Minor: 3 * 0.5 = 1.5h
      // Total: 9.5h
      expect(impact.totalHours).toBe(9.5);
    });

    it('should use custom hourly rate', () => {
      const issues = [{ severity: 'critical' as const }];
      const impact = calculateProductivityImpact(issues, 100);

      expect(impact.bySeverity.critical.cost).toBe(400); // 4h * $100
    });
  });

  describe('calculateComprehensionDifficulty', () => {
    it('should rate easy projects correctly', () => {
      const result = calculateComprehensionDifficulty(
        3000, // low context budget
        3, // shallow imports
        0.1, // well organized
        'frontier' // model tier
      );

      expect(result.rating).toBe('trivial');
      expect(result.score).toBeLessThan(20);
    });

    it('should rate difficult projects correctly', () => {
      const result = calculateComprehensionDifficulty(
        25000, // high context budget
        10, // deep imports
        0.6, // fragmented
        'compact' // model tier
      );

      expect(result.rating).toBe('expert');
      expect(result.score).toBeGreaterThan(60);
    });
  });

  describe('predictAcceptanceRate', () => {
    it('should predict based on tool scores', () => {
      const toolOutputs = new Map<string, ToolScoringOutput>();

      toolOutputs.set('pattern-detect', {
        toolName: 'pattern-detect',
        score: 80,
        rawMetrics: {},
        factors: [],
        recommendations: [],
      });

      toolOutputs.set('context-analyzer', {
        toolName: 'context-analyzer',
        score: 70,
        rawMetrics: {},
        factors: [],
        recommendations: [],
      });

      toolOutputs.set('consistency', {
        toolName: 'consistency',
        score: 90,
        rawMetrics: {},
        factors: [],
        recommendations: [],
      });

      const prediction = predictAcceptanceRate(toolOutputs);

      // v0.12 calibration: base 30% + pattern (30*0.003=+9%) + context (20*0.004=+8%)
      // + consistency (40*0.002=+8%) = 55%, confidence 0.65 for 3 tools
      expect(prediction.rate).toBe(0.55);
      expect(prediction.confidence).toBe(0.65);
      expect(prediction.factors.length).toBe(3);
    });
  });

  describe('formatting functions', () => {
    it('should format cost correctly', () => {
      expect(formatCost(0.5)).toBe('$0.50');
      expect(formatCost(50)).toBe('$50');
      expect(formatCost(1500)).toBe('$1.5k');
    });

    it('should format hours correctly', () => {
      expect(formatHours(0.5)).toBe('30min');
      expect(formatHours(4)).toBe('4.0h');
      expect(formatHours(80)).toBe('2.0 weeks');
    });

    it('should format acceptance rate correctly', () => {
      expect(formatAcceptanceRate(0.75)).toBe('75%');
      expect(formatAcceptanceRate(0.5)).toBe('50%');
    });
  });
});

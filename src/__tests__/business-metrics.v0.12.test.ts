import { describe, it, expect } from 'vitest';
import { 
  calculateMonthlyCost, 
  calculateProductivityImpact, 
  predictAcceptanceRate,
  generateValueChain
} from '../business-metrics';
import { ToolScoringOutput } from '../scoring';

describe('business-metrics v0.12 evolution', () => {
  describe('calculateMonthlyCost', () => {
    it('should return range and confidence intervals', () => {
      const result = calculateMonthlyCost(1000, {
        pricePer1KTokens: 0.01,
        queriesPerDevPerDay: 50,
        developerCount: 10,
        daysPerMonth: 20
      });

      // (1000 / 1000) * 0.01 * 50 * 10 * 20 = 100
      expect(result.total).toBe(100);
      expect(result.range[0]).toBeLessThan(100);
      expect(result.range[1]).toBeGreaterThan(100);
      expect(result.confidence).toBe(0.85);
    });

    it('should lower confidence for high token waste', () => {
      const result = calculateMonthlyCost(100000);
      expect(result.confidence).toBe(0.7);
    });
  });

  describe('predictAcceptanceRate', () => {
    it('should incorporate multiple tool signals', () => {
      const toolOutputs = new Map<string, ToolScoringOutput>();
      
      toolOutputs.set('pattern-detect', {
        toolName: 'pattern-detect',
        score: 80, // High score = low duplication = +impact
        rawMetrics: {},
        factors: [],
        recommendations: []
      });

      toolOutputs.set('context-analyzer', {
        toolName: 'context-analyzer',
        score: 20, // Low score = high fragmentation = -impact
        rawMetrics: {},
        factors: [],
        recommendations: []
      });

      const prediction = predictAcceptanceRate(toolOutputs);
      expect(prediction.factors.length).toBe(2);
      expect(prediction.rate).toBeCloseTo(0.27, 2); // 0.3 + 0.09 - 0.12
    });
  });

  describe('generateValueChain', () => {
    it('should link technical issues to business outcomes', () => {
      const chain = generateValueChain({
        issueType: 'context-fragmentation',
        count: 5,
        severity: 'critical'
      });

      expect(chain.businessOutcome.riskLevel).toBe('critical');
      expect(chain.developerImpact.productivityLoss).toBe(0.25);
      expect(chain.businessOutcome.opportunityCost).toBe(3750); // 0.25 * 15000
    });
  });
});

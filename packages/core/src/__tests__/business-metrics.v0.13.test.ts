import { describe, it, expect } from 'vitest';
import {
  calculateTokenBudget,
  estimateCostFromBudget,
  MODEL_PRICING_PRESETS,
} from '../business-metrics';

describe('Token Budget Unit Economics', () => {
  const sampleWastedTokens = {
    duplication: 1000,
    fragmentation: 500,
    chattiness: 0,
  };

  it('should calculate token budget correctly', () => {
    const budget = calculateTokenBudget({
      totalContextTokens: 10000,
      wastedTokens: sampleWastedTokens,
    });

    expect(budget.totalContextTokens).toBe(10000);
    expect(budget.wastedTokens.total).toBe(1500);
    expect(budget.efficiencyRatio).toBe(0.85); // (10000-1500)/10000
    expect(budget.potentialRetrievableTokens).toBe(1200); // 1500 * 0.8
  });

  it('should estimate cost from budget using different model presets', () => {
    const budget = calculateTokenBudget({
      totalContextTokens: 5000,
      wastedTokens: { duplication: 1000, fragmentation: 0, chattiness: 0 },
    });

    // GPT-4o: $0.005 per 1K
    const cost4o = estimateCostFromBudget(
      budget,
      MODEL_PRICING_PRESETS['gpt-4o'],
      {
        developerCount: 1,
        queriesPerDevPerDay: 100,
        daysPerMonth: 30,
      }
    );

    // 1000 waste * 100 queries * 30 days = 3,000,000 wasted tokens per month
    // 3000K * $0.005 = $15
    expect(cost4o.total).toBe(15);
    expect(cost4o.confidence).toBe(0.85);

    // GPT-5.3: $0.002 per 1K
    const cost5 = estimateCostFromBudget(
      budget,
      MODEL_PRICING_PRESETS['gpt-5.3'],
      {
        developerCount: 1,
        queriesPerDevPerDay: 100,
        daysPerMonth: 30,
      }
    );
    // 3000K * $0.002 = $6
    expect(cost5.total).toBe(6);
  });

  it('should handle zero waste correctly', () => {
    const budget = calculateTokenBudget({
      totalContextTokens: 1000,
      wastedTokens: { duplication: 0, fragmentation: 0, chattiness: 0 },
    });

    expect(budget.efficiencyRatio).toBe(1.0);
    expect(budget.wastedTokens.total).toBe(0);
  });
});

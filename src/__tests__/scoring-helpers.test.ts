import { describe, it, expect } from 'vitest';
import { buildStandardToolScore } from '../utils/scoring-helpers';
import { RecommendationPriority } from '../scoring';
import { ToolName } from '../types';
import { ReadinessRating } from '../utils/rating-helpers';

describe('scoring-helpers', () => {
  describe('buildStandardToolScore', () => {
    it('should correctly build a ToolScoringOutput', () => {
      const report = {
        toolName: ToolName.TestabilityIndex,
        score: 85,
        rawData: { some: 'data' },
        dimensions: {
          testCoverageRatio: 90,
          purityScore: 80,
        },
        dimensionNames: {
          testCoverageRatio: 'Test Coverage',
          purityScore: 'Function Purity',
        },
        recommendations: ['Add more tests'],
        rating: ReadinessRating.Excellent,
      };

      const output = buildStandardToolScore(report);

      expect(output.toolName).toBe(ToolName.TestabilityIndex);
      expect(output.score).toBe(85);
      expect(output.rawMetrics.rating).toBe(ReadinessRating.Excellent);
      expect(output.factors).toHaveLength(2);
      expect(output.factors[0].name).toBe('Test Coverage');
      expect(output.factors[0].impact).toBe(40); // 90 - 50
      expect(output.recommendations).toHaveLength(1);
      expect(output.recommendations[0].action).toBe('Add more tests');
      expect(output.recommendations[0].priority).toBe('medium');
    });

    it('should use high priority for low scores', () => {
      const output = buildStandardToolScore({
        toolName: ToolName.TestabilityIndex,
        score: 40,
        rawData: {},
        dimensions: {},
        dimensionNames: {},
        recommendations: ['Fix everything'],
        rating: ReadinessRating.Critical,
      });

      expect(output.recommendations[0].priority).toBe('high');
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  getProjectSizeTier,
  getRecommendedThreshold,
  normalizeToolName,
  getToolWeight,
  parseWeightString,
  calculateOverallScore,
  getRatingWithContext,
  getRatingDisplay,
  formatScore,
  formatToolScore,
  ScoringProfile,
  RecommendationPriority,
} from '../scoring';
import { ToolName } from '../types';
import { ReadinessRating } from '../utils/rating-helpers';
import { type ToolScoringOutput } from '../scoring-types';

describe('scoring', () => {
  describe('getProjectSizeTier', () => {
    it('should return correct tier for file counts', () => {
      expect(getProjectSizeTier(10)).toBe('xs');
      expect(getProjectSizeTier(100)).toBe('small');
      expect(getProjectSizeTier(300)).toBe('medium');
      expect(getProjectSizeTier(1000)).toBe('large');
      expect(getProjectSizeTier(5000)).toBe('enterprise');
    });
  });

  describe('getRecommendedThreshold', () => {
    it('should adjust threshold based on model tier', () => {
      const baseXS = 80;
      expect(getRecommendedThreshold(10, 'standard')).toBe(baseXS);
      expect(getRecommendedThreshold(10, 'frontier')).toBe(baseXS - 3);
      expect(getRecommendedThreshold(10, 'extended')).toBe(baseXS - 2);
    });
  });

  describe('normalizeToolName', () => {
    it('should normalize known aliases', () => {
      expect(normalizeToolName('patterns')).toBe(ToolName.PatternDetect);
      expect(normalizeToolName('context')).toBe(ToolName.ContextAnalyzer);
      expect(normalizeToolName('UNKNOWN')).toBe('UNKNOWN');
    });
  });

  describe('getToolWeight', () => {
    it('should return CLI override if provided', () => {
      expect(getToolWeight(ToolName.PatternDetect, undefined, 50)).toBe(50);
    });

    it('should return config weight if provided', () => {
      expect(getToolWeight(ToolName.PatternDetect, { scoreWeight: 30 })).toBe(
        30
      );
    });

    it('should use profile weights', () => {
      expect(
        getToolWeight(
          ToolName.AiSignalClarity,
          undefined,
          undefined,
          ScoringProfile.Agentic
        )
      ).toBe(25);
    });

    it('should fall back to default weight for unknown tool in profile', () => {
      expect(
        getToolWeight(
          'unknown-tool',
          undefined,
          undefined,
          ScoringProfile.Agentic
        )
      ).toBe(5);
    });

    it('should fall back to 5 for unknown tool and missing config/profile', () => {
      expect(getToolWeight('generic-tool', {})).toBe(5);
    });
  });

  describe('parseWeightString', () => {
    it('should parse valid weight string', () => {
      const weights = parseWeightString('patterns:50,context:30');
      expect(weights.get(ToolName.PatternDetect)).toBe(50);
      expect(weights.get(ToolName.ContextAnalyzer)).toBe(30);
    });

    it('should return empty map for empty/invalid string', () => {
      expect(parseWeightString('').size).toBe(0);
      expect(parseWeightString('invalid').size).toBe(0);
    });
  });

  describe('calculateOverallScore', () => {
    it('should throw if no outputs provided', () => {
      expect(() => calculateOverallScore(new Map())).toThrow();
    });

    it('should calculate weighted average correctly', () => {
      const toolOutputs = new Map<string, ToolScoringOutput>();
      toolOutputs.set(ToolName.PatternDetect, {
        toolName: ToolName.PatternDetect,
        score: 80,
        factors: [],
        rawMetrics: {},
        recommendations: [],
      });
      toolOutputs.set(ToolName.ContextAnalyzer, {
        toolName: ToolName.ContextAnalyzer,
        score: 60,
        factors: [],
        rawMetrics: {},
        recommendations: [],
      });

      const config = {
        tools: {
          [ToolName.PatternDetect]: { scoreWeight: 1 },
          [ToolName.ContextAnalyzer]: { scoreWeight: 1 },
        },
      };

      const result = calculateOverallScore(toolOutputs, config as any);
      expect(result.overall).toBe(70);
      expect(result.toolsUsed).toContain(ToolName.PatternDetect);
      expect(result.toolsUsed).toContain(ToolName.ContextAnalyzer);
    });
  });

  describe('getRatingWithContext', () => {
    it('should return rating based on normalized score', () => {
      const rating = getRatingWithContext(80, 10, 'standard');
      expect(rating).toBeDefined();
    });
  });

  describe('getRatingDisplay', () => {
    it('should return correct emoji and color', () => {
      expect(getRatingDisplay(ReadinessRating.Excellent).color).toBe('green');
      expect(getRatingDisplay(ReadinessRating.Critical).color).toBe('red');
      expect(getRatingDisplay('Unknown').emoji).toBe('❓');
    });
  });

  describe('formatScore', () => {
    it('should format score string', () => {
      const result = { overall: 85, rating: ReadinessRating.Good } as any;
      expect(formatScore(result)).toContain('85/100');
      expect(formatScore(result)).toContain('(Good)');
    });
  });

  describe('formatToolScore', () => {
    it('should format tool score with factors and recommendations', () => {
      const output: ToolScoringOutput = {
        toolName: ToolName.PatternDetect,
        score: 75,
        rawMetrics: {},
        factors: [
          { name: 'Factor 1', impact: -5, description: 'Desc 1' },
          { name: 'Factor 2', impact: 10, description: 'Desc 2' },
        ],
        recommendations: [
          {
            action: 'Fix this',
            priority: RecommendationPriority.High,
            estimatedImpact: 10,
          },
          {
            action: 'Do that',
            priority: RecommendationPriority.Medium,
            estimatedImpact: 5,
          },
        ],
      };
      const formatted = formatToolScore(output);
      expect(formatted).toContain('Score: 75/100');
      expect(formatted).toContain('Factor 1: -5');
      expect(formatted).toContain('Factor 2: +10');
      expect(formatted).toContain('Fix this');
      expect(formatted).toContain('🔴');
      expect(formatted).toContain('🟡');
    });

    it('should handle missing factors/recommendations', () => {
      const output: ToolScoringOutput = {
        toolName: ToolName.PatternDetect,
        score: 90,
        rawMetrics: {},
        factors: [],
        recommendations: [],
      };
      const formatted = formatToolScore(output);
      expect(formatted).toContain('Score: 90/100');
      expect(formatted).not.toContain('Factors:');
      expect(formatted).not.toContain('Recommendations:');
    });
  });
});

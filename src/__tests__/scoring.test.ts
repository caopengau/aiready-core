import { describe, it, expect } from 'vitest';
import {
  calculateOverallScore,
  getRating,
  parseWeightString,
  normalizeToolName,
  getToolWeight,
  DEFAULT_TOOL_WEIGHTS,
  type ToolScoringOutput,
} from '../scoring';

describe('Core Scoring Infrastructure', () => {
  describe('calculateOverallScore', () => {
    it('should calculate weighted average correctly', () => {
      const toolOutputs = new Map<string, ToolScoringOutput>([
        [
          'pattern-detect',
          {
            toolName: 'pattern-detect',
            score: 80,
            rawMetrics: {},
            factors: [],
            recommendations: [],
          },
        ],
        [
          'context-analyzer',
          {
            toolName: 'context-analyzer',
            score: 60,
            rawMetrics: {},
            factors: [],
            recommendations: [],
          },
        ],
      ]);

      // Default weights: pattern-detect=40, context-analyzer=35
      // (80 * 40 + 60 * 35) / (40 + 35) = (3200 + 2100) / 75 = 5300 / 75 = 70.67 → 71
      const result = calculateOverallScore(toolOutputs);

      expect(result.overall).toBe(71);
      expect(result.rating).toBe('Fair'); // 71 is in Fair range (60-74)
      expect(result.toolsUsed).toEqual(['pattern-detect', 'context-analyzer']);
      expect(result.breakdown).toHaveLength(2);
    });

    it('should apply CLI weight overrides', () => {
      const toolOutputs = new Map<string, ToolScoringOutput>([
        [
          'pattern-detect',
          {
            toolName: 'pattern-detect',
            score: 80,
            rawMetrics: {},
            factors: [],
            recommendations: [],
          },
        ],
        [
          'context-analyzer',
          {
            toolName: 'context-analyzer',
            score: 60,
            rawMetrics: {},
            factors: [],
            recommendations: [],
          },
        ],
      ]);

      const cliWeights = new Map([
        ['pattern-detect', 50],
        ['context-analyzer', 50],
      ]);

      // Equal weights: (80 * 50 + 60 * 50) / 100 = 7000 / 100 = 70
      const result = calculateOverallScore(toolOutputs, undefined, cliWeights);

      expect(result.overall).toBe(70);
      expect(result.calculation.weights['pattern-detect']).toBe(50);
      expect(result.calculation.weights['context-analyzer']).toBe(50);
    });

    it('should handle single tool scoring', () => {
      const toolOutputs = new Map<string, ToolScoringOutput>([
        [
          'pattern-detect',
          {
            toolName: 'pattern-detect',
            score: 85,
            rawMetrics: {},
            factors: [],
            recommendations: [],
          },
        ],
      ]);

      const result = calculateOverallScore(toolOutputs);

      expect(result.overall).toBe(85);
      expect(result.toolsUsed).toEqual(['pattern-detect']);
    });

    it('should apply config weights when no CLI override', () => {
      const toolOutputs = new Map<string, ToolScoringOutput>([
        [
          'pattern-detect',
          {
            toolName: 'pattern-detect',
            score: 90,
            rawMetrics: {},
            factors: [],
            recommendations: [],
          },
        ],
      ]);

      const config = {
        tools: {
          'pattern-detect': {
            scoreWeight: 60,
          },
        },
      };

      const result = calculateOverallScore(toolOutputs, config);

      expect(result.overall).toBe(90);
      expect(result.calculation.weights['pattern-detect']).toBe(60);
    });

    it('should throw error when no tool outputs provided', () => {
      const toolOutputs = new Map<string, ToolScoringOutput>();

      expect(() => calculateOverallScore(toolOutputs)).toThrow(
        'No tool outputs provided for scoring'
      );
    });
  });

  describe('getRating', () => {
    it('should return correct ratings for score ranges', () => {
      expect(getRating(100)).toBe('Excellent');
      expect(getRating(90)).toBe('Excellent');
      expect(getRating(89)).toBe('Good');
      expect(getRating(75)).toBe('Good');
      expect(getRating(74)).toBe('Fair');
      expect(getRating(60)).toBe('Fair');
      expect(getRating(59)).toBe('Needs Work');
      expect(getRating(40)).toBe('Needs Work');
      expect(getRating(39)).toBe('Critical');
      expect(getRating(0)).toBe('Critical');
    });
  });

  describe('parseWeightString', () => {
    it('should parse valid weight string', () => {
      const weights = parseWeightString('patterns:50,context:30,consistency:20');

      expect(weights.get('pattern-detect')).toBe(50);
      expect(weights.get('context-analyzer')).toBe(30);
      expect(weights.get('consistency')).toBe(20);
    });

    it('should return empty map for undefined input', () => {
      const weights = parseWeightString(undefined);

      expect(weights.size).toBe(0);
    });

    it('should skip invalid pairs', () => {
      const weights = parseWeightString('patterns:50,invalid,context:abc,consistency:30');

      expect(weights.get('pattern-detect')).toBe(50);
      expect(weights.get('context-analyzer')).toBeUndefined();
      expect(weights.get('consistency')).toBe(30);
    });
  });

  describe('normalizeToolName', () => {
    it('should normalize shorthand tool names', () => {
      expect(normalizeToolName('patterns')).toBe('pattern-detect');
      expect(normalizeToolName('context')).toBe('context-analyzer');
      expect(normalizeToolName('consistency')).toBe('consistency');
    });

    it('should return full names unchanged', () => {
      expect(normalizeToolName('pattern-detect')).toBe('pattern-detect');
      expect(normalizeToolName('context-analyzer')).toBe('context-analyzer');
    });

    it('should return unknown names unchanged', () => {
      expect(normalizeToolName('unknown-tool')).toBe('unknown-tool');
    });
  });

  describe('getToolWeight', () => {
    it('should prioritize CLI override', () => {
      const weight = getToolWeight(
        'pattern-detect',
        { scoreWeight: 30 },
        50
      );

      expect(weight).toBe(50);
    });

    it('should use config weight when no CLI override', () => {
      const weight = getToolWeight(
        'pattern-detect',
        { scoreWeight: 30 },
        undefined
      );

      expect(weight).toBe(30);
    });

    it('should fall back to default weight', () => {
      const weight = getToolWeight('pattern-detect', undefined, undefined);

      expect(weight).toBe(DEFAULT_TOOL_WEIGHTS['pattern-detect']);
    });

    it('should use 10 for unknown tools', () => {
      const weight = getToolWeight('unknown-tool', undefined, undefined);

      expect(weight).toBe(10);
    });
  });
});

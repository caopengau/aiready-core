import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TOOL_WEIGHTS,
  TOOL_NAME_MAP,
  getRating,
  getRatingSlug,
} from '../scoring';
import { ToolName } from '../types';

describe('Scoring Engine Extended Tests', () => {
  describe('Tool Weight Configuration', () => {
    it('should have weights for all core tools', () => {
      const tools = Object.values(ToolName);
      tools.forEach((tool) => {
        expect(DEFAULT_TOOL_WEIGHTS[tool]).toBeDefined();
        expect(DEFAULT_TOOL_WEIGHTS[tool]).toBeGreaterThan(0);
      });
    });

    it('should have highest weight for pattern-detect', () => {
      expect(DEFAULT_TOOL_WEIGHTS[ToolName.PatternDetect]).toBe(22);
    });

    it('should total to a reasonable sum for normalization', () => {
      const total = Object.values(DEFAULT_TOOL_WEIGHTS).reduce(
        (sum, w) => sum + w,
        0
      );
      // Based on formula in report: 154 (expanded with cognitive, entropy, cohesion, distance)
      expect(total).toBe(154);
    });
  });

  describe('Tool Name Mapping', () => {
    it('should map various aliases correctly', () => {
      expect(TOOL_NAME_MAP['patterns']).toBe(ToolName.PatternDetect);
      expect(TOOL_NAME_MAP['context']).toBe(ToolName.ContextAnalyzer);
      expect(TOOL_NAME_MAP['naming-consistency']).toBe(
        ToolName.NamingConsistency
      );
      expect(TOOL_NAME_MAP['ai-signal-clarity']).toBe(ToolName.AiSignalClarity);
    });

    it('should support shorthand aliases', () => {
      expect(TOOL_NAME_MAP['grounding']).toBe(ToolName.AgentGrounding);
      expect(TOOL_NAME_MAP['testability']).toBe(ToolName.TestabilityIndex);
      expect(TOOL_NAME_MAP['contract']).toBe(ToolName.ContractEnforcement);
    });
  });

  describe('Rating Helpers', () => {
    it('should return correct rating for scores', () => {
      expect(getRating(95)).toBe('Excellent');
      expect(getRating(85)).toBe('Good');
      expect(getRating(75)).toBe('Good');
      expect(getRating(65)).toBe('Fair');
      expect(getRating(55)).toBe('Needs Work');
      expect(getRating(30)).toBe('Critical');
    });

    it('should return correct slugs for scores', () => {
      expect(getRatingSlug(95)).toBe('excellent');
      expect(getRatingSlug(85)).toBe('good');
      expect(getRatingSlug(75)).toBe('good');
      expect(getRatingSlug(55)).toBe('needs-work');
      expect(getRatingSlug(30)).toBe('critical');
    });
  });
});

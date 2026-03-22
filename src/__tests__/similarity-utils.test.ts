import { describe, it, expect } from 'vitest';
import {
  calculateStringSimilarity,
  calculateHeuristicConfidence,
} from '../utils/similarity';

describe('similarity utils', () => {
  describe('calculateStringSimilarity', () => {
    it('should return 1.0 for identical strings', () => {
      expect(calculateStringSimilarity('hello world', 'hello world')).toBe(1.0);
    });

    it('should return 0 for completely different strings', () => {
      expect(calculateStringSimilarity('abc', 'xyz')).toBe(0);
    });

    it('should compute Jaccard similarity correctly', () => {
      // {a, b, c} and {b, c, d}
      // Intersection: {b, c} (size 2)
      // Union: {a, b, c, d} (size 4)
      // Expected: 2/4 = 0.5
      expect(calculateStringSimilarity('a b c', 'b c d')).toBe(0.5);
    });

    it('should be robust to non-alphanumeric characters', () => {
      expect(
        calculateStringSimilarity(
          'function foo() { return 1; }',
          'function bar() { return 1; }'
        )
      ).toBeGreaterThan(0.5);
    });
  });

  describe('calculateHeuristicConfidence', () => {
    it('should boost confidence for large blocks', () => {
      const small = calculateHeuristicConfidence(0.8, 10, 2);
      const large = calculateHeuristicConfidence(0.8, 500, 30);
      expect(large).toBeGreaterThan(small);
    });

    it('should penalize confidence for very small blocks', () => {
      const normal = calculateHeuristicConfidence(0.9, 50, 6);
      const tiny = calculateHeuristicConfidence(0.9, 10, 2);
      expect(tiny).toBeLessThan(normal);
    });

    it('should clamp values between 0 and 1', () => {
      expect(calculateHeuristicConfidence(1.0, 1000, 100)).toBe(1.0);
      expect(calculateHeuristicConfidence(0.1, 5, 2)).toBeGreaterThanOrEqual(0);
    });
  });
});

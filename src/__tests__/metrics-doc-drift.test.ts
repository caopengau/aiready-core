import { describe, it, expect } from 'vitest';
import { calculateDocDrift } from '../metrics/doc-drift';

describe('Doc Drift Metric', () => {
  it('should calculate minimal risk for fully documented code', () => {
    const result = calculateDocDrift({
      uncommentedExports: 0,
      totalExports: 10,
      outdatedComments: 0,
      undocumentedComplexity: 0,
      actualDrift: 0,
    });

    expect(result.score).toBe(100);
    expect(result.rating).toBe('minimal');
  });

  it('should calculate high risk for outdated comments', () => {
    const result = calculateDocDrift({
      uncommentedExports: 2,
      totalExports: 10,
      outdatedComments: 5,
      undocumentedComplexity: 1,
      actualDrift: 0,
    });

    expect(result.score).toBeGreaterThan(40);
    expect(['moderate', 'high', 'severe']).toContain(result.rating);
    expect(result.recommendations[0]).toContain('outdated');
  });
});

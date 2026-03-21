import { describe, it, expect } from 'vitest';
import { IssueTypeSchema } from '../types';

describe('Issue Types', () => {
  it('should validate all known issue types', () => {
    const types = [
      'duplicate-pattern',
      'context-fragmentation',
      'naming-inconsistency',
      'ai-signal-clarity',
      'low-testability',
    ];

    types.forEach((t) => {
      expect(IssueTypeSchema.parse(t)).toBe(t);
    });
  });

  it('should fail on unknown issue type', () => {
    expect(() => IssueTypeSchema.parse('unknown-type')).toThrow();
  });
});

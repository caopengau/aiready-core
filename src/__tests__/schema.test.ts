import { describe, it, expect } from 'vitest';
import {
  SeveritySchema,
  ToolNameSchema,
  IssueSchema,
  SpokeOutputSchema,
} from '../types';

describe('Zod Schemas', () => {
  it('should validate valid severities', () => {
    expect(SeveritySchema.parse('critical')).toBe('critical');
    expect(() => SeveritySchema.parse('invalid')).toThrow();
  });

  it('should validate tool names', () => {
    expect(ToolNameSchema.parse('pattern-detect')).toBe('pattern-detect');
  });

  it('should validate a standard issue', () => {
    const issue = {
      type: 'duplicate-pattern',
      severity: 'major',
      message: 'test',
      location: { file: 'f.ts', line: 1 },
    };
    expect(IssueSchema.parse(issue)).toEqual(issue);
  });

  it('should validate spoke output', () => {
    const output = {
      results: [],
      summary: { totalFiles: 0 },
      metadata: { toolName: 'test' },
    };
    expect(SpokeOutputSchema.parse(output)).toEqual(output);
  });
});

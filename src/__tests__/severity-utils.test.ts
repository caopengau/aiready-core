import { describe, it, expect } from 'vitest';
import { Severity } from '../types';
import {
  normalizeSeverity,
  getSeverityValue,
  getSeverityLevel,
  getSeverityEnum,
} from '../utils/cli-utils';

describe('Severity Utils', () => {
  it('normalizeSeverity should map strings to Severity enum', () => {
    expect(normalizeSeverity('critical')).toBe(Severity.Critical);
    expect(normalizeSeverity('major')).toBe(Severity.Major);
    expect(normalizeSeverity('minor')).toBe(Severity.Minor);
    expect(normalizeSeverity('info')).toBe(Severity.Info);
  });

  it('getSeverityValue should return numeric values', () => {
    expect(getSeverityValue('critical')).toBe(4);
    expect(getSeverityValue('major')).toBe(3);
    expect(getSeverityValue('minor')).toBe(2);
    expect(getSeverityValue('info')).toBe(1);
  });

  it('getSeverityLevel should be alias for getSeverityValue', () => {
    expect(getSeverityLevel('critical')).toBe(4);
  });

  it('getSeverityEnum should return normalized strings', () => {
    expect(getSeverityEnum('critical')).toBe('critical');
    expect(getSeverityEnum('major')).toBe('major');
  });
});

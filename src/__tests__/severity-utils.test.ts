import { describe, it, expect } from 'vitest';
import {
  normalizeSeverity,
  getSeverityValue,
  getSeverityLevel,
  getSeverityEnum,
  getSeverityColor,
  getSeverityBadge,
  getSeverityLabel,
  filterBySeverity,
} from '../utils/severity-utils';
import { Severity } from '../types';

describe('severity-utils', () => {
  describe('normalizeSeverity', () => {
    it('should normalize critical values', () => {
      expect(normalizeSeverity('critical')).toBe(Severity.Critical);
      expect(normalizeSeverity('high-risk')).toBe(Severity.Critical);
      expect(normalizeSeverity('blind-risk')).toBe(Severity.Critical);
    });

    it('should normalize major values', () => {
      expect(normalizeSeverity('major')).toBe(Severity.Major);
      expect(normalizeSeverity('moderate-risk')).toBe(Severity.Major);
    });

    it('should normalize minor values', () => {
      expect(normalizeSeverity('minor')).toBe(Severity.Minor);
      expect(normalizeSeverity('safe')).toBe(Severity.Minor);
    });

    it('should return null for unknown values', () => {
      expect(normalizeSeverity('unknown')).toBeNull();
      expect(normalizeSeverity(undefined)).toBeNull();
    });
  });

  describe('getSeverityValue', () => {
    it('should return correct numeric values', () => {
      expect(getSeverityValue('critical')).toBe(4);
      expect(getSeverityValue('major')).toBe(3);
      expect(getSeverityValue('minor')).toBe(2);
      expect(getSeverityValue('info')).toBe(1);
      expect(getSeverityValue('unknown')).toBe(0);
    });

    it('getSeverityLevel should be an alias for getSeverityValue', () => {
      expect(getSeverityLevel('critical')).toBe(4);
    });
  });

  describe('getSeverityEnum', () => {
    it('should return string representation of severity enum', () => {
      expect(getSeverityEnum('critical')).toBe('critical');
      expect(getSeverityEnum('major')).toBe('major');
      expect(getSeverityEnum('minor')).toBe('minor');
      expect(getSeverityEnum('unknown')).toBe('info');
    });
  });

  describe('getSeverityColor', () => {
    it('should return a function for known severities', () => {
      const mockChalk = {
        red: (s: any) => s,
        yellow: (s: any) => s,
        white: (s: any) => s,
      };
      expect(getSeverityColor('critical', mockChalk)).toBe(mockChalk.red);
      expect(getSeverityColor('major', mockChalk)).toBe(mockChalk.yellow);
      expect(getSeverityColor('unknown', mockChalk)).toBe(mockChalk.white);
    });
  });

  describe('getSeverityBadge', () => {
    it('should return colored strings for severities', () => {
      const mockChalk: any = {
        bgRed: { white: { bold: (s: any) => `RED_${s}` } },
        bgCyan: { black: (s: any) => `CYAN_${s}` },
      };
      expect(getSeverityBadge('critical', mockChalk)).toBe('RED_ CRITICAL ');
      expect(getSeverityBadge('unknown', mockChalk)).toBe('CYAN_ UNKNOWN ');
    });
  });

  describe('getSeverityLabel', () => {
    it('should return correct label with emoji', () => {
      expect(getSeverityLabel(Severity.Critical)).toContain('🔴');
      expect(getSeverityLabel(Severity.Major)).toContain('🟡');
    });
  });

  describe('filterBySeverity', () => {
    const items = [
      { id: 1, severity: Severity.Info },
      { id: 2, severity: Severity.Minor },
      { id: 3, severity: Severity.Major },
      { id: 4, severity: Severity.Critical },
    ];

    it('should filter items by minimum threshold', () => {
      const filtered = filterBySeverity(items, Severity.Major);
      expect(filtered).toHaveLength(2);
      expect(filtered.map((i) => i.id)).toContain(3);
      expect(filtered.map((i) => i.id)).toContain(4);
    });

    it('should include all items for info threshold', () => {
      const filtered = filterBySeverity(items, Severity.Info);
      expect(filtered).toHaveLength(4);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getReportTimestamp,
  resolveOutputFormat,
  formatStandardReport,
} from '../utils/cli-action-helpers';

describe('cli-action-helpers', () => {
  describe('getReportTimestamp', () => {
    it('should generate a timestamp in YYYYMMDD-HHMMSS format', () => {
      const timestamp = getReportTimestamp();
      expect(timestamp).toMatch(/^\d{8}-\d{6}$/);
    });

    it('should match the current date', () => {
      const now = new Date();
      const timestamp = getReportTimestamp();
      const year = now.getFullYear().toString();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const day = now.getDate().toString().padStart(2, '0');

      expect(timestamp.substring(0, 4)).toBe(year);
      expect(timestamp.substring(4, 6)).toBe(month);
      expect(timestamp.substring(6, 8)).toBe(day);
    });
  });

  describe('resolveOutputFormat', () => {
    it('should prefer options over config', () => {
      const options = { output: 'json', outputFile: 'opt.json' };
      const config = { output: { format: 'console', file: 'conf.json' } };

      const result = resolveOutputFormat(options, config);
      expect(result.format).toBe('json');
      expect(result.file).toBe('opt.json');
    });

    it('should use config if options are missing', () => {
      const options = {};
      const config = { output: { format: 'json', file: 'conf.json' } };

      const result = resolveOutputFormat(options, config);
      expect(result.format).toBe('json');
      expect(result.file).toBe('conf.json');
    });

    it('should default to console if both are missing', () => {
      const options = {};
      const config = {};

      const result = resolveOutputFormat(options, config);
      expect(result.format).toBe('console');
      expect(result.file).toBeUndefined();
    });
  });

  describe('formatStandardReport', () => {
    it('should format report with results and summary', () => {
      const results = [{ id: 1 }];
      const summary = { count: 1 };
      const elapsedTime = '1.23';

      const report = formatStandardReport({ results, summary, elapsedTime });

      expect(report.results).toEqual(results);
      expect(report.summary.count).toBe(1);
      expect(report.summary.executionTime).toBe(1.23);
    });

    it('should include scoring if provided', () => {
      const results: any[] = [];
      const summary = {};
      const elapsedTime = '0.5';
      const score = { score: 80, rating: 'A', breakdown: {} } as any;

      const report = formatStandardReport({
        results,
        summary,
        elapsedTime,
        score,
      });

      expect(report.scoring).toEqual(score);
    });

    it('should use report base if provided', () => {
      const reportBase = { existing: true, summary: { old: true } };
      const summary = { count: 1 };
      const elapsedTime = '2.0';

      const report = formatStandardReport({
        report: reportBase,
        summary,
        elapsedTime,
      });

      expect(report.existing).toBe(true);
      expect(report.summary.old).toBe(true);
      expect(report.summary.executionTime).toBe(2.0);
    });
  });
});

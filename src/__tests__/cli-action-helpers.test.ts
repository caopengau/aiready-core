import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getReportTimestamp,
  resolveOutputFormat,
  formatStandardReport,
  handleStandardJSONOutput,
  prepareActionConfig,
} from '../utils/cli-action-helpers';
import {
  loadMergedConfig,
  resolveOutputPath,
  handleJSONOutput,
} from '../utils/cli-helpers';

// Mock cli-helpers
vi.mock('../utils/cli-helpers', () => ({
  loadMergedConfig: vi.fn(),
  resolveOutputPath: vi.fn(),
  handleJSONOutput: vi.fn(),
}));

describe('cli-action-helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  describe('handleStandardJSONOutput', () => {
    it('should resolve path and handle output', () => {
      (resolveOutputPath as any).mockReturnValue('/resolved/path.json');

      handleStandardJSONOutput({
        outputData: { test: true },
        outputFile: 'out.json',
        resolvedDir: '/work',
        prefix: 'test-prefix',
      });

      expect(resolveOutputPath).toHaveBeenCalledWith(
        'out.json',
        expect.stringContaining('test-prefix-'),
        '/work'
      );
      expect(handleJSONOutput).toHaveBeenCalledWith(
        { test: true },
        '/resolved/path.json',
        expect.stringContaining('✅ Results saved to /resolved/path.json')
      );
    });
  });

  describe('prepareActionConfig', () => {
    it('should resolve directory and load config', async () => {
      const defaults = { opt: 1 };
      const cliOptions = { opt: 2 };
      (loadMergedConfig as any).mockResolvedValue({ opt: 2, merged: true });

      const result = await prepareActionConfig(
        '/some/dir',
        defaults,
        cliOptions
      );

      expect(result.resolvedDir).toContain('/some/dir');
      expect(result.finalOptions).toEqual({ opt: 2, merged: true });
      expect(loadMergedConfig).toHaveBeenCalledWith(
        expect.stringContaining('/some/dir'),
        defaults,
        cliOptions
      );
    });

    it('should handle null directory', async () => {
      (loadMergedConfig as any).mockResolvedValue({});
      const result = await prepareActionConfig(null as any, {}, {});
      expect(result.resolvedDir).toBe(process.cwd());
    });
  });
});

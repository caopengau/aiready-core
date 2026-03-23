import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { join } from 'path';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import {
  resolveOutputPath,
  handleJSONOutput,
  findLatestReport,
} from '../utils/fs-utils';

describe('FS Utils', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = join(tmpdir(), `aiready-fs-utils-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('resolveOutputPath', () => {
    it('should use user-provided path', () => {
      const userPath = join(tmpDir, 'custom', 'output.json');
      const result = resolveOutputPath(userPath, 'default.json', tmpDir);
      expect(result).toBe(userPath);
    });

    it('should create default .aiready directory path', () => {
      const result = resolveOutputPath(undefined, 'report.json', tmpDir);
      expect(result).toContain('.aiready');
      expect(result).toMatch(/report\.json$/);
    });
  });

  describe('handleJSONOutput', () => {
    it('should write to file', () => {
      const outFile = join(tmpDir, 'out.json');
      const data = { test: true };
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      handleJSONOutput(data, outFile, 'Success');
      expect(existsSync(outFile)).toBe(true);
      consoleSpy.mockRestore();
    });
  });

  describe('findLatestReport', () => {
    it('should find new format report files', () => {
      const reportDir = join(tmpDir, 'reports-new');
      mkdirSync(join(reportDir, '.aiready'), { recursive: true });
      writeFileSync(join(reportDir, '.aiready', 'aiready-report-1.json'), '{}');

      const result = findLatestReport(reportDir);
      expect(result).toMatch(/aiready-report-\d+\.json$/);
    });
  });
});

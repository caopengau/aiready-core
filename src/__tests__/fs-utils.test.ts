import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  vi,
} from 'vitest';
import { join } from 'path';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import {
  resolveOutputPath,
  handleJSONOutput,
  findLatestReport,
  findLatestScanReport,
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

    it('should handle file as workingDir', () => {
      const filePath = join(tmpDir, 'test.txt');
      writeFileSync(filePath, 'test');
      const result = resolveOutputPath(undefined, 'report.json', filePath);
      expect(result).toBe(join(tmpDir, '.aiready', 'report.json'));
    });

    it('should ignore non-existent workingDir during resolution', () => {
      const nonExistent = join(tmpDir, 'no-exist');
      const result = resolveOutputPath(undefined, 'report.json', nonExistent);
      expect(result).toBe(join(nonExistent, '.aiready', 'report.json'));
    });
  });

  describe('handleJSONOutput', () => {
    let consoleSpy: any;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should write to file', () => {
      const outFile = join(tmpDir, 'out.json');
      const data = { test: true };

      handleJSONOutput(data, outFile, 'Success');
      expect(existsSync(outFile)).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('Success');
    });

    it('should log to console if no file provided', () => {
      const data = { test: true };
      handleJSONOutput(data);
      expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
    });
  });

  describe('findLatestReport', () => {
    it('should find new format report files', () => {
      const reportDir = join(tmpDir, 'reports-new');
      mkdirSync(join(reportDir, '.aiready'), { recursive: true });
      const reportPath = join(reportDir, '.aiready', 'aiready-report-1.json');
      writeFileSync(reportPath, '{}');

      const result = findLatestReport(reportDir);
      expect(result).toBe(reportPath);
    });

    it('should find legacy format if new format is missing', () => {
      const reportDir = join(tmpDir, 'reports-legacy');
      mkdirSync(join(reportDir, '.aiready'), { recursive: true });
      const reportPath = join(reportDir, '.aiready', 'aiready-scan-1.json');
      writeFileSync(reportPath, '{}');

      const result = findLatestReport(reportDir);
      expect(result).toBe(reportPath);
    });

    it('should return null if no reports found', () => {
      const reportDir = join(tmpDir, 'no-reports');
      mkdirSync(reportDir, { recursive: true });
      expect(findLatestReport(reportDir)).toBeNull();
    });

    it('should sort reports by mtime', async () => {
      const reportDir = join(tmpDir, 'reports-sort');
      const aireadyDir = join(reportDir, '.aiready');
      mkdirSync(aireadyDir, { recursive: true });

      const oldPath = join(aireadyDir, 'aiready-report-old.json');
      const newPath = join(aireadyDir, 'aiready-report-new.json');

      writeFileSync(oldPath, '{}');
      // Wait a bit to ensure different mtime
      await new Promise((resolve) => setTimeout(resolve, 100));
      writeFileSync(newPath, '{}');

      const result = findLatestReport(reportDir);
      expect(result).toBe(newPath);
    });
  });

  describe('findLatestScanReport', () => {
    it('should find report by ID in name', () => {
      const reportDir = join(tmpDir, 'scan-reports');
      mkdirSync(reportDir, { recursive: true });
      writeFileSync(join(reportDir, 'report-1.json'), '{}');
      const latestPath = join(reportDir, 'report-10.json');
      writeFileSync(latestPath, '{}');
      writeFileSync(join(reportDir, 'report-2.json'), '{}');

      const result = findLatestScanReport(reportDir, 'report-');
      expect(result).toBe(latestPath);
    });

    it('should return null if no matching prefix found', () => {
      const reportDir = join(tmpDir, 'scan-reports-none');
      mkdirSync(reportDir, { recursive: true });
      expect(findLatestScanReport(reportDir, 'other-')).toBeNull();
    });

    it('should handle invalid input gracefully', () => {
      expect(findLatestScanReport(null as any, 'report-')).toBeNull();
    });
  });
});

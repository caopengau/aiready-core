import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import {
  ensureDir,
  getFilesByPattern,
  resolveOutputPath,
  handleJSONOutput,
  findLatestReport,
  findLatestScanReport,
} from '../utils/fs-utils';

vi.mock('fs');

describe('fs-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ensureDir', () => {
    it('should create directory if it does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      ensureDir('/path/to/file.ts');
      expect(fs.mkdirSync).toHaveBeenCalledWith('/path/to', {
        recursive: true,
      });
    });

    it('should do nothing if directory exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      ensureDir('/path/to/file.ts');
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('getFilesByPattern', () => {
    it('should return empty array if dir does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(getFilesByPattern('/dir', /./)).toEqual([]);
    });

    it('should return filtered files', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        'a.ts',
        'b.js',
        'c.py',
      ] as any);
      expect(getFilesByPattern('/dir', /\.ts$/)).toEqual(['a.ts']);
    });

    it('should catch readdirSync errors', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockImplementation(() => {
        throw new Error('fail');
      });
      expect(getFilesByPattern('/dir', /./)).toEqual([]);
    });
  });

  describe('resolveOutputPath', () => {
    it('should use user path if provided', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const path = resolveOutputPath('/custom/out.json', 'default.json');
      expect(path).toBe('/custom/out.json');
    });

    it('should resolve relative to workingDir if it is a file', () => {
      vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as any);
      const path = resolveOutputPath(undefined, 'report.json', '/root/file.ts');
      expect(path).toContain('/root/.aiready/report.json');
    });

    it('should handle statSync errors gracefully', () => {
      vi.mocked(fs.statSync).mockImplementation(() => {
        throw new Error('fail');
      });
      const path = resolveOutputPath(undefined, 'report.json', '/nonexistent');
      expect(path).toContain('/nonexistent/.aiready/report.json');
    });
  });

  describe('handleJSONOutput', () => {
    it('should write to file and show success message', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      handleJSONOutput({ a: 1 }, '/out.json', 'Done!');
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith('Done!');

      handleJSONOutput({ a: 1 }, '/out2.json');
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ Results saved to /out2.json')
      );
      logSpy.mockRestore();
    });

    it('should log to console if no file provided', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      handleJSONOutput({ b: 2 });
      expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ b: 2 }, null, 2));
      logSpy.mockRestore();
    });
  });

  describe('findLatestReport', () => {
    it('should find new format report', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        'aiready-report-1.json',
        'aiready-report-2.json',
      ] as any);
      vi.mocked(fs.statSync).mockImplementation(
        (path: any) =>
          ({
            mtime: path.toString().includes('2')
              ? new Date(2000)
              : new Date(1000),
          }) as any
      );

      const latest = findLatestReport('/root');
      expect(latest).toContain('aiready-report-2.json');
    });

    it('should fall back to legacy format', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockImplementation((path: any) => {
        if (path.toString().includes('.aiready')) {
          // Return no new reports, but legacy reports
          return ['aiready-scan-1.json'] as any;
        }
        return [] as any;
      });
      vi.mocked(fs.statSync).mockReturnValue({ mtime: new Date() } as any);

      const latest = findLatestReport('/root');
      expect(latest).toContain('aiready-scan-1.json');
    });

    it('should return null if no reports found', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([]);
      expect(findLatestReport('/root')).toBeNull();
    });
  });

  describe('findLatestScanReport', () => {
    it('should find latest by ID and handle filenames without digits', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        'r-10.json',
        'r-a.json',
        'r-20.json',
      ] as any);

      const latest = findLatestScanReport('/root', 'r-');
      expect(latest).toContain('r-20.json');
    });

    it('should return null if no report files match prefix', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['other.json'] as any);
      expect(findLatestScanReport('/root', 'r-')).toBeNull();
    });

    it('should return null on error', () => {
      // Mock the helper to throw, which will be caught by findLatestScanReport's try-catch
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      // Note: we can't easily mock getFilesByPattern directly because it's in the same file
      // and not exported in a way that vi.mock can easily intercept internal calls.
      // But we can trigger an error in the sort or other logic.

      // Actually, if we provide a malformed regex prefix, RegExp constructor might throw.
      expect(findLatestScanReport('/root', '[')).toBeNull();
      expect(errSpy).toHaveBeenCalled();
      errSpy.mockRestore();
    });
  });
});

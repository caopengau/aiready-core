import { describe, it, expect, vi } from 'vitest';
import {
  getFileCommitTimestamps,
  getLineRangeLastModifiedCached,
  getRepoMetadata,
} from '../utils/history-git';
import { execSync } from 'child_process';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('history-git', () => {
  describe('getFileCommitTimestamps', () => {
    it('should parse git blame output correctly', () => {
      const mockOutput =
        'f3a4b5c6 (Author 1234567890 -0700 1) Line 1\nd3e4f5g6 (Author 1234567891 -0700 2) Line 2\n';
      (execSync as any).mockReturnValue(mockOutput);

      const result = getFileCommitTimestamps('test.ts');
      expect(result[1]).toBe(1234567890);
      expect(result[2]).toBe(1234567891);
    });

    it('should return empty object on error', () => {
      (execSync as any).mockImplementation(() => {
        throw new Error('Git not found');
      });
      const result = getFileCommitTimestamps('test.ts');
      expect(result).toEqual({});
    });
  });

  describe('getLineRangeLastModifiedCached', () => {
    it('should return the latest timestamp in range', () => {
      const stamps = { 1: 100, 2: 200, 3: 150 };
      expect(getLineRangeLastModifiedCached(stamps, 1, 3)).toBe(200);
      expect(getLineRangeLastModifiedCached(stamps, 1, 1)).toBe(100);
    });
  });

  describe('getRepoMetadata', () => {
    it('should fetch repository details', () => {
      (execSync as any).mockImplementation((cmd: string) => {
        if (cmd.includes('remote.origin.url'))
          return 'https://github.com/test/repo.git';
        if (cmd.includes('rev-parse --abbrev-ref')) return 'main';
        if (cmd.includes('rev-parse HEAD')) return 'abc123commit';
        if (cmd.includes('log -1')) return 'engineer@example.com';
        return '';
      });

      const metadata = getRepoMetadata('.');
      expect(metadata.url).toBe('https://github.com/test/repo.git');
      expect(metadata.branch).toBe('main');
      expect(metadata.commit).toBe('abc123commit');
      expect(metadata.author).toBe('engineer@example.com');
    });

    it('should handle missing git properties gracefully', () => {
      (execSync as any).mockImplementation((cmd: string) => {
        if (cmd.includes('remote.origin.url')) throw new Error('No remote');
        return 'fallback';
      });

      const metadata = getRepoMetadata('.');
      expect(metadata.url).toBeUndefined();
      expect(metadata.branch).toBe('fallback');
    });
  });
});

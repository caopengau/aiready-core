import { describe, it, expect } from 'vitest';
import {
  getLineRangeLastModifiedCached,
  getRepoMetadata,
} from '../utils/history-git';

describe('Git History Utilities', () => {
  describe('getLineRangeLastModifiedCached', () => {
    it('should find the latest timestamp in range', () => {
      const lineStamps = {
        1: 1000,
        2: 2000,
        3: 1500,
        4: 500,
      };

      expect(getLineRangeLastModifiedCached(lineStamps, 1, 3)).toBe(2000);
      expect(getLineRangeLastModifiedCached(lineStamps, 3, 4)).toBe(1500);
    });
  });

  describe('getRepoMetadata', () => {
    it('should return metadata (even if partial/empty)', () => {
      // In a real test environment git might not be there or it's not a repo
      const meta = getRepoMetadata('.');
      expect(meta).toBeDefined();
      // Should at least have a branch since we are in a repo
      expect(meta.branch).toBeDefined();
    });
  });
});

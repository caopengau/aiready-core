import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode workspace
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(),
  },
}));

import { workspace } from 'vscode';
import { getMergedConfig, SMART_DEFAULTS } from '../config';

describe('Config Utils', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getMergedConfig', () => {
    it('should return smart defaults when no config is set', () => {
      const mockGet = vi.fn().mockImplementation((key, defaultValue) => defaultValue);
      (workspace.getConfiguration as any).mockReturnValue({ get: mockGet });

      const config = getMergedConfig();

      expect(workspace.getConfiguration).toHaveBeenCalledWith('aiready');
      expect(config.threshold).toBe(SMART_DEFAULTS.threshold);
      expect(config.tools).toEqual([...SMART_DEFAULTS.tools]);
      expect(config.failOn).toBe(SMART_DEFAULTS.failOn);
      expect(config.autoScan).toBe(SMART_DEFAULTS.autoScan);
      expect(config.showStatusBar).toBe(SMART_DEFAULTS.showStatusBar);
      expect(config.excludePatterns).toEqual([...SMART_DEFAULTS.excludePatterns]);
    });

    it('should return user config when set', () => {
      const userConfig = {
        threshold: 90,
        tools: ['patterns'],
        failOn: 'any',
        autoScan: true,
        showStatusBar: false,
        excludePatterns: ['node_modules/**'],
      };

      const mockGet = vi.fn().mockImplementation((key, defaultValue) => {
        return userConfig[key as keyof typeof userConfig] ?? defaultValue;
      });
      
      (workspace.getConfiguration as any).mockReturnValue({ get: mockGet });

      const config = getMergedConfig();

      expect(config.threshold).toBe(90);
      expect(config.tools).toEqual(['patterns']);
      expect(config.failOn).toBe('any');
      expect(config.autoScan).toBe(true);
      expect(config.showStatusBar).toBe(false);
      expect(config.excludePatterns).toEqual(['node_modules/**']);
    });

    it('should handle partial config correctly', () => {
      const mockGet = vi.fn().mockImplementation((key, defaultValue) => {
        if (key === 'threshold') return 80;
        return defaultValue;
      });
      
      (workspace.getConfiguration as any).mockReturnValue({ get: mockGet });

      const config = getMergedConfig();

      expect(config.threshold).toBe(80);
      expect(config.tools).toEqual([...SMART_DEFAULTS.tools]);
    });
  });
});

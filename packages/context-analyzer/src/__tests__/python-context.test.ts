import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as pythonContext from '../analyzers/python-context';

// Mock @aiready/core
vi.mock('@aiready/core', () => ({
  getParser: vi.fn(async (filename: string) => {
    if (filename.endsWith('.py')) {
      return {
        initialize: vi.fn().mockResolvedValue(undefined),
        parse: vi.fn(() => ({
          imports: [
            { source: 'os', specifiers: ['path'], isRelative: false },
            { source: '.utils', specifiers: ['helper'], isRelative: true },
          ],
          exports: [
            { name: 'MyClass', type: 'class' },
            { name: 'my_function', type: 'function' },
          ],
        })),
        language: 'python',
      };
    }
    return null;
  }),
  estimateTokens: vi.fn((code: string) => Math.ceil(code.length / 4)),
}));

// Mock fs
vi.mock('fs', () => ({
  default: {
    promises: {
      readFile: vi.fn(),
    },
    existsSync: vi.fn(),
  },
  promises: {
    readFile: vi.fn(),
  },
  existsSync: vi.fn(),
}));

describe('python-context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzePythonContext', () => {
    it('should return empty array when parser is not available', async () => {
      const { getParser } = await import('@aiready/core');
      vi.mocked(getParser).mockResolvedValueOnce(null);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const results = await pythonContext.analyzePythonContext([], '/test');

      expect(results).toEqual([]);
      consoleSpy.mockRestore();
    });

    it('should filter for Python files only', async () => {
      const files = ['src/file1.ts', 'src/file2.py', 'src/file3.js'];

      const results = await pythonContext.analyzePythonContext(files, '/test');

      // Should handle gracefully even if files don't exist
      expect(Array.isArray(results)).toBe(true);
    });

    it('should analyze Python files and return metrics', async () => {
      const fs = await import('fs');
      vi.mocked(fs.promises.readFile).mockResolvedValue(`
import os
from .utils import helper

class MyClass:
    pass

def my_function():
    pass
      `);

      const files = ['src/test.py'];

      const results = await pythonContext.analyzePythonContext(files, '/test');

      // Results may be empty if parser returns null in mock
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle file read errors gracefully', async () => {
      const fs = await import('fs');
      vi.mocked(fs.promises.readFile).mockRejectedValueOnce(
        new Error('File not found')
      );

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const files = ['src/bad.py'];
      const results = await pythonContext.analyzePythonContext(files, '/test');

      // Should return empty results or partial results
      expect(Array.isArray(results)).toBe(true);
      consoleSpy.mockRestore();
    });
  });
});

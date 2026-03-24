import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeContext, calculateCohesion } from '../orchestrator';
import * as core from '@aiready/core';

// Mock the core module
vi.mock('@aiready/core', async () => {
  const actual = await vi.importActual('@aiready/core');
  return {
    ...actual,
    scanFiles: vi.fn(),
    readFileContent: vi.fn(),
  };
});

// Mock fs to prevent ENOENT errors when python-context tries to read files
vi.mock('fs', () => ({
  default: {
    promises: {
      readFile: vi.fn().mockResolvedValue('# Python file\nprint("hello")'),
    },
    existsSync: vi.fn().mockReturnValue(true),
  },
  promises: {
    readFile: vi.fn().mockResolvedValue('# Python file\nprint("hello")'),
  },
  existsSync: vi.fn().mockReturnValue(true),
}));

describe('analyzeContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should analyze TypeScript files and return results', async () => {
    const mockFiles = ['src/file1.ts', 'src/file2.ts'];
    const mockContents: Record<string, string> = {
      'src/file1.ts': `
        import { b } from './file2';
        export const a = 1;
      `,
      'src/file2.ts': `
        export const b = 2;
      `,
    };

    vi.mocked(core.scanFiles).mockResolvedValue(mockFiles);
    vi.mocked(core.readFileContent).mockImplementation(async (path: string) => {
      return mockContents[path] || '';
    });

    const results = await analyzeContext({
      rootDir: '.',
      maxDepth: 5,
      maxContextBudget: 25000,
      minCohesion: 0.6,
      maxFragmentation: 0.5,
    });

    expect(results.length).toBe(2);
    expect(results[0].file).toBeDefined();
    expect(results[0].importDepth).toBeDefined();
    expect(results[0].contextBudget).toBeDefined();
    expect(core.scanFiles).toHaveBeenCalled();
    expect(core.readFileContent).toHaveBeenCalledTimes(2);
  });

  it('should handle empty file list', async () => {
    vi.mocked(core.scanFiles).mockResolvedValue([]);

    const results = await analyzeContext({
      rootDir: '.',
    });

    expect(results).toEqual([]);
  });

  it('should process both TypeScript and Python files', async () => {
    const mockFiles = ['src/file1.ts', 'src/file2.py'];
    vi.mocked(core.scanFiles).mockResolvedValue(mockFiles);
    vi.mocked(core.readFileContent).mockResolvedValue('export const a = 1;');

    const results = await analyzeContext({
      rootDir: '.',
    });

    // Orchestrator processes both TypeScript and Python files
    expect(results.length).toBe(2);
    expect(results.some((r) => r.file === 'src/file1.ts')).toBe(true);
    expect(results.some((r) => r.file === 'src/file2.py')).toBe(true);
  });

  it('should use default options when not provided', async () => {
    vi.mocked(core.scanFiles).mockResolvedValue([]);
    vi.mocked(core.readFileContent).mockResolvedValue('');

    const results = await analyzeContext({
      rootDir: '.',
    });

    expect(results).toEqual([]);
    expect(core.scanFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        rootDir: '.',
      })
    );
  });

  it('should handle includeNodeModules option', async () => {
    const mockFiles = ['node_modules/pkg/index.js', 'src/file.ts'];
    vi.mocked(core.scanFiles).mockResolvedValue(mockFiles);
    vi.mocked(core.readFileContent).mockResolvedValue('export const a = 1;');

    const results = await analyzeContext({
      rootDir: '.',
      includeNodeModules: true,
      exclude: ['**/node_modules/**'],
    });

    // When includeNodeModules is true, node_modules should be processed
    expect(results.length).toBe(2);
  });
});

describe('calculateCohesion', () => {
  it('should delegate to calculateEnhancedCohesion', () => {
    const exports = [
      { name: 'getUser', type: 'function' as const, inferredDomain: 'user' },
      { name: 'updateUser', type: 'function' as const, inferredDomain: 'user' },
    ];

    const cohesion = calculateCohesion(exports);

    // Should return a valid cohesion score
    expect(cohesion).toBeGreaterThan(0);
    expect(cohesion).toBeLessThanOrEqual(1);
  });

  it('should handle empty exports', () => {
    const cohesion = calculateCohesion([]);
    expect(cohesion).toBe(1); // Empty exports should have perfect cohesion
  });

  it('should pass through file path and options', () => {
    const exports = [
      { name: 'test', type: 'function' as const, inferredDomain: 'test' },
    ];

    // Test with file path
    const cohesion = calculateCohesion(exports, 'src/test.ts');
    expect(cohesion).toBe(1);

    // Test with options
    const cohesionWithOptions = calculateCohesion(exports, undefined, {
      someOption: true,
    });
    expect(cohesionWithOptions).toBe(1);
  });
});

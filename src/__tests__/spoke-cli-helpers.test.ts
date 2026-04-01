import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeSpokeCli } from '../utils/spoke-cli-helpers';

describe('spoke-cli-helpers', () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it('should execute analysis and display results', async () => {
    const analyzeFn = vi.fn().mockResolvedValue({
      summary: { score: 95, rating: 'a' },
      issues: [],
    });

    const report: any = await executeSpokeCli(
      'TestSpoke',
      'Testing spoke',
      { rootDir: '.' },
      analyzeFn
    );

    expect(analyzeFn).toHaveBeenCalled();
    expect(report.summary.score).toBe(95);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Analysis Results:')
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('No issues detected.')
    );
  });

  it('should handle issues and display count', async () => {
    const analyzeFn = vi.fn().mockResolvedValue({
      summary: { score: 70, rating: 'b' },
      issues: [{}, {}],
    });

    await executeSpokeCli('TestSpoke', 'Testing spoke', {}, analyzeFn);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Found 2 issues.')
    );
  });

  it('should handle errors and exit', async () => {
    const analyzeFn = vi.fn().mockRejectedValue(new Error('Analysis failed'));

    await expect(
      executeSpokeCli('TestSpoke', 'Testing spoke', {}, analyzeFn)
    ).rejects.toThrow('process.exit');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Error during TestSpoke analysis: Analysis failed'
      )
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});

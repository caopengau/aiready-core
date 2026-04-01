import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createStandardProgressCallback,
  formatStandardCliResult,
  runStandardCliAction,
  createStandardCommand,
} from '../utils/cli-factory';

describe('cli-factory', () => {
  describe('createStandardProgressCallback', () => {
    let stdoutSpy: any;

    beforeEach(() => {
      stdoutSpy = vi
        .spyOn(process.stdout, 'write')
        .mockImplementation(() => true);
    });

    afterEach(() => {
      stdoutSpy.mockRestore();
    });

    it('should write progress to stdout', () => {
      const callback = createStandardProgressCallback('TestTool');
      callback(50, 100, 'Processing...');

      expect(stdoutSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TestTool]')
      );
      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('50%'));
      expect(stdoutSpy).toHaveBeenCalledWith(
        expect.stringContaining('Processing...')
      );
    });

    it('should write newline when finished', () => {
      const callback = createStandardProgressCallback('TestTool');
      callback(100, 100, 'Done');

      expect(stdoutSpy).toHaveBeenCalledWith('\n');
    });
  });

  describe('formatStandardCliResult', () => {
    let consoleSpy: any;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should log overall score and issues count', () => {
      formatStandardCliResult('TestTool', 85, 2);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('TESTTOOL Analysis Complete')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Overall Score: 85/100')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Issues Found: 2')
      );
    });

    it('should log "None" when issues count is 0', () => {
      formatStandardCliResult('TestTool', 100, 0);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Issues Found: None')
      );
    });
  });

  describe('runStandardCliAction', () => {
    let consoleLogSpy: any;
    let consoleErrorSpy: any;
    let processExitSpy: any;

    beforeEach(() => {
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should run action and format result', async () => {
      const action = vi.fn().mockResolvedValue({ score: 90, issuesCount: 1 });
      await runStandardCliAction('TestTool', action);

      expect(action).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Overall Score: 90/100')
      );
    });

    it('should handle errors and exit', async () => {
      const action = vi.fn().mockRejectedValue(new Error('test error'));
      await expect(runStandardCliAction('TestTool', action)).rejects.toThrow(
        'process.exit called'
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('critical error: test error')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('createStandardCommand', () => {
    let consoleLogSpy: any;
    let consoleErrorSpy: any;
    let processExitSpy: any;

    beforeEach(() => {
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should create a command with description and options', () => {
      const runAction = vi.fn();
      const command = createStandardCommand(
        'test',
        'test description',
        runAction
      );

      expect(command.name()).toBe('test');
      expect(command.description()).toBe('test description');
      expect(command.options.map((o) => o.long)).toContain('--output');
      expect(command.options.map((o) => o.long)).toContain('--include');
      expect(command.options.map((o) => o.long)).toContain('--exclude');
      expect(command.options.map((o) => o.long)).toContain('--json');
    });

    it('should execute runAction on action call', async () => {
      const runAction = vi.fn().mockResolvedValue({ success: true });
      const command = createStandardCommand('test', 'desc', runAction);

      // Avoid actual exit during test
      command.exitOverride();
      await command.parseAsync(['node', 'test', '--json']);

      expect(runAction).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
    });

    it('should handle errors in action', async () => {
      const runAction = vi.fn().mockRejectedValue(new Error('action error'));
      const command = createStandardCommand('test', 'desc', runAction);

      command.exitOverride();
      // commander might call process.exit(1) through our action handler
      await expect(command.parseAsync(['node', 'test'])).rejects.toThrow(
        'process.exit called'
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('critical error: action error')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});

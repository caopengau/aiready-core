import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from 'vitest';
import { Severity } from '../types';
import {
  normalizeSeverity,
  getSeverityValue,
  getSeverityLevel,
  getSeverityEnum,
  getSeverityColor,
  emitProgress,
  getElapsedTime,
  handleCLIError,
  getSafetyIcon,
  getScoreBar,
  getSeverityBadge,
  getTerminalDivider,
  printTerminalHeader,
} from '../utils/cli-utils';

describe('CLI Utils', () => {
  // Mock console.error and process.exit for handleCLIError tests
  let consoleErrorSpy: any;
  let processExitSpy: any;
  let originalConsoleError: any;
  let originalProcessExit: any;

  beforeAll(() => {
    originalConsoleError = console.error;
    originalProcessExit = process.exit;
  });

  afterAll(() => {
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
  });

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('normalizeSeverity', () => {
    it('should return null for undefined', () => {
      expect(normalizeSeverity(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(normalizeSeverity('')).toBeNull();
    });

    it('should map critical variations', () => {
      expect(normalizeSeverity('critical')).toBe(Severity.Critical);
      expect(normalizeSeverity('Critical')).toBe(Severity.Critical);
      expect(normalizeSeverity('CRITICAL')).toBe(Severity.Critical);
      expect(normalizeSeverity('high-risk')).toBe(Severity.Critical);
      expect(normalizeSeverity('High-Risk')).toBe(Severity.Critical);
      expect(normalizeSeverity('blind-risk')).toBe(Severity.Critical);
      expect(normalizeSeverity('Blind-Risk')).toBe(Severity.Critical);
    });

    it('should map major variations', () => {
      expect(normalizeSeverity('major')).toBe(Severity.Major);
      expect(normalizeSeverity('Major')).toBe(Severity.Major);
      expect(normalizeSeverity('MAJOR')).toBe(Severity.Major);
      expect(normalizeSeverity('moderate-risk')).toBe(Severity.Major);
      expect(normalizeSeverity('Moderate-Risk')).toBe(Severity.Major);
    });

    it('should map minor variations', () => {
      expect(normalizeSeverity('minor')).toBe(Severity.Minor);
      expect(normalizeSeverity('Minor')).toBe(Severity.Minor);
      expect(normalizeSeverity('MINOR')).toBe(Severity.Minor);
      expect(normalizeSeverity('safe')).toBe(Severity.Minor);
      expect(normalizeSeverity('Safe')).toBe(Severity.Minor);
    });

    it('should map info variations', () => {
      expect(normalizeSeverity('info')).toBe(Severity.Info);
      expect(normalizeSeverity('Info')).toBe(Severity.Info);
      expect(normalizeSeverity('INFO')).toBe(Severity.Info);
    });

    it('should return null for unknown strings', () => {
      expect(normalizeSeverity('unknown')).toBeNull();
      expect(normalizeSeverity('foo')).toBeNull();
      expect(normalizeSeverity('bar')).toBeNull();
      expect(normalizeSeverity('123')).toBeNull();
      expect(normalizeSeverity('critical ')).toBeNull(); // trailing space
      expect(normalizeSeverity(' critical')).toBeNull(); // leading space
    });
  });

  describe('getSeverityValue', () => {
    it('should return 4 for critical', () => {
      expect(getSeverityValue('critical')).toBe(4);
      expect(getSeverityValue('Critical')).toBe(4);
      expect(getSeverityValue('high-risk')).toBe(4);
      expect(getSeverityValue('blind-risk')).toBe(4);
    });

    it('should return 3 for major', () => {
      expect(getSeverityValue('major')).toBe(3);
      expect(getSeverityValue('Major')).toBe(3);
      expect(getSeverityValue('moderate-risk')).toBe(3);
    });

    it('should return 2 for minor', () => {
      expect(getSeverityValue('minor')).toBe(2);
      expect(getSeverityValue('Minor')).toBe(2);
      expect(getSeverityValue('safe')).toBe(2);
    });

    it('should return 1 for info', () => {
      expect(getSeverityValue('info')).toBe(1);
      expect(getSeverityValue('Info')).toBe(1);
    });

    it('should return 0 for undefined or unknown', () => {
      expect(getSeverityValue(undefined)).toBe(0);
      expect(getSeverityValue('')).toBe(0);
      expect(getSeverityValue('unknown')).toBe(0);
    });
  });

  describe('getSeverityLevel', () => {
    it('should be an alias for getSeverityValue', () => {
      expect(getSeverityLevel('critical')).toBe(4);
      expect(getSeverityLevel('major')).toBe(3);
      expect(getSeverityLevel('minor')).toBe(2);
      expect(getSeverityLevel('info')).toBe(1);
      expect(getSeverityLevel('unknown')).toBe(0);
    });
  });

  describe('getSeverityEnum', () => {
    it('should return normalized strings for severity levels', () => {
      expect(getSeverityEnum('critical')).toBe('critical');
      expect(getSeverityEnum('high-risk')).toBe('critical');
      expect(getSeverityEnum('blind-risk')).toBe('critical');
      expect(getSeverityEnum('major')).toBe('major');
      expect(getSeverityEnum('moderate-risk')).toBe('major');
      expect(getSeverityEnum('minor')).toBe('minor');
      expect(getSeverityEnum('safe')).toBe('minor');
      expect(getSeverityEnum('info')).toBe('info');
    });

    it('should return "info" for unknown severity', () => {
      expect(getSeverityEnum('unknown')).toBe('info');
      expect(getSeverityEnum('')).toBe('info');
      expect(getSeverityEnum(undefined)).toBe('info');
    });
  });

  describe('getSeverityColor', () => {
    it('should return red for critical', () => {
      const mockChalk = {
        red: 'red',
        yellow: 'yellow',
        green: 'green',
        blue: 'blue',
        white: 'white',
      };
      expect(getSeverityColor('critical', mockChalk)).toBe('red');
    });

    it('should return yellow for major', () => {
      const mockChalk = {
        red: 'red',
        yellow: 'yellow',
        green: 'green',
        blue: 'blue',
        white: 'white',
      };
      expect(getSeverityColor('major', mockChalk)).toBe('yellow');
    });

    it('should return green for minor', () => {
      const mockChalk = {
        red: 'red',
        yellow: 'yellow',
        green: 'green',
        blue: 'blue',
        white: 'white',
      };
      expect(getSeverityColor('minor', mockChalk)).toBe('green');
    });

    it('should return blue for info', () => {
      const mockChalk = {
        red: 'red',
        yellow: 'yellow',
        green: 'green',
        blue: 'blue',
        white: 'white',
      };
      expect(getSeverityColor('info', mockChalk)).toBe('blue');
    });

    it('should return white for unknown', () => {
      const mockChalk = {
        red: 'red',
        yellow: 'yellow',
        green: 'green',
        blue: 'blue',
        white: 'white',
      };
      expect(getSeverityColor('unknown', mockChalk)).toBe('white');
    });
  });

  describe('emitProgress', () => {
    it('should not call onProgress if not provided', () => {
      const onProgress = vi.fn();
      emitProgress(10, 100, 'tool', 'message', undefined, 50);
      expect(onProgress).not.toHaveBeenCalled();
    });

    it('should call onProgress at throttle intervals', () => {
      const onProgress = vi.fn();
      emitProgress(50, 100, 'tool', 'message', onProgress, 50);
      expect(onProgress).toHaveBeenCalledWith(50, 100, 'message (50/100)');
    });

    it('should call onProgress when processed equals total', () => {
      const onProgress = vi.fn();
      emitProgress(100, 100, 'tool', 'message', onProgress, 50);
      expect(onProgress).toHaveBeenCalledWith(100, 100, 'message (100/100)');
    });

    it('should not call onProgress if not at throttle interval and not total', () => {
      const onProgress = vi.fn();
      emitProgress(25, 100, 'tool', 'message', onProgress, 50);
      expect(onProgress).not.toHaveBeenCalled();
    });
  });

  describe('getElapsedTime', () => {
    it('should return formatted string with two decimal places', () => {
      const start = Date.now() - 1500; // 1.5 seconds ago
      const elapsed = getElapsedTime(start);
      expect(elapsed).toMatch(/^\d+\.\d{2}$/);
      expect(parseFloat(elapsed)).toBeGreaterThanOrEqual(1.5);
      expect(parseFloat(elapsed)).toBeLessThan(2.0);
    });

    it('should handle zero elapsed time', () => {
      const start = Date.now();
      const elapsed = getElapsedTime(start);
      expect(parseFloat(elapsed)).toBe(0);
    });

    it('should handle large elapsed time', () => {
      const start = Date.now() - 60000; // 1 minute ago
      const elapsed = getElapsedTime(start);
      expect(parseFloat(elapsed)).toBeGreaterThanOrEqual(60);
    });
  });

  describe('handleCLIError', () => {
    it('should log error and exit with code 1', () => {
      const error = new Error('Test error');
      expect(() => handleCLIError(error, 'test-command')).toThrow(
        'process.exit called'
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ test-command failed:',
        error
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle non-Error objects', () => {
      const error = 'string error';
      expect(() => handleCLIError(error, 'test-command')).toThrow(
        'process.exit called'
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ test-command failed:',
        error
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('getSafetyIcon', () => {
    it('should return correct icons for known ratings', () => {
      expect(getSafetyIcon('safe')).toBe('✅');
      expect(getSafetyIcon('moderate-risk')).toBe('⚠️ ');
      expect(getSafetyIcon('high-risk')).toBe('🔴');
      expect(getSafetyIcon('blind-risk')).toBe('💀');
    });

    it('should return question mark for unknown rating', () => {
      expect(getSafetyIcon('unknown')).toBe('❓');
      expect(getSafetyIcon('')).toBe('❓');
    });
  });

  describe('getScoreBar', () => {
    it('should return a bar of the specified width', () => {
      const bar = getScoreBar(50, 10);
      expect(bar).toHaveLength(10);
      expect(bar).toBe('█████░░░░░');
    });

    it('should handle score of 0', () => {
      const bar = getScoreBar(0, 10);
      expect(bar).toBe('░░░░░░░░░░');
    });

    it('should handle score of 100', () => {
      const bar = getScoreBar(100, 10);
      expect(bar).toBe('██████████');
    });

    it('should clamp scores to 0-100', () => {
      const bar1 = getScoreBar(-10, 10);
      expect(bar1).toBe('░░░░░░░░░░');
      const bar2 = getScoreBar(110, 10);
      expect(bar2).toBe('██████████');
    });
  });

  describe('getSeverityBadge', () => {
    it('should return badge for critical', () => {
      const mockChalk = {
        bgRed: { white: { bold: (s: string) => s } },
        bgYellow: { black: { bold: (s: string) => s } },
        bgGreen: { black: { bold: (s: string) => s } },
        bgBlue: { white: { bold: (s: string) => s } },
        bgCyan: { black: (s: string) => s },
      };
      const badge = getSeverityBadge('critical', mockChalk);
      expect(badge).toBe(' CRITICAL ');
    });

    it('should return badge for unknown severity', () => {
      const mockChalk = {
        bgRed: { white: { bold: (s: string) => s } },
        bgYellow: { black: { bold: (s: string) => s } },
        bgGreen: { black: { bold: (s: string) => s } },
        bgBlue: { white: { bold: (s: string) => s } },
        bgCyan: { black: (s: string) => s },
      };
      const badge = getSeverityBadge('unknown', mockChalk);
      expect(badge).toBe(' UNKNOWN ');
    });
  });

  describe('getTerminalDivider', () => {
    it('should return a divider of the specified width', () => {
      const mockChalk = (s: string) => s;
      const divider = getTerminalDivider(mockChalk, 10);
      expect(divider).toBe('━━━━━━━━━━');
    });

    it('should default to 80 width', () => {
      const mockChalk = (s: string) => s;
      const divider = getTerminalDivider(mockChalk);
      expect(divider).toHaveLength(80);
    });
  });

  describe('printTerminalHeader', () => {
    it('should log header with title in uppercase', () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      const mockColorFn = (s: string) => s;
      printTerminalHeader('Test Title', mockColorFn, 10);
      expect(consoleLogSpy).toHaveBeenCalledTimes(3);
      expect(consoleLogSpy).toHaveBeenCalledWith('\n━━━━━━━━━━');
      expect(consoleLogSpy).toHaveBeenCalledWith('  TEST TITLE');
      expect(consoleLogSpy).toHaveBeenCalledWith('━━━━━━━━━━\n');
    });
  });
});

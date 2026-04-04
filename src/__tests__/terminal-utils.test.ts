import { describe, it, expect, vi } from 'vitest';
import {
  getTerminalDivider,
  getScoreBar,
  getSafetyIcon,
  printTerminalHeader,
} from '../utils/terminal-utils';
import { getSeverityBadge } from '../utils/severity-utils';
import chalk from 'chalk';

describe('Terminal Utils', () => {
  it('getTerminalDivider should handle missing process.stdout.columns', () => {
    const originalColumns = process.stdout.columns;
    Object.defineProperty(process.stdout, 'columns', {
      value: undefined,
      configurable: true,
    });

    const divider = getTerminalDivider(chalk.cyan, 40);
    expect(divider).toContain('━');

    Object.defineProperty(process.stdout, 'columns', {
      value: originalColumns,
      configurable: true,
    });
  });

  it('getTerminalDivider should cap at maxWidth', () => {
    const divider = getTerminalDivider(chalk.cyan, 10);
    // Strip ANSI escape codes to check physical length
    const plain = divider.replace(/\u001b\[.*?m/g, '');
    expect(plain.length).toBe(10);
  });

  it('printTerminalHeader should execute without error', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printTerminalHeader('Test Header');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('getScoreBar should handle boundaries', () => {
    expect(getScoreBar(-10)).toBe('░░░░░░░░░░');
    expect(getScoreBar(110)).toBe('██████████');
    expect(getScoreBar(50)).toBe('█████░░░░░');
  });

  it('getSafetyIcon should return correct emojis', () => {
    expect(getSafetyIcon('safe')).toBe('✅');
    expect(getSafetyIcon('moderate-risk')).toBe('⚠️ ');
    expect(getSafetyIcon('high-risk')).toBe('🔴');
    expect(getSafetyIcon('blind-risk')).toBe('💀');
    expect(getSafetyIcon('unknown')).toBe('❓');
  });

  it('getSeverityBadge should return formatted string', () => {
    const mockChalk: any = {
      bgRed: { white: { bold: vi.fn((s) => s) } },
      bgYellow: { black: { bold: vi.fn((s) => s) } },
      bgGreen: { black: { bold: vi.fn((s) => s) } },
      bgBlue: { white: { bold: vi.fn((s) => s) } },
      bgCyan: { black: vi.fn((s) => s) },
    };

    getSeverityBadge('critical', mockChalk);
    expect(mockChalk.bgRed.white.bold).toHaveBeenCalledWith(' CRITICAL ');
  });
});

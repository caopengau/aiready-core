import { describe, it, expect, vi } from 'vitest';
import {
  getTerminalDivider,
  getScoreBar,
  getSafetyIcon,
  getSeverityBadge,
} from '../utils/cli-utils';
import chalk from 'chalk';

describe('Terminal Utils', () => {
  it('getTerminalDivider should return a string of correct length', () => {
    const divider = getTerminalDivider(chalk.cyan, 40);
    expect(divider).toContain('━');
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

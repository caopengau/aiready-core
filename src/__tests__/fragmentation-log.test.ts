import { describe, it, expect } from 'vitest';
import { calculateFragmentation } from '../analyzer';

describe('calculateFragmentation (log scale option)', () => {
  it('returns 0 for single file regardless of option', () => {
    const files = ['src/user/user.ts'];
    expect(calculateFragmentation(files, 'user')).toBe(0);
    expect(calculateFragmentation(files, 'user', { useLogScale: true })).toBe(0);
  });

  it('matches linear formula when not using log scale', () => {
    const files = [
      'a/one.ts',
      'b/two.ts',
      'c/three.ts',
      'd/four.ts',
    ];

    const uniqueDirs = 4;
    const linear = (uniqueDirs - 1) / (files.length - 1);
    expect(calculateFragmentation(files, 'domain')).toBeCloseTo(linear);
  });

  it('computes normalized log-based fragmentation when requested', () => {
    const files = [
      'src/group/a.ts',
      'src/group/b.ts',
      'src/group/c.ts',
      'lib/other/d.ts',
      'tools/x/e.ts',
    ];

    const dirs = new Set(files.map((f) => f.split('/').slice(0, -1).join('/'))).size;
    const expected = Math.log(dirs) / Math.log(files.length);

    expect(calculateFragmentation(files, 'domain', { useLogScale: true })).toBeCloseTo(expected, 6);
  });
});

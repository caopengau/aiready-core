import { describe, it, expect } from 'vitest';
import {
  calculatePathEntropy,
  calculateDirectoryDistance,
} from '../analyzer';

describe('advanced fragmentation heuristics', () => {
  it('path entropy is low when most files are in one directory', () => {
    const files = [
      'src/billing/a.ts',
      'src/billing/b.ts',
      'src/billing/c.ts',
      'src/billing/d.ts',
      'src/billing/e.ts',
      'src/billing/f.ts',
      'src/billing/g.ts',
      'src/billing/h.ts',
      'src/billing/i.ts',
      'src/other/x.ts',
    ];

    const entropy = calculatePathEntropy(files);
    // 9 in one folder and 1 in another should yield low entropy (< 0.5)
    expect(entropy).toBeLessThan(0.5);
  });

  it('path entropy is high when files are evenly distributed', () => {
    const files = [
      'a/f1.ts',
      'b/f2.ts',
      'c/f3.ts',
      'd/f4.ts',
      'e/f5.ts',
    ];

    const entropy = calculatePathEntropy(files);
    expect(entropy).toBeGreaterThan(0.8);
  });

  it('directory distance is low for sibling files and high for scattered files', () => {
    const siblings = [
      'src/auth/ui/button.ts',
      'src/auth/ui/input.ts',
      'src/auth/ui/modal.ts',
    ];

    const scattered = [
      'src/auth/ui/button.ts',
      'src/payments/api/charge.ts',
      'lib/analytics/track.ts',
    ];

    const distSiblings = calculateDirectoryDistance(siblings);
    const distScattered = calculateDirectoryDistance(scattered);

    expect(distSiblings).toBeLessThan(distScattered);
    expect(distSiblings).toBeLessThan(0.5);
    expect(distScattered).toBeGreaterThan(0.6);
  });
});

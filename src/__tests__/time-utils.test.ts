import { describe, it, expect } from 'vitest';
import { getElapsedTime } from '../utils/cli-utils';

describe('Time Utils', () => {
  it('getElapsedTime should return formatted string', () => {
    const start = Date.now() - 1500;
    const elapsed = getElapsedTime(start);
    expect(parseFloat(elapsed)).toBeGreaterThanOrEqual(1.5);
  });
});

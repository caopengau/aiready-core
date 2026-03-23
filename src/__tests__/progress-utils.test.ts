import { describe, it, expect, vi } from 'vitest';
import { emitProgress } from '../utils/cli-utils';

describe('Progress Utils', () => {
  it('emitProgress should throttle updates', () => {
    const onProgress = vi.fn();
    emitProgress(0, 100, 'test', 'msg', onProgress, 50);
    expect(onProgress).toHaveBeenCalledWith(0, 100, 'msg (0/100)');

    onProgress.mockClear();
    emitProgress(10, 100, 'test', 'msg', onProgress, 50);
    expect(onProgress).not.toHaveBeenCalled();

    onProgress.mockClear();
    emitProgress(50, 100, 'test', 'msg', onProgress, 50);
    expect(onProgress).toHaveBeenCalledWith(50, 100, 'msg (50/100)');
  });
});

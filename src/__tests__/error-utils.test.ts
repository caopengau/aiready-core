import { describe, it, expect } from 'vitest';
import { handleCLIError } from '../utils/cli-utils';

describe('Error Utils', () => {
  it('handleCLIError should be defined', () => {
    expect(handleCLIError).toBeDefined();
  });
});

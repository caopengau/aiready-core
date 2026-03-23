import { describe, it, expect } from 'vitest';
import { generateStandardHtmlReport } from '../../src';

describe('Report Formatters', () => {
  it('generateStandardHtmlReport should be defined', () => {
    expect(generateStandardHtmlReport).toBeDefined();
  });
});

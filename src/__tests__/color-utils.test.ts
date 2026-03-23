import { describe, it, expect } from 'vitest';
import { getSeverityColor } from '../utils/cli-utils';

describe('Color Utils', () => {
  it('getSeverityColor should return correct chalk color', () => {
    const mockChalk: any = {
      red: 'red',
      yellow: 'yellow',
      green: 'green',
      blue: 'blue',
      white: 'white',
    };

    expect(getSeverityColor('critical', mockChalk)).toBe('red');
    expect(getSeverityColor('major', mockChalk)).toBe('yellow');
    expect(getSeverityColor('minor', mockChalk)).toBe('green');
    expect(getSeverityColor('info', mockChalk)).toBe('blue');
    expect(getSeverityColor('unknown', mockChalk)).toBe('white');
  });
});

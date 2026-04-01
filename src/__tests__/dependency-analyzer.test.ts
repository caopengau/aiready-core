import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseFileExports } from '../utils/dependency-analyzer';
import { getParser } from '../parsers/parser-factory';
import { Language } from '../types/language';

// Mock getParser
vi.mock('../parsers/parser-factory', () => ({
  getParser: vi.fn(),
}));

describe('Dependency Analyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should parse TypeScript code and extract exports and imports', async () => {
    (getParser as any).mockResolvedValue({ language: Language.TypeScript });

    const code = `
      import { something } from './somewhere';
      export function hello(name: string): string {
        return \`Hello, \${name}!\`;
      }
    `;
    const result = await parseFileExports(code, 'test.ts');

    expect(result.imports).toHaveLength(1);
    expect(result.imports[0].source).toBe('./somewhere');
    expect(result.exports).toHaveLength(1);
    expect(result.exports[0].name).toBe('hello');
  });

  it('should handle multi-language parsers from factory', async () => {
    const mockParser = {
      language: Language.Python,
      initialize: vi.fn().mockResolvedValue(undefined),
      parse: vi.fn().mockReturnValue({
        exports: [
          {
            name: 'hello_python',
            type: 'function',
            imports: [],
            dependencies: [],
            loc: { start: { line: 1, column: 0 }, end: { line: 2, column: 0 } },
          },
        ],
        imports: [{ source: 'math', specifiers: ['sqrt'] }],
      }),
    };
    (getParser as any).mockResolvedValue(mockParser);

    const code = 'def hello_python(): pass';
    const result = await parseFileExports(code, 'test.py');

    expect(mockParser.initialize).toHaveBeenCalled();
    expect(mockParser.parse).toHaveBeenCalledWith(code, 'test.py');
    expect(result.exports).toHaveLength(1);
    expect(result.exports[0].name).toBe('hello_python');
    expect(result.imports).toHaveLength(1);
    expect(result.imports[0].source).toBe('math');
  });

  it('should fallback to empty on parser initialization error', async () => {
    const mockParser = {
      language: Language.Python,
      initialize: vi.fn().mockRejectedValue(new Error('init failed')),
    };
    (getParser as any).mockResolvedValue(mockParser);

    const result = await parseFileExports('code', 'test.py');
    expect(result.exports).toEqual([]);
    expect(result.imports).toEqual([]);
  });

  it('should fallback to empty on TypeScript parsing error', async () => {
    (getParser as any).mockResolvedValue({ language: Language.TypeScript });

    const result = await parseFileExports('invalid code {', 'test.ts');
    expect(result.exports).toEqual([]);
    expect(result.imports).toEqual([]);
  });
});

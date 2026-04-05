import { describe, it, expect } from 'vitest';
import { TypeScriptParser } from '../parsers/typescript-parser';
import { ParseError } from '../types/language';

describe('TypeScript Parser', () => {
  const parser = new TypeScriptParser();

  describe('parse', () => {
    it('should parse TypeScript code and extract exports', () => {
      const code = `
        import { dep } from './dep';
        export function hello(name: string): string {
          return \`Hello, \${name}!\`;
        }
        export const VERSION = '1.0.0';
        export interface MyInterface { a: string; }
        export type MyType = number;
        export default class MyClass {
          method() {}
        }
      `;
      const result = parser.parse(code, 'test.ts');

      expect(result.exports).toHaveLength(5);
      expect(result.imports).toHaveLength(1);
      expect(result.exports.find((e) => e.type === 'interface')).toBeDefined();
      expect(result.exports.find((e) => e.type === 'type')).toBeDefined();
      expect(result.exports.find((e) => e.name === 'default')).toBeDefined();
    });

    it('should identify typed vs untyped code', () => {
      const tsCode = 'export function f(x: number): number { return x; }';
      const jsCode = 'export function f(x) { return x; }';

      const tsResult = parser.parse(tsCode, 'test.ts');
      const jsResult = parser.parse(jsCode, 'test.js');

      expect(tsResult.exports[0].isTyped).toBe(true);
      expect(jsResult.exports[0].isTyped).toBe(false);
    });

    it('should identify primitive constants', () => {
      const code =
        'export const A = 1; export const B = `template`; export const C = { obj: 1 };';
      const result = parser.parse(code, 'test.ts');

      expect(result.exports[0].isPrimitive).toBe(true);
      expect(result.exports[1].isPrimitive).toBe(true);
      expect(result.exports[2].isPrimitive).toBe(false);
    });

    it('should throw ParseError on invalid code', () => {
      const code = 'export function failed {';
      expect(() => parser.parse(code, 'test.ts')).toThrow(ParseError);
    });
  });

  describe('getAST', () => {
    it('should return a valid Program AST', async () => {
      const ast = await parser.getAST('const x = 1;', 'test.ts');
      expect(ast.type).toBe('Program');
      expect(ast.body).toHaveLength(1);
    });

    it('should handle JSX files', async () => {
      const ast = await parser.getAST('const El = () => <div />;', 'test.tsx');
      expect(ast).toBeDefined();
    });
  });

  describe('Utility Methods', () => {
    it('canHandle should correctly identify supported extensions', () => {
      expect(parser.canHandle('file.ts')).toBe(true);
      expect(parser.canHandle('file.tsx')).toBe(true);
      expect(parser.canHandle('file.js')).toBe(true);
      expect(parser.canHandle('file.jsx')).toBe(true);
      expect(parser.canHandle('file.txt')).toBe(false);
    });

    it('getNamingConventions should return standard patterns', () => {
      const conventions = parser.getNamingConventions();
      expect(conventions.variablePattern.test('myVar')).toBe(true);
      expect(conventions.classPattern.test('MyClass')).toBe(true);
      expect(conventions.interfacePattern?.test('IMyInterface')).toBe(true);
    });
  });

  it('should detect JSDoc documentation', () => {
    const code = `
      /**
       * This is a test function
       * @param x test
       */
      export function test(x: number) {}
    `;
    const result = parser.parse(code, 'test.ts');
    expect(result.exports[0].documentation?.content).toContain(
      'This is a test function'
    );
  });

  it('should identify impure functions', () => {
    const code = `
      export function impure() {
        console.log('side effect');
      }
      export function pure(x: number) {
        return x * 2;
      }
    `;
    const result = parser.parse(code, 'test.ts');
    expect(result.exports[0].isPure).toBe(false);
    expect(result.exports[1].isPure).toBe(true);
  });

  it('should extract class constructor parameters including TS parameter properties', () => {
    const code = `
      export class Service {
        constructor(public db: any, private logger: any, simple: string) {}
      }
    `;
    const result = parser.parse(code, 'test.ts');
    expect(result.exports[0].parameters).toEqual(['db', 'logger', 'simple']);
  });

  it('should handle namespace imports and other specifiers', () => {
    const code = `
      import * as fs from 'fs';
      import defaultExport from 'module';
      import { a as b } from 'module';
      export const x = 1;
    `;
    const result = parser.parse(code, 'test.ts');
    expect(result.imports[0].specifiers).toContain('*');
    expect(result.imports[1].specifiers).toContain('default');
    expect(result.imports[2].specifiers).toContain('a');
  });

  it('should handle non-identifier function parameters correctly', () => {
    const code = `
      export function destructure({ a, b }: any, [c]: number[]) {
        return a + b + c;
      }
    `;
    const result = parser.parse(code, 'test.ts');
    // It should filter out the undefineds from non-identifier params
    expect(result.exports[0].parameters).toEqual([]);
  });

  it('should handle BigInt in side-effect analysis without throwing', () => {
    const code = `
      export function useBigInt() {
        const x = 100n;
        return x;
      }
    `;
    // This previously might have failed during JSON.stringify if not handled
    const result = parser.parse(code, 'test.ts');
    expect(result.exports[0].isPure).toBe(true);
  });

  it('should treat function signatures without bodies as pure/safe', () => {
    const code = `
      export declare function overload(x: string): void;
      export declare function overload(x: number): void;
    `;
    const result = parser.parse(code, 'test.ts');
    expect(result.exports[0].isPure).toBe(true);
  });
});

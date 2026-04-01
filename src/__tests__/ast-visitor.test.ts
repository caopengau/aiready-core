import { describe, it, expect } from 'vitest';
import { parse } from '@typescript-eslint/typescript-estree';
import {
  extractFileImports,
  extractExportsWithDependencies,
  extractFromDeclaration,
  findUsedImports,
  extractTypeReferences,
} from '../utils/ast-visitor';

describe('AST Visitor', () => {
  describe('extractFileImports', () => {
    it('should extract various types of imports', () => {
      const code = `
        import defaultImport from './module-a';
        import { namedA, namedB as aliasB } from './module-b';
        import * as namespaceC from './module-c';
        import type { TypeD } from './module-d';
        import './module-e';
      `;
      const ast = parse(code);
      const imports = extractFileImports(ast);

      expect(imports).toHaveLength(5);
      expect(imports[0]).toEqual({
        source: './module-a',
        specifiers: ['default'],
        isTypeOnly: false,
      });
      expect(imports[1]).toEqual({
        source: './module-b',
        specifiers: ['namedA', 'namedB'],
        isTypeOnly: false,
      });
      expect(imports[2]).toEqual({
        source: './module-c',
        specifiers: ['*'],
        isTypeOnly: false,
      });
      expect(imports[3]).toEqual({
        source: './module-d',
        specifiers: ['TypeD'],
        isTypeOnly: true,
      });
      expect(imports[4]).toEqual({
        source: './module-e',
        specifiers: [],
        isTypeOnly: false,
      });
    });

    it('should handle unusual import specifiers (e.g. from transpilers)', () => {
      // Mocking a non-Identifier specifier if possible,
      // but typically @typescript-eslint/typescript-estree always gives Identifiers for these.
      // The code has: (imported as unknown as { value: string }).value
      // This might happen with some other parsers or older versions.
    });
  });

  describe('extractExportsWithDependencies', () => {
    it('should handle named exports with declarations', () => {
      const code = `
        import { dep } from './dep';
        export const a = 1, b = 2;
        export function c() { return dep; }
      `;
      const ast = parse(code);
      const imports = extractFileImports(ast);
      const exports = extractExportsWithDependencies(ast, imports);

      expect(exports).toHaveLength(3);
      expect(exports.map((e) => e.name)).toEqual(['a', 'b', 'c']);
      expect(exports.find((e) => e.name === 'c')?.imports).toContain('dep');
    });

    it('should handle re-exports', () => {
      const code = `
        export { x, y as z } from './other';
        export { local };
      `;
      const ast = parse(code);
      const exports = extractExportsWithDependencies(ast, []);

      expect(exports).toHaveLength(3);
      expect(exports[0]).toMatchObject({ name: 'x', source: './other' });
      expect(exports[1]).toMatchObject({ name: 'z', source: './other' });
      expect(exports[2]).toMatchObject({ name: 'local', source: undefined });
    });

    it('should handle default exports', () => {
      const code = `
        import { dep } from './dep';
        export default class MyClass {
          method() { return dep; }
        }
      `;
      const ast = parse(code);
      const imports = extractFileImports(ast);
      const exports = extractExportsWithDependencies(ast, imports);

      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('default');
      expect(exports[0].imports).toContain('dep');
    });

    it('should handle ExportAllDeclaration', () => {
      const code = `
        export * from './module-a';
        export * as ns from './module-b';
      `;
      const ast = parse(code);
      const exports = extractExportsWithDependencies(ast, []);

      expect(exports).toHaveLength(2);
      expect(exports[0]).toMatchObject({
        name: '*',
        type: 'all',
        source: './module-a',
      });
      expect(exports[1]).toMatchObject({
        name: 'ns',
        type: 'all',
        source: './module-b',
      });
    });
  });

  describe('extractFromDeclaration', () => {
    it('should return empty for null node', () => {
      expect(extractFromDeclaration(null as any)).toEqual([]);
    });

    it('should extract from various declaration types', () => {
      const code = `
        export function f() {}
        export class C {}
        export interface I {}
        export type T = string;
        export const v1 = 1, v2 = 2;
      `;
      const ast = parse(code);
      const results: any[] = [];
      ast.body.forEach((node) => {
        if (node.type === 'ExportNamedDeclaration' && node.declaration) {
          results.push(...extractFromDeclaration(node.declaration));
        }
      });

      expect(results).toEqual([
        { name: 'f', type: 'function' },
        { name: 'C', type: 'class' },
        { name: 'I', type: 'interface' },
        { name: 'T', type: 'type' },
        { name: 'v1', type: 'const' },
        { name: 'v2', type: 'const' },
      ]);
    });
  });

  describe('findUsedImports', () => {
    it('should find identifiers that match imported names', () => {
      const code = `
        function test() {
          const x = importedA + 1;
          return importedB(x);
        }
      `;
      const ast = parse(code);
      const importedNames = new Set(['importedA', 'importedB', 'unused']);
      const used = findUsedImports(ast, importedNames);

      expect(used).toContain('importedA');
      expect(used).toContain('importedB');
      expect(used).not.toContain('unused');
    });

    it('should handle complex nested structures', () => {
      const code = `
        const obj = {
          prop: [importedA, { nested: importedB }]
        };
      `;
      const ast = parse(code);
      const used = findUsedImports(ast, new Set(['importedA', 'importedB']));
      expect(used).toHaveLength(2);
    });
  });

  describe('extractTypeReferences', () => {
    it('should extract simple type references', () => {
      const code = `
        type T = MyType;
        interface I extends Base {}
        function f(x: ParamType): ReturnType {}
      `;
      const ast = parse(code);
      const refs = extractTypeReferences(ast);

      expect(refs).toContain('MyType');
      expect(refs).toContain('Base');
      expect(refs).toContain('ParamType');
      expect(refs).toContain('ReturnType');
    });

    it('should extract qualified names', () => {
      const code = `
        type T = Namespace.Sub.Target;
      `;
      const ast = parse(code);
      const refs = extractTypeReferences(ast);

      expect(refs).toContain('Namespace');
      expect(refs).toContain('Sub');
      expect(refs).toContain('Target');
    });
  });
});

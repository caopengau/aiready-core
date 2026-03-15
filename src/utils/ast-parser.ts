import { parse, TSESTree } from '@typescript-eslint/typescript-estree';
import { getParser } from '../parsers/parser-factory';
import { Language } from '../types/language';
import { ExportWithImports, FileImport, ASTNode } from '../types/ast';
import { findUsedImports, extractTypeReferences } from './ast-visitor';

export { ExportWithImports, FileImport, ASTNode };

/**
 * Parse TypeScript/JavaScript file and extract exports with their import dependencies
 */
export function parseFileExports(
  code: string,
  filePath: string
): {
  exports: ExportWithImports[];
  imports: FileImport[];
} {
  const parser = getParser(filePath);

  // Use professional multi-language parser if it's not TypeScript
  // (We keep the legacy TS/JS parser logic below for now as it has specific dependency extraction)
  if (
    parser &&
    parser.language !== Language.TypeScript &&
    parser.language !== Language.JavaScript
  ) {
    try {
      const result = parser.parse(code, filePath);
      return {
        exports: result.exports.map((e) => ({
          name: e.name,
          type: e.type as any,
          imports: e.imports || [],
          dependencies: e.dependencies || [],
          typeReferences: e.typeReferences || [],
          loc: e.loc
            ? {
                start: { line: e.loc.start.line, column: e.loc.start.column },
                end: { line: e.loc.end.line, column: e.loc.end.column },
              }
            : undefined,
        })),
        imports: result.imports.map((i) => ({
          source: i.source,
          specifiers: i.specifiers,
          isTypeOnly: i.isTypeOnly || false,
        })),
      };
    } catch (e) {
      // Fallback
      return { exports: [], imports: [] };
    }
  }

  try {
    const ast = parse(code, {
      loc: true,
      range: true,
      jsx: filePath.endsWith('.tsx') || filePath.endsWith('.jsx'),
      filePath,
    });

    const imports = extractFileImports(ast);
    const exports = extractExportsWithDependencies(ast, imports);

    return { exports, imports };
  } catch (error) {
    // Fallback to empty if parsing fails
    return { exports: [], imports: [] };
  }
}

/**
 * Extract all imports from the file
 */
function extractFileImports(ast: TSESTree.Program): FileImport[] {
  const imports: FileImport[] = [];

  for (const node of ast.body) {
    if (node.type === 'ImportDeclaration') {
      const source = node.source.value as string;
      const specifiers: string[] = [];
      const isTypeOnly = node.importKind === 'type';

      for (const spec of node.specifiers) {
        if (spec.type === 'ImportSpecifier') {
          const imported = spec.imported;
          const importName =
            imported.type === 'Identifier' ? imported.name : imported.value;
          specifiers.push(importName);
        } else if (spec.type === 'ImportDefaultSpecifier') {
          specifiers.push('default');
        } else if (spec.type === 'ImportNamespaceSpecifier') {
          specifiers.push('*');
        }
      }

      imports.push({ source, specifiers, isTypeOnly });
    }
  }

  return imports;
}

/**
 * Extract exports and their import dependencies
 */
function extractExportsWithDependencies(
  ast: TSESTree.Program,
  fileImports: FileImport[]
): ExportWithImports[] {
  const exports: ExportWithImports[] = [];
  const importedNames = new Set(fileImports.flatMap((imp) => imp.specifiers));

  for (const node of ast.body) {
    if (node.type === 'ExportNamedDeclaration') {
      if (node.declaration) {
        const exportNodes = extractFromDeclaration(node.declaration);
        for (const exp of exportNodes) {
          const usedImports = findUsedImports(node.declaration, importedNames);
          const typeReferences = extractTypeReferences(node.declaration);
          exports.push({
            ...exp,
            imports: usedImports,
            dependencies: [],
            typeReferences,
            loc: node.loc,
          });
        }
      }
    } else if (node.type === 'ExportDefaultDeclaration') {
      const usedImports = findUsedImports(node.declaration, importedNames);
      const typeReferences = extractTypeReferences(node.declaration);
      exports.push({
        name: 'default',
        type: 'default',
        imports: usedImports,
        dependencies: [],
        typeReferences,
        loc: node.loc,
      });
    }
  }

  return exports;
}

/**
 * Extract export information from a declaration
 */
function extractFromDeclaration(
  declaration: TSESTree.Node
): Array<{ name: string; type: ExportWithImports['type'] }> {
  const results: Array<{ name: string; type: ExportWithImports['type'] }> = [];

  if (
    declaration.type === 'FunctionDeclaration' &&
    'id' in declaration &&
    declaration.id
  ) {
    results.push({ name: declaration.id.name, type: 'function' });
  } else if (
    declaration.type === 'ClassDeclaration' &&
    'id' in declaration &&
    declaration.id
  ) {
    results.push({ name: declaration.id.name, type: 'class' });
  } else if (declaration.type === 'VariableDeclaration') {
    for (const declarator of declaration.declarations) {
      if (declarator.id.type === 'Identifier') {
        results.push({ name: declarator.id.name, type: 'const' });
      }
    }
  } else if (declaration.type === 'TSTypeAliasDeclaration') {
    results.push({ name: declaration.id.name, type: 'type' });
  } else if (declaration.type === 'TSInterfaceDeclaration') {
    results.push({ name: declaration.id.name, type: 'interface' });
  }

  return results;
}

/**
 * Calculate import-based similarity between two exports (Jaccard index)
 * Returns a score between 0 and 1.
 */
export function calculateImportSimilarity(
  export1: ExportWithImports,
  export2: ExportWithImports
): number {
  if (export1.imports.length === 0 && export2.imports.length === 0) {
    return 1; // Both have no imports = perfectly similar
  }

  const set1 = new Set(export1.imports);
  const set2 = new Set(export2.imports);

  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * Parse code into an AST node
 * @deprecated Use parseFileExports instead
 */
export function parseCode(code: string, language: string): ASTNode | null {
  // Deprecated: Use parseFileExports instead
  return null;
}

/**
 * Extract functions from an AST
 * @deprecated Use parseFileExports instead
 */
export function extractFunctions(ast: ASTNode): ASTNode[] {
  // Deprecated
  return [];
}

/**
 * Extract imports from an AST
 * @deprecated Use parseFileExports instead
 */
export function extractImports(ast: ASTNode): string[] {
  // Deprecated
  return [];
}

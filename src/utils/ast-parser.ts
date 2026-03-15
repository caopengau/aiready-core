import { parse } from '@typescript-eslint/typescript-estree';
import { getParser } from '../parsers/parser-factory';
import { Language } from '../types/language';
import { ExportWithImports, FileImport, ASTNode } from '../types/ast';
import {
  extractFileImports,
  extractExportsWithDependencies,
} from './ast-visitor';

export { ExportWithImports, FileImport, ASTNode };

/**
 * Parse TypeScript/JavaScript file and extract exports with their import dependencies.
 * Automatically handles different languages via the parser factory.
 *
 * @param code - The source code to parse
 * @param filePath - Path to the file (used for language detection and AST metadata)
 * @returns Object containing all identified exports and imports
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
    } catch {
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
  } catch {
    // Fallback to empty if parsing fails
    return { exports: [], imports: [] };
  }
}

/**
 * Calculate import-based similarity between two exports using Jaccard index.
 * Returns a score between 0 and 1 representing the overlap in imported symbols.
 *
 * @param export1 - First export to compare
 * @param export2 - Second export to compare
 * @returns Similarity score (0 = no overlap, 1 = identical imports)
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
 * Parse code into an AST node.
 * @deprecated Use parseFileExports instead for full dependency analysis.
 *
 * @param code - Source code to parse
 * @param language - Target language
 * @returns Generic AST node or null if unsupported
 */
export function parseCode(_code: string, _language: string): ASTNode | null {
  void _code;
  void _language;
  // Deprecated: Use parseFileExports instead
  return null;
}

/**
 * Extract functions from an AST.
 * @deprecated Use parseFileExports instead for complete export metadata.
 *
 * @param ast - The AST to scan
 * @returns Array of function nodes
 */
export function extractFunctions(_ast: ASTNode): ASTNode[] {
  void _ast;
  // Deprecated
  return [];
}

/**
 * Extract imports from an AST.
 * @deprecated Use parseFileExports instead for structured import info.
 *
 * @param ast - The AST to scan
 * @returns Array of imported module names
 */
export function extractImports(_ast: ASTNode): string[] {
  void _ast;
  // Deprecated
  return [];
}

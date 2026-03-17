import { parse } from '@typescript-eslint/typescript-estree';
import { getParser } from '../parsers/parser-factory';
import { Language } from '../types/language';
import { ExportWithImports, FileImport } from '../types/ast';
import {
  extractFileImports,
  extractExportsWithDependencies,
} from './ast-visitor';

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

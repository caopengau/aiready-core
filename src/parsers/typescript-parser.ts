/**
 * TypeScript/JavaScript Parser
 * 
 * Parses TypeScript and JavaScript files using @typescript-eslint/typescript-estree
 */

import { parse, TSESTree } from '@typescript-eslint/typescript-estree';
import {
  Language,
  LanguageParser,
  ParseResult,
  ExportInfo,
  ImportInfo,
  NamingConvention,
  ParseError,
} from '../types/language';

export class TypeScriptParser implements LanguageParser {
  readonly language = Language.TypeScript;
  readonly extensions = ['.ts', '.tsx', '.js', '.jsx'];

  parse(code: string, filePath: string): ParseResult {
    try {
      const isJavaScript = filePath.match(/\.jsx?$/i);
      const ast = parse(code, {
        loc: true,
        range: true,
        jsx: filePath.match(/\.[jt]sx$/i) !== null,
        filePath,
        sourceType: 'module',
        ecmaVersion: 'latest',
      });

      const imports = this.extractImports(ast);
      const exports = this.extractExports(ast, imports);

      return {
        exports,
        imports,
        language: isJavaScript ? Language.JavaScript : Language.TypeScript,
        warnings: [],
      };
    } catch (error) {
      const err = error as Error;
      throw new ParseError(
        `Failed to parse ${filePath}: ${err.message}`,
        filePath
      );
    }
  }

  getNamingConventions(): NamingConvention {
    return {
      // camelCase for variables and functions
      variablePattern: /^[a-z][a-zA-Z0-9]*$/,
      functionPattern: /^[a-z][a-zA-Z0-9]*$/,
      // PascalCase for classes
      classPattern: /^[A-Z][a-zA-Z0-9]*$/,
      // UPPER_CASE for constants
      constantPattern: /^[A-Z][A-Z0-9_]*$/,
      // Common exceptions (React hooks, etc.)
      exceptions: ['__filename', '__dirname', '__esModule'],
    };
  }

  canHandle(filePath: string): boolean {
    return this.extensions.some(ext => filePath.toLowerCase().endsWith(ext));
  }

  private extractImports(ast: TSESTree.Program): ImportInfo[] {
    const imports: ImportInfo[] = [];

    for (const node of ast.body) {
      if (node.type === 'ImportDeclaration') {
        const specifiers: string[] = [];
        let isTypeOnly = false;

        // @ts-ignore - importKind exists but not in types
        if (node.importKind === 'type') {
          isTypeOnly = true;
        }

        for (const spec of node.specifiers) {
          if (spec.type === 'ImportSpecifier') {
            const imported = spec.imported;
            const name = imported.type === 'Identifier' ? imported.name : imported.value;
            specifiers.push(name);
          } else if (spec.type === 'ImportDefaultSpecifier') {
            specifiers.push('default');
          } else if (spec.type === 'ImportNamespaceSpecifier') {
            specifiers.push('*');
          }
        }

        imports.push({
          source: node.source.value,
          specifiers,
          isTypeOnly,
          loc: node.loc
            ? {
                start: { line: node.loc.start.line, column: node.loc.start.column },
                end: { line: node.loc.end.line, column: node.loc.end.column },
              }
            : undefined,
        });
      }
    }

    return imports;
  }

  private extractExports(ast: TSESTree.Program, imports: ImportInfo[]): ExportInfo[] {
    const exports: ExportInfo[] = [];
    const importedNames = new Set(
      imports.flatMap(imp => imp.specifiers.filter(s => s !== '*' && s !== 'default'))
    );

    for (const node of ast.body) {
      if (node.type === 'ExportNamedDeclaration' && node.declaration) {
        const extracted = this.extractFromDeclaration(node.declaration, importedNames);
        exports.push(...extracted);
      } else if (node.type === 'ExportDefaultDeclaration') {
        // Default export
        let name = 'default';
        let type: ExportInfo['type'] = 'default';

        if (
          node.declaration.type === 'FunctionDeclaration' &&
          node.declaration.id
        ) {
          name = node.declaration.id.name;
          type = 'function';
        } else if (
          node.declaration.type === 'ClassDeclaration' &&
          node.declaration.id
        ) {
          name = node.declaration.id.name;
          type = 'class';
        }

        exports.push({
          name,
          type,
          loc: node.loc
            ? {
                start: { line: node.loc.start.line, column: node.loc.start.column },
                end: { line: node.loc.end.line, column: node.loc.end.column },
              }
            : undefined,
        });
      }
    }

    return exports;
  }

  private extractFromDeclaration(
    declaration: TSESTree.Node,
    importedNames: Set<string>
  ): ExportInfo[] {
    const exports: ExportInfo[] = [];

    if (declaration.type === 'FunctionDeclaration' && declaration.id) {
      exports.push({
        name: declaration.id.name,
        type: 'function',
        parameters: declaration.params.map((p: any) =>
          p.type === 'Identifier' ? p.name : 'unknown'
        ),
        loc: declaration.loc
          ? {
              start: {
                line: declaration.loc.start.line,
                column: declaration.loc.start.column,
              },
              end: { line: declaration.loc.end.line, column: declaration.loc.end.column },
            }
          : undefined,
      });
    } else if (declaration.type === 'ClassDeclaration' && declaration.id) {
      exports.push({
        name: declaration.id.name,
        type: 'class',
        loc: declaration.loc
          ? {
              start: {
                line: declaration.loc.start.line,
                column: declaration.loc.start.column,
              },
              end: { line: declaration.loc.end.line, column: declaration.loc.end.column },
            }
          : undefined,
      });
    } else if (declaration.type === 'VariableDeclaration') {
      for (const declarator of declaration.declarations) {
        if (declarator.id.type === 'Identifier') {
          exports.push({
            name: declarator.id.name,
            type: 'const',
            loc: declarator.loc
              ? {
                  start: {
                    line: declarator.loc.start.line,
                    column: declarator.loc.start.column,
                  },
                  end: {
                    line: declarator.loc.end.line,
                    column: declarator.loc.end.column,
                  },
                }
              : undefined,
          });
        }
      }
    } else if (declaration.type === 'TSTypeAliasDeclaration') {
      exports.push({
        name: declaration.id.name,
        type: 'type',
        loc: declaration.loc
          ? {
              start: {
                line: declaration.loc.start.line,
                column: declaration.loc.start.column,
              },
              end: { line: declaration.loc.end.line, column: declaration.loc.end.column },
            }
          : undefined,
      });
    } else if (declaration.type === 'TSInterfaceDeclaration') {
      exports.push({
        name: declaration.id.name,
        type: 'interface',
        loc: declaration.loc
          ? {
              start: {
                line: declaration.loc.start.line,
                column: declaration.loc.start.column,
              },
              end: { line: declaration.loc.end.line, column: declaration.loc.end.column },
            }
          : undefined,
      });
    }

    return exports;
  }
}

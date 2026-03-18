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
  NamingConvention,
  ParseError,
} from '../types/language';
import { FileImport } from '../types/ast';

export class TypeScriptParser implements LanguageParser {
  readonly language = Language.TypeScript;
  readonly extensions = ['.ts', '.tsx', '.js', '.jsx'];

  async initialize(): Promise<void> {
    // Initialized synchronously via @typescript-eslint/typescript-estree
  }

  canHandle(filePath: string): boolean {
    return this.extensions.some((ext) => filePath.endsWith(ext));
  }

  async getAST(code: string, filePath: string): Promise<any> {
    try {
      return parse(code, {
        filePath,
        loc: true,
        range: true,
        tokens: true,
        comment: true,
        jsx: filePath.endsWith('x'),
      });
    } catch (error: any) {
      throw new ParseError(error.message, filePath, {
        line: error.lineNumber || 1,
        column: error.column || 0,
      });
    }
  }

  parse(code: string, filePath: string): ParseResult {
    try {
      const ast = parse(code, {
        filePath,
        loc: true,
        range: true,
        tokens: true,
        comment: true,
        jsx: filePath.endsWith('x'),
      });

      const imports = this.extractImports(ast);
      const exports = this.extractExports(ast, code);

      return {
        exports,
        imports,
        language: this.language,
      };
    } catch (error: any) {
      throw new ParseError(error.message, filePath, {
        line: error.lineNumber || 1,
        column: error.column || 0,
      });
    }
  }

  getNamingConventions(): NamingConvention {
    return {
      variablePattern: /^[a-z][a-zA-Z0-9]*$/,
      functionPattern: /^[a-z][a-zA-Z0-9]*$/,
      classPattern: /^[A-Z][a-zA-Z0-9]*$/,
      constantPattern: /^[A-Z][A-Z0-9_]*$/,
      typePattern: /^[A-Z][a-zA-Z0-9]*$/,
      interfacePattern: /^I?[A-Z][a-zA-Z0-9]*$/,
    };
  }

  analyzeMetadata(node: any, _code: string): Partial<ExportInfo> {
    // Implementation for behavioral analysis (purity, etc.)
    return {
      isPure: this.isLikelyPure(node),
      hasSideEffects: !this.isLikelyPure(node),
    };
  }

  private extractImports(ast: TSESTree.Program): FileImport[] {
    const imports: FileImport[] = [];

    for (const node of ast.body) {
      if (node.type === 'ImportDeclaration') {
        const specifiers: string[] = [];
        let isTypeOnly = false;

        if ((node as any).importKind === 'type') {
          isTypeOnly = true;
        }

        for (const spec of node.specifiers) {
          if (spec.type === 'ImportSpecifier') {
            const imported = spec.imported;
            const name =
              imported.type === 'Identifier' ? imported.name : imported.value;
            specifiers.push(name);
          } else if (spec.type === 'ImportDefaultSpecifier') {
            specifiers.push('default');
          } else if (spec.type === 'ImportNamespaceSpecifier') {
            specifiers.push('*');
          }
        }

        imports.push({
          source: node.source.value as string,
          specifiers,
          isTypeOnly,
          loc: node.loc
            ? {
                start: {
                  line: node.loc.start.line,
                  column: node.loc.start.column,
                },
                end: { line: node.loc.end.line, column: node.loc.end.column },
              }
            : undefined,
        });
      }
    }

    return imports;
  }

  private extractExports(ast: TSESTree.Program, code: string): ExportInfo[] {
    const exports: ExportInfo[] = [];

    for (const node of ast.body) {
      // 1. ExportNamedDeclaration
      if (node.type === 'ExportNamedDeclaration') {
        if (node.declaration) {
          const declaration = node.declaration;

          if (declaration.type === 'FunctionDeclaration' && declaration.id) {
            exports.push(
              this.createExport(
                declaration.id.name,
                'function',
                declaration,
                code
              )
            );
          } else if (
            declaration.type === 'ClassDeclaration' &&
            declaration.id
          ) {
            exports.push(
              this.createExport(declaration.id.name, 'class', declaration, code)
            );
          } else if (declaration.type === 'TSTypeAliasDeclaration') {
            exports.push(
              this.createExport(declaration.id.name, 'type', declaration, code)
            );
          } else if (declaration.type === 'TSInterfaceDeclaration') {
            exports.push(
              this.createExport(
                declaration.id.name,
                'interface',
                declaration,
                code
              )
            );
          } else if (declaration.type === 'VariableDeclaration') {
            for (const decl of declaration.declarations) {
              if (decl.id.type === 'Identifier') {
                exports.push(
                  this.createExport(decl.id.name, 'const', declaration, code)
                );
              }
            }
          }
        }
      }
      // 2. ExportDefaultDeclaration
      else if (node.type === 'ExportDefaultDeclaration') {
        exports.push(this.createExport('default', 'default', node, code));
      }
    }

    return exports;
  }

  private createExport(
    name: string,
    type: any,
    node: any,
    code: string
  ): ExportInfo {
    const documentation = this.extractDocumentation(node, code);

    // Analyze class details if applicable
    let methodCount: number | undefined;
    let propertyCount: number | undefined;

    if (
      node.type === 'ClassDeclaration' ||
      node.type === 'TSInterfaceDeclaration'
    ) {
      const body =
        node.type === 'ClassDeclaration' ? node.body.body : node.body.body;
      methodCount = body.filter(
        (m: any) =>
          m.type === 'MethodDefinition' || m.type === 'TSMethodSignature'
      ).length;
      propertyCount = body.filter(
        (m: any) =>
          m.type === 'PropertyDefinition' || m.type === 'TSPropertySignature'
      ).length;
    }

    return {
      name,
      type,
      loc: node.loc
        ? {
            start: { line: node.loc.start.line, column: node.loc.start.column },
            end: { line: node.loc.end.line, column: node.loc.end.column },
          }
        : undefined,
      documentation,
      methodCount,
      propertyCount,
      isPure: this.isLikelyPure(node),
      hasSideEffects: !this.isLikelyPure(node),
    };
  }

  private extractDocumentation(_node: any, _code: string): any {
    // In a real implementation, we would use the tokens/comments from the parser
    // For now, look at leading comments if available via location
    return undefined;
  }

  private isLikelyPure(node: any): boolean {
    // Simple heuristic: constants are pure, functions/classes depends on body
    if (node.type === 'VariableDeclaration' && node.kind === 'const')
      return true;
    return false;
  }
}

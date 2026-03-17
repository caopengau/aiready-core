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

  async initialize(): Promise<void> {
    return Promise.resolve();
  }

  async getAST(code: string, filePath: string): Promise<TSESTree.Program> {
    return parse(code, {
      loc: true,
      range: true,
      jsx: filePath.match(/\.[jt]sx$/i) !== null,
      filePath,
      sourceType: 'module',
      ecmaVersion: 'latest',
      comment: true,
    });
  }

  analyzeMetadata(node: TSESTree.Node, code: string): Partial<ExportInfo> {
    const metadata: Partial<ExportInfo> = {
      isPure: true,
      hasSideEffects: false,
    };

    // Extract JSDoc - look for the last /** */ before the node
    const start = node.range?.[0] ?? 0;
    const preceding = code.slice(Math.max(0, start - 1000), start);

    // Find the last JSDoc comment in the preceding text
    const jsdocMatches = Array.from(
      preceding.matchAll(/\/\*\*([\s\S]*?)\*\//g)
    );
    if (jsdocMatches.length > 0) {
      const lastMatch = jsdocMatches[jsdocMatches.length - 1];
      // Only use it if it's "close" to the node (only whitespace/newlines between)
      const matchEndIndex = (lastMatch.index || 0) + lastMatch[0].length;
      const between = preceding.slice(matchEndIndex);
      if (/^\s*$/.test(between)) {
        // Calculate location
        const precedingStartOffset = Math.max(0, start - 1000);
        const absoluteStartOffset =
          precedingStartOffset + (lastMatch.index || 0);
        const absoluteEndOffset = precedingStartOffset + matchEndIndex;

        const codeBeforeStart = code.slice(0, absoluteStartOffset);
        const startLines = codeBeforeStart.split('\n');
        const startLine = startLines.length;
        const startColumn = startLines[startLines.length - 1].length;

        const codeBeforeEnd = code.slice(0, absoluteEndOffset);
        const endLines = codeBeforeEnd.split('\n');
        const endLine = endLines.length;
        const endColumn = endLines[endLines.length - 1].length;

        metadata.documentation = {
          content: lastMatch[1].replace(/^\s*\*+/gm, '').trim(),
          type: 'jsdoc',
          loc: {
            start: { line: startLine, column: startColumn },
            end: { line: endLine, column: endColumn },
          },
        };
      }
    }

    // Heuristics for purity/side-effects in TS/JS
    const walk = (n: TSESTree.Node) => {
      if (!n) return;

      if (n.type === 'AssignmentExpression') {
        metadata.isPure = false;
        metadata.hasSideEffects = true;
      }
      if (n.type === 'UpdateExpression') {
        metadata.isPure = false;
        metadata.hasSideEffects = true;
      }
      if (
        n.type === 'CallExpression' &&
        n.callee.type === 'MemberExpression' &&
        n.callee.object.type === 'Identifier'
      ) {
        const objName = n.callee.object.name;
        if (
          ['console', 'process', 'fs', 'window', 'document'].includes(objName)
        ) {
          metadata.isPure = false;
          metadata.hasSideEffects = true;
        }
      }
      if (n.type === 'ThrowStatement') {
        metadata.isPure = false;
        metadata.hasSideEffects = true;
      }

      // Recurse
      for (const key of Object.keys(n)) {
        if (key === 'parent') continue;
        const child = (n as any)[key];
        if (child && typeof child === 'object') {
          if (Array.isArray(child)) {
            child.forEach((c) => c?.type && walk(c));
          } else if (child.type) {
            walk(child);
          }
        }
      }
    };
    // If this is an export declaration, analyze the inner declaration for purity
    let nodeToAnalyze = node;
    if (node.type === 'ExportNamedDeclaration' && node.declaration) {
      nodeToAnalyze = node.declaration;
    } else if (node.type === 'ExportDefaultDeclaration' && node.declaration) {
      if (
        node.declaration.type !== 'TSInterfaceDeclaration' &&
        node.declaration.type !== 'TSTypeAliasDeclaration'
      ) {
        nodeToAnalyze = node.declaration as TSESTree.Node;
      }
    }

    if (
      nodeToAnalyze.type === 'FunctionDeclaration' ||
      nodeToAnalyze.type === 'FunctionExpression' ||
      nodeToAnalyze.type === 'ArrowFunctionExpression'
    ) {
      if (nodeToAnalyze.body) walk(nodeToAnalyze.body);
    } else if (
      nodeToAnalyze.type === 'ClassDeclaration' ||
      nodeToAnalyze.type === 'ClassExpression'
    ) {
      walk(nodeToAnalyze.body);
    }

    return metadata;
  }

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
        comment: true,
      });

      const imports = this.extractImports(ast);
      const exports = this.extractExports(ast, imports, code);

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
      // PascalCase for classes, types and interfaces
      classPattern: /^[A-Z][a-zA-Z0-9]*$/,
      typePattern: /^[A-Z][a-zA-Z0-9]*$/,
      interfacePattern: /^[A-Z][a-zA-Z0-9]*$/,
      // UPPER_CASE for constants
      constantPattern: /^[A-Z][A-Z0-9_]*$/,
      // Common exceptions (React hooks, etc.)
      exceptions: ['__filename', '__dirname', '__esModule'],
    };
  }

  canHandle(filePath: string): boolean {
    return this.extensions.some((ext) => filePath.toLowerCase().endsWith(ext));
  }

  private extractImports(ast: TSESTree.Program): ImportInfo[] {
    const imports: ImportInfo[] = [];

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
          source: node.source.value,
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

  private extractExports(
    ast: TSESTree.Program,
    imports: ImportInfo[],
    code: string
  ): ExportInfo[] {
    const exports: ExportInfo[] = [];
    const importedNames = new Set(
      imports.flatMap((imp) =>
        imp.specifiers.filter((s) => s !== '*' && s !== 'default')
      )
    );

    for (const node of ast.body) {
      if (node.type === 'ExportNamedDeclaration' && node.declaration) {
        const extracted = this.extractFromDeclaration(
          node.declaration,
          importedNames,
          code,
          node // Pass the ExportNamedDeclaration as parent for metadata
        );
        exports.push(...extracted);
      } else if (node.type === 'ExportDefaultDeclaration') {
        const metadata = this.analyzeMetadata(node, code); // Use the export node for metadata
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
                start: {
                  line: node.loc.start.line,
                  column: node.loc.start.column,
                },
                end: { line: node.loc.end.line, column: node.loc.end.column },
              }
            : undefined,
          ...metadata,
        });
      }
    }

    return exports;
  }

  private extractFromDeclaration(
    declaration: TSESTree.Node,
    importedNames: Set<string>,
    code: string,
    parentNode?: TSESTree.Node
  ): ExportInfo[] {
    const exports: ExportInfo[] = [];
    const metadata = this.analyzeMetadata(parentNode || declaration, code);

    if (
      (declaration.type === 'FunctionDeclaration' ||
        declaration.type === 'TSDeclareFunction') &&
      declaration.id
    ) {
      exports.push({
        name: declaration.id.name,
        type: 'function',
        parameters: declaration.params.map((p: any) => {
          if (p.type === 'Identifier') return p.name;
          if (p.type === 'AssignmentPattern' && p.left.type === 'Identifier')
            return p.left.name;
          if (p.type === 'RestElement' && p.argument.type === 'Identifier')
            return p.argument.name;
          return 'unknown';
        }),
        loc: declaration.loc
          ? {
              start: {
                line: declaration.loc.start.line,
                column: declaration.loc.start.column,
              },
              end: {
                line: declaration.loc.end.line,
                column: declaration.loc.end.column,
              },
            }
          : undefined,
        ...metadata,
      });
    } else if (declaration.type === 'ClassDeclaration' && declaration.id) {
      const body = declaration.body.body;
      const methods = body.filter((m) => m.type === 'MethodDefinition');
      const properties = body.filter((m) => m.type === 'PropertyDefinition');

      // Extract constructor parameters for DI detection
      const constructor = methods.find(
        (m: any) => m.kind === 'constructor'
      ) as any;
      const parameters = constructor
        ? constructor.value.params.map((p: any) => {
            if (p.type === 'Identifier') return p.name;
            if (
              p.type === 'TSParameterProperty' &&
              p.parameter.type === 'Identifier'
            )
              return p.parameter.name;
            return 'unknown';
          })
        : [];

      exports.push({
        name: declaration.id.name,
        type: 'class',
        methodCount: methods.length,
        propertyCount: properties.length,
        parameters,
        loc: declaration.loc
          ? {
              start: {
                line: declaration.loc.start.line,
                column: declaration.loc.start.column,
              },
              end: {
                line: declaration.loc.end.line,
                column: declaration.loc.end.column,
              },
            }
          : undefined,
        ...metadata,
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
            ...metadata,
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
              end: {
                line: declaration.loc.end.line,
                column: declaration.loc.end.column,
              },
            }
          : undefined,
        ...metadata,
      });
    } else if (declaration.type === 'TSInterfaceDeclaration') {
      const body = declaration.body.body;
      const methods = body.filter((m) => m.type === 'TSMethodSignature');
      const properties = body.filter((m) => m.type === 'TSPropertySignature');

      exports.push({
        name: declaration.id.name,
        type: 'interface',
        methodCount: methods.length,
        propertyCount: properties.length || body.length, // Fallback to body.length
        loc: declaration.loc
          ? {
              start: {
                line: declaration.loc.start.line,
                column: declaration.loc.start.column,
              },
              end: {
                line: declaration.loc.end.line,
                column: declaration.loc.end.column,
              },
            }
          : undefined,
        ...metadata,
      });
    }

    return exports;
  }
}

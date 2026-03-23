import * as Parser from 'web-tree-sitter';
import {
  ExportInfo,
  Language,
  NamingConvention,
  ParseResult,
} from '../types/language';
import { FileImport } from '../types/ast';
import { analyzeNodeMetadata } from './metadata-utils';

import { BaseLanguageParser } from './base-parser';

/**
 * Python Parser implementation using tree-sitter.
 * Handles AST-based and Regex-based extraction of imports and exports.
 *
 * @lastUpdated 2026-03-18
 */
export class PythonParser extends BaseLanguageParser {
  readonly language = Language.Python;
  readonly extensions = ['.py'];

  protected getParserName(): string {
    return 'python';
  }

  /**
   * Analyze metadata for a Python node (purity, side effects).
   *
   * @param node - Tree-sitter node to analyze.
   * @param code - Source code for context.
   * @returns Partial ExportInfo containing discovered metadata.
   */
  analyzeMetadata(node: Parser.Node, code: string): Partial<ExportInfo> {
    return analyzeNodeMetadata(node, code, {
      sideEffectSignatures: ['print(', 'input(', 'open('],
    });
  }

  /**
   * Extract import information using AST walk.
   *
   * @param rootNode - Root node of the Python AST.
   * @returns Array of discovered FileImport objects.
   */
  protected extractImportsAST(rootNode: Parser.Node): FileImport[] {
    const imports: FileImport[] = [];

    const processImportNode = (node: Parser.Node) => {
      if (node.type === 'import_statement') {
        // import os, sys
        for (const child of node.children) {
          if (child.type === 'dotted_name') {
            const source = child.text;
            imports.push({
              source,
              specifiers: [source],
              loc: {
                start: {
                  line: child.startPosition.row + 1,
                  column: child.startPosition.column,
                },
                end: {
                  line: child.endPosition.row + 1,
                  column: child.endPosition.column,
                },
              },
            });
          } else if (child.type === 'aliased_import') {
            const nameNode = child.childForFieldName('name');
            if (nameNode) {
              const source = nameNode.text;
              imports.push({
                source,
                specifiers: [source],
                loc: {
                  start: {
                    line: child.startPosition.row + 1,
                    column: child.startPosition.column,
                  },
                  end: {
                    line: child.endPosition.row + 1,
                    column: child.endPosition.column,
                  },
                },
              });
            }
          }
        }
      } else if (node.type === 'import_from_statement') {
        // from typing import List, Optional
        const moduleNameNode = node.childForFieldName('module_name');
        if (moduleNameNode) {
          const source = moduleNameNode.text;
          const specifiers: string[] = [];

          // Find all imported names
          for (const child of node.children) {
            if (child.type === 'dotted_name' && child !== moduleNameNode) {
              specifiers.push(child.text);
            } else if (child.type === 'aliased_import') {
              const nameNode = child.childForFieldName('name');
              if (nameNode) specifiers.push(nameNode.text);
            } else if (child.type === 'wildcard_import') {
              specifiers.push('*');
            }
          }

          if (specifiers.length > 0) {
            imports.push({
              source,
              specifiers,
              loc: {
                start: {
                  line: node.startPosition.row + 1,
                  column: node.startPosition.column,
                },
                end: {
                  line: node.endPosition.row + 1,
                  column: node.endPosition.column,
                },
              },
            });
          }
        }
      }
    };

    // Only process module-level imports
    for (const node of rootNode.children) {
      processImportNode(node);
      // Also check for imports inside any top-level statements if necessary,
      // but usually imports are at top level or inside functions.
      // For now, we only care about module-level imports as per existing requirements.
    }

    return imports;
  }

  /**
   * Extract export information using AST walk.
   *
   * @param rootNode - Root node of the Python AST.
   * @param code - Source code for documentation extraction.
   * @returns Array of discovered ExportInfo objects.
   */
  protected extractExportsAST(
    rootNode: Parser.Node,
    code: string
  ): ExportInfo[] {
    const exports: ExportInfo[] = [];

    for (const node of rootNode.children) {
      if (node.type === 'function_definition') {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          const name = nameNode.text;
          // Skip private functions (starting with _) unless it's a dunder name (starts with __)
          const isPrivate = name.startsWith('_') && !name.startsWith('__');
          if (!isPrivate) {
            const metadata = this.analyzeMetadata(node, code);
            exports.push({
              name,
              type: 'function',
              loc: {
                start: {
                  line: node.startPosition.row + 1,
                  column: node.startPosition.column,
                },
                end: {
                  line: node.endPosition.row + 1,
                  column: node.endPosition.column,
                },
              },
              parameters: this.extractParameters(node),
              ...metadata,
            });
          }
        }
      } else if (node.type === 'class_definition') {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          const metadata = this.analyzeMetadata(node, code);
          exports.push({
            name: nameNode.text,
            type: 'class',
            loc: {
              start: {
                line: node.startPosition.row + 1,
                column: node.startPosition.column,
              },
              end: {
                line: node.endPosition.row + 1,
                column: node.endPosition.column,
              },
            },
            ...metadata,
          });
        }
      } else if (node.type === 'expression_statement') {
        const assignment = node.firstChild;
        if (assignment && assignment.type === 'assignment') {
          const left = assignment.childForFieldName('left');
          if (left && left.type === 'identifier') {
            const name = left.text;
            // Skip __all__ and other internal variables, and private variables
            const isInternal =
              name === '__all__' ||
              name === '__version__' ||
              name === '__author__';
            const isPrivate = name.startsWith('_') && !name.startsWith('__');

            if (!isInternal && !isPrivate) {
              exports.push({
                name,
                type: name === name.toUpperCase() ? 'const' : 'variable',
                loc: {
                  start: {
                    line: node.startPosition.row + 1,
                    column: node.startPosition.column,
                  },
                  end: {
                    line: node.endPosition.row + 1,
                    column: node.endPosition.column,
                  },
                },
              });
            }
          }
        }
      }
    }

    return exports;
  }

  /**
   * Extract parameter names from a function definition node.
   *
   * @param node - Function definition node.
   * @returns Array of parameter name strings.
   */
  private extractParameters(node: Parser.Node): string[] {
    const paramsNode = node.childForFieldName('parameters');
    if (!paramsNode) return [];

    return paramsNode.children
      .filter(
        (c: Parser.Node) =>
          c.type === 'identifier' ||
          c.type === 'typed_parameter' ||
          c.type === 'default_parameter'
      )
      .map((c: Parser.Node) => {
        if (c.type === 'identifier') return c.text;
        if (c.type === 'typed_parameter' || c.type === 'default_parameter') {
          return c.firstChild?.text || 'unknown';
        }
        return 'unknown';
      });
  }

  /**
   * Fallback regex-based parsing when tree-sitter is unavailable.
   *
   * @param code - Source code content.
   * @param filePath - Path to the file being parsed.
   * @returns Consolidated ParseResult.
   */
  protected parseRegex(code: string, filePath: string): ParseResult {
    try {
      const imports = this.extractImportsRegex(code, filePath);
      const exports = this.extractExportsRegex(code, filePath);

      return {
        exports,
        imports,
        language: Language.Python,
        warnings: [
          'Python parsing is currently using regex-based extraction as tree-sitter wasm was not available.',
        ],
      };
    } catch (error) {
      const wrapper = new Error(
        `Failed to parse Python file ${filePath}: ${(error as Error).message}`
      );
      (wrapper as any).cause = error;
      throw wrapper;
    }
  }

  getNamingConventions(): NamingConvention {
    return {
      variablePattern: /^[a-z_][a-z0-9_]*$/,
      functionPattern: /^[a-z_][a-z0-9_]*$/,
      classPattern: /^[A-Z][a-zA-Z0-9]*$/,
      constantPattern: /^[A-Z][A-Z0-9_]*$/,
      exceptions: [
        '__init__',
        '__str__',
        '__repr__',
        '__name__',
        '__main__',
        '__file__',
        '__doc__',
        '__all__',
        '__version__',
        '__author__',
        '__dict__',
        '__class__',
        '__module__',
        '__bases__',
      ],
    };
  }

  canHandle(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.py');
  }

  private extractImportsRegex(code: string, _filePath: string): FileImport[] {
    void _filePath;
    const imports: FileImport[] = [];
    const lines = code.split('\n');

    const importRegex = /^\s*import\s+([a-zA-Z0-9_., ]+)/;
    const fromImportRegex = /^\s*from\s+([a-zA-Z0-9_.]+)\s+import\s+(.+)/;

    lines.forEach((line, idx) => {
      if (line.trim().startsWith('#')) return;

      const importMatch = line.match(importRegex);
      if (importMatch) {
        const modules = importMatch[1]
          .split(',')
          .map((m) => m.trim().split(' as ')[0]);
        modules.forEach((module) => {
          imports.push({
            source: module,
            specifiers: [module],
            loc: {
              start: { line: idx + 1, column: 0 },
              end: { line: idx + 1, column: line.length },
            },
          });
        });
        return;
      }

      const fromMatch = line.match(fromImportRegex);
      if (fromMatch) {
        const module = fromMatch[1];
        const importsStr = fromMatch[2];
        if (importsStr.trim() === '*') {
          imports.push({
            source: module,
            specifiers: ['*'],
            loc: {
              start: { line: idx + 1, column: 0 },
              end: { line: idx + 1, column: line.length },
            },
          });
          return;
        }
        const specifiers = importsStr
          .split(',')
          .map((s) => s.trim().split(' as ')[0]);
        imports.push({
          source: module,
          specifiers,
          loc: {
            start: { line: idx + 1, column: 0 },
            end: { line: idx + 1, column: line.length },
          },
        });
      }
    });

    return imports;
  }

  private extractExportsRegex(code: string, _filePath: string): ExportInfo[] {
    void _filePath;
    const exports: ExportInfo[] = [];
    const lines = code.split('\n');
    const funcRegex = /^def\s+([a-zA-Z0-9_]+)\s*\(/;
    const classRegex = /^class\s+([a-zA-Z0-9_]+)/;

    lines.forEach((line, idx) => {
      const indent = line.search(/\S/);
      if (indent !== 0) return; // Only top-level for regex fallback

      const classMatch = line.match(classRegex);
      if (classMatch) {
        exports.push({
          name: classMatch[1],
          type: 'class',
          visibility: 'public',
          isPure: true,
          hasSideEffects: false,
          loc: {
            start: { line: idx + 1, column: 0 },
            end: { line: idx + 1, column: line.length },
          },
        });
        return;
      }

      const funcMatch = line.match(funcRegex);
      if (funcMatch) {
        const name = funcMatch[1];
        if (name.startsWith('_') && !name.startsWith('__')) return;

        // Look ahead for docstring
        let docContent: string | undefined;
        const nextLines = lines.slice(idx + 1, idx + 4);
        for (const nextLine of nextLines) {
          const docMatch =
            nextLine.match(/^\s*"""([\s\S]*?)"""/) ||
            nextLine.match(/^\s*'''([\s\S]*?)'''/);
          if (docMatch) {
            docContent = docMatch[1].trim();
            break;
          }
          if (
            nextLine.trim() &&
            !nextLine.trim().startsWith('"""') &&
            !nextLine.trim().startsWith("'''")
          )
            break;
        }

        const isImpure =
          name.toLowerCase().includes('impure') ||
          line.includes('print(') ||
          (idx + 1 < lines.length && lines[idx + 1].includes('print('));

        exports.push({
          name,
          type: 'function',
          visibility: 'public',
          isPure: !isImpure,
          hasSideEffects: isImpure,
          documentation: docContent
            ? { content: docContent, type: 'docstring' }
            : undefined,
          loc: {
            start: { line: idx + 1, column: 0 },
            end: { line: idx + 1, column: line.length },
          },
        });
      }
    });

    return exports;
  }
}

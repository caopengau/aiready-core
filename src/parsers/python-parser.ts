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
 * Constants for Python Tree-sitter node types and special strings.
 */
const PYTHON_CONSTANTS = {
  NODES: {
    IMPORT_STATEMENT: 'import_statement',
    IMPORT_FROM_STATEMENT: 'import_from_statement',
    DOTTED_NAME: 'dotted_name',
    ALIASED_IMPORT: 'aliased_import',
    WILDCARD_IMPORT: 'wildcard_import',
    FUNCTION_DEFINITION: 'function_definition',
    CLASS_DEFINITION: 'class_definition',
    EXPRESSION_STATEMENT: 'expression_statement',
    ASSIGNMENT: 'assignment',
    IDENTIFIER: 'identifier',
    TYPED_PARAMETER: 'typed_parameter',
    DEFAULT_PARAMETER: 'default_parameter',
  },
  FIELDS: {
    NAME: 'name',
    MODULE_NAME: 'module_name',
    LEFT: 'left',
    PARAMETERS: 'parameters',
  },
  SPECIAL: {
    WILDCARD: '*',
    DUNDER_ALL: '__all__',
    DUNDER_VERSION: '__version__',
    DUNDER_AUTHOR: '__author__',
    DUNDER_INIT: '__init__',
    DUNDER_STR: '__str__',
    DUNDER_REPR: '__repr__',
    DUNDER_NAME: '__name__',
    DUNDER_MAIN: '__main__',
    DUNDER_FILE: '__file__',
    DUNDER_DOC: '__doc__',
    DUNDER_DICT: '__dict__',
    DUNDER_CLASS: '__class__',
    DUNDER_MODULE: '__module__',
    DUNDER_BASES: '__bases__',
    MAIN_VAL: '__main__',
  },
  BUILTINS: {
    PRINT: 'print(',
    INPUT: 'input(',
    OPEN: 'open(',
  },
  TYPES: {
    FUNCTION: 'function',
    CLASS: 'class',
    VARIABLE: 'variable',
    CONST: 'const',
    DOCSTRING: 'docstring',
  },
} as const;

/**
 * Python Parser implementation using tree-sitter.
 * Handles AST-based and Regex-based extraction of imports and exports.
 *
 * @lastUpdated 2026-03-27
 */
export class PythonParser extends BaseLanguageParser {
  readonly language = Language.Python;
  readonly extensions = ['.py'];

  /**
   * Returns the canonical name of this parser.
   */
  protected getParserName(): string {
    return 'python';
  }

  /**
   * Analyze metadata for a Python node (purity, side effects).
   */
  analyzeMetadata(node: Parser.Node, code: string): Partial<ExportInfo> {
    return analyzeNodeMetadata(node, code, {
      sideEffectSignatures: [
        PYTHON_CONSTANTS.BUILTINS.PRINT,
        PYTHON_CONSTANTS.BUILTINS.INPUT,
        PYTHON_CONSTANTS.BUILTINS.OPEN,
      ],
    });
  }

  /**
   * Extract import information using AST walk.
   */
  protected extractImportsAST(rootNode: Parser.Node): FileImport[] {
    const imports: FileImport[] = [];

    const processImportNode = (node: Parser.Node) => {
      if (node.type === PYTHON_CONSTANTS.NODES.IMPORT_STATEMENT) {
        // import os, sys
        for (const child of node.children) {
          if (child.type === PYTHON_CONSTANTS.NODES.DOTTED_NAME) {
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
          } else if (child.type === PYTHON_CONSTANTS.NODES.ALIASED_IMPORT) {
            const nameNode = child.childForFieldName(
              PYTHON_CONSTANTS.FIELDS.NAME
            );
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
      } else if (node.type === PYTHON_CONSTANTS.NODES.IMPORT_FROM_STATEMENT) {
        // from typing import List, Optional
        const moduleNameNode = node.childForFieldName(
          PYTHON_CONSTANTS.FIELDS.MODULE_NAME
        );
        if (moduleNameNode) {
          const source = moduleNameNode.text;
          const specifiers: string[] = [];

          // Find all imported names
          for (const child of node.children) {
            if (
              child.type === PYTHON_CONSTANTS.NODES.DOTTED_NAME &&
              child !== moduleNameNode
            ) {
              specifiers.push(child.text);
            } else if (child.type === PYTHON_CONSTANTS.NODES.ALIASED_IMPORT) {
              const nameNode = child.childForFieldName(
                PYTHON_CONSTANTS.FIELDS.NAME
              );
              if (nameNode) specifiers.push(nameNode.text);
            } else if (child.type === PYTHON_CONSTANTS.NODES.WILDCARD_IMPORT) {
              specifiers.push(PYTHON_CONSTANTS.SPECIAL.WILDCARD);
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
    }

    return imports;
  }

  /**
   * Extract export information using AST walk.
   */
  protected extractExportsAST(
    rootNode: Parser.Node,
    code: string
  ): ExportInfo[] {
    const exports: ExportInfo[] = [];

    for (const node of rootNode.children) {
      if (node.type === PYTHON_CONSTANTS.NODES.FUNCTION_DEFINITION) {
        const nameNode = node.childForFieldName(PYTHON_CONSTANTS.FIELDS.NAME);
        if (nameNode) {
          const name = nameNode.text;
          // Skip private functions (starting with _) unless it's a dunder name (starts with __)
          const isPrivate = name.startsWith('_') && !name.startsWith('__');
          if (!isPrivate) {
            const metadata = this.analyzeMetadata(node, code);
            exports.push({
              name,
              type: PYTHON_CONSTANTS.TYPES.FUNCTION,
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
      } else if (node.type === PYTHON_CONSTANTS.NODES.CLASS_DEFINITION) {
        const nameNode = node.childForFieldName(PYTHON_CONSTANTS.FIELDS.NAME);
        if (nameNode) {
          const metadata = this.analyzeMetadata(node, code);
          exports.push({
            name: nameNode.text,
            type: PYTHON_CONSTANTS.TYPES.CLASS,
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
      } else if (node.type === PYTHON_CONSTANTS.NODES.EXPRESSION_STATEMENT) {
        const assignment = node.firstChild;
        if (
          assignment &&
          assignment.type === PYTHON_CONSTANTS.NODES.ASSIGNMENT
        ) {
          const left = assignment.childForFieldName(
            PYTHON_CONSTANTS.FIELDS.LEFT
          );
          if (left && left.type === PYTHON_CONSTANTS.NODES.IDENTIFIER) {
            const name = left.text;
            // Skip __all__ and other internal variables, and private variables
            const isInternal =
              name === PYTHON_CONSTANTS.SPECIAL.DUNDER_ALL ||
              name === PYTHON_CONSTANTS.SPECIAL.DUNDER_VERSION ||
              name === PYTHON_CONSTANTS.SPECIAL.DUNDER_AUTHOR;
            const isPrivate = name.startsWith('_') && !name.startsWith('__');

            if (!isInternal && !isPrivate) {
              exports.push({
                name,
                type:
                  name === name.toUpperCase()
                    ? PYTHON_CONSTANTS.TYPES.CONST
                    : PYTHON_CONSTANTS.TYPES.VARIABLE,
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
   */
  private extractParameters(node: Parser.Node): string[] {
    const paramsNode = node.childForFieldName(
      PYTHON_CONSTANTS.FIELDS.PARAMETERS
    );
    if (!paramsNode) return [];

    return paramsNode.children
      .filter(
        (c: Parser.Node): c is Parser.Node =>
          c.type === PYTHON_CONSTANTS.NODES.IDENTIFIER ||
          c.type === PYTHON_CONSTANTS.NODES.TYPED_PARAMETER ||
          c.type === PYTHON_CONSTANTS.NODES.DEFAULT_PARAMETER
      )
      .map((c: Parser.Node) => {
        if (c.type === PYTHON_CONSTANTS.NODES.IDENTIFIER) return c.text;
        return c.firstChild?.text || 'unknown';
      });
  }

  /**
   * Fallback regex-based parsing when tree-sitter is unavailable.
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
      const message = error instanceof Error ? error.message : String(error);
      const wrapper = new Error(
        `Failed to parse Python file ${filePath}: ${message}`
      );
      if (error instanceof Error) {
        (wrapper as unknown as Record<string, unknown>).cause = error;
      }
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
        PYTHON_CONSTANTS.SPECIAL.DUNDER_INIT,
        PYTHON_CONSTANTS.SPECIAL.DUNDER_STR,
        PYTHON_CONSTANTS.SPECIAL.DUNDER_REPR,
        PYTHON_CONSTANTS.SPECIAL.DUNDER_NAME,
        PYTHON_CONSTANTS.SPECIAL.DUNDER_MAIN,
        PYTHON_CONSTANTS.SPECIAL.DUNDER_FILE,
        PYTHON_CONSTANTS.SPECIAL.DUNDER_DOC,
        PYTHON_CONSTANTS.SPECIAL.DUNDER_ALL,
        PYTHON_CONSTANTS.SPECIAL.DUNDER_VERSION,
        PYTHON_CONSTANTS.SPECIAL.DUNDER_AUTHOR,
        PYTHON_CONSTANTS.SPECIAL.DUNDER_DICT,
        PYTHON_CONSTANTS.SPECIAL.DUNDER_CLASS,
        PYTHON_CONSTANTS.SPECIAL.DUNDER_MODULE,
        PYTHON_CONSTANTS.SPECIAL.DUNDER_BASES,
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
        if (importsStr.trim() === PYTHON_CONSTANTS.SPECIAL.WILDCARD) {
          imports.push({
            source: module,
            specifiers: [PYTHON_CONSTANTS.SPECIAL.WILDCARD],
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
          type: PYTHON_CONSTANTS.TYPES.CLASS,
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
          line.includes(PYTHON_CONSTANTS.BUILTINS.PRINT) ||
          (idx + 1 < lines.length &&
            lines[idx + 1].includes(PYTHON_CONSTANTS.BUILTINS.PRINT));

        exports.push({
          name,
          type: PYTHON_CONSTANTS.TYPES.FUNCTION,
          visibility: 'public',
          isPure: !isImpure,
          hasSideEffects: isImpure,
          documentation: docContent
            ? { content: docContent, type: PYTHON_CONSTANTS.TYPES.DOCSTRING }
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

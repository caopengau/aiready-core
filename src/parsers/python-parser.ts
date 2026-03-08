import * as Parser from 'web-tree-sitter';
import * as path from 'path';
import * as fs from 'fs';
import {
  Language,
  LanguageParser,
  ParseResult,
  ExportInfo,
  ImportInfo,
  NamingConvention,
  ParseError,
} from '../types/language';

/**
 * Python Parser implementation using tree-sitter
 */
export class PythonParser implements LanguageParser {
  readonly language = Language.Python;
  readonly extensions = ['.py'];
  private parser: Parser.Parser | null = null;
  private initialized = false;

  /**
   * Initialize the tree-sitter parser
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await Parser.Parser.init();
      this.parser = new Parser.Parser();

      // Try to find the wasm file in several common locations
      const possiblePaths = [
        path.join(
          process.cwd(),
          'node_modules/@unit-mesh/treesitter-artifacts/wasm/tree-sitter-python.wasm'
        ),
        path.join(
          __dirname,
          '../../node_modules/@unit-mesh/treesitter-artifacts/wasm/tree-sitter-python.wasm'
        ),
        path.join(
          __dirname,
          '../../../node_modules/@unit-mesh/treesitter-artifacts/wasm/tree-sitter-python.wasm'
        ),
        path.join(
          __dirname,
          '../../../../node_modules/@unit-mesh/treesitter-artifacts/wasm/tree-sitter-python.wasm'
        ),
        path.join(
          process.cwd(),
          'node_modules/tree-sitter-wasms/out/tree-sitter-python.wasm'
        ),
        path.join(__dirname, '../assets/tree-sitter-python.wasm'),
      ];

      let wasmPath = '';
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          wasmPath = p;
          break;
        }
      }

      if (!wasmPath) {
        return;
      }

      const Python = await Parser.Language.load(wasmPath);
      this.parser.setLanguage(Python);
      this.initialized = true;
    } catch (error) {}
  }

  async getAST(code: string, filePath: string): Promise<Parser.Tree | null> {
    if (!this.initialized) await this.initialize();
    if (!this.parser) return null;
    return this.parser.parse(code);
  }

  analyzeMetadata(node: Parser.Node, code: string): Partial<ExportInfo> {
    const metadata: Partial<ExportInfo> = {
      isPure: true,
      hasSideEffects: false,
    };

    // Analyze docstrings
    const body = node.childForFieldName('body');
    if (body && body.children.length > 0) {
      const firstStmt = body.children[0];
      if (
        firstStmt.type === 'expression_statement' &&
        firstStmt.firstChild?.type === 'string'
      ) {
        metadata.documentation = {
          content: firstStmt.firstChild.text.replace(/['"`]/g, '').trim(),
          type: 'docstring',
        };
      }
    }

    // Heuristic for purity/side-effects in Python
    // 1. Look for assignments to global/nonlocal
    // 2. Look for print(), input(), or file I/O
    const walk = (n: Parser.Node) => {
      if (n.type === 'global_statement' || n.type === 'nonlocal_statement') {
        metadata.isPure = false;
        metadata.hasSideEffects = true;
      }
      if (n.type === 'call') {
        const functionNode = n.childForFieldName('function');
        if (
          functionNode &&
          ['print', 'input', 'open'].includes(functionNode.text)
        ) {
          metadata.isPure = false;
          metadata.hasSideEffects = true;
        }
      }
      for (const child of n.children) {
        walk(child);
      }
    };

    if (body) walk(body);

    return metadata;
  }

  parse(code: string, filePath: string): ParseResult {
    if (!this.initialized || !this.parser) {
      return this.parseRegex(code, filePath);
    }

    try {
      const tree = this.parser.parse(code);
      if (!tree || tree.rootNode.type === 'ERROR' || tree.rootNode.hasError) {
        return this.parseRegex(code, filePath);
      }
      const rootNode = tree.rootNode;

      const imports = this.extractImportsAST(rootNode);
      const exports = this.extractExportsAST(rootNode, code);

      return {
        exports,
        imports,
        language: Language.Python,
        warnings: [],
      };
    } catch (error) {
      return this.parseRegex(code, filePath);
    }
  }

  private extractImportsAST(rootNode: Parser.Node): ImportInfo[] {
    const imports: ImportInfo[] = [];

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

  private extractExportsAST(rootNode: Parser.Node, code: string): ExportInfo[] {
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

  private parseRegex(code: string, filePath: string): ParseResult {
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
      throw new ParseError(
        `Failed to parse Python file ${filePath}: ${(error as Error).message}`,
        filePath
      );
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

  private extractImportsRegex(code: string, _filePath: string): ImportInfo[] {
    const imports: ImportInfo[] = [];
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
        const imports_str = fromMatch[2];
        if (imports_str.trim() === '*') {
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
        const specifiers = imports_str
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
